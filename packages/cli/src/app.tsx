import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Settings, Message, AgentInstance, ToolContext } from '@fridaycode/shared';
import { APP_NAME } from '@fridaycode/shared';
import type { CliOptions } from './index.js';

// Components
import { Output } from './components/Output.js';
import { Prompt } from './components/Prompt.js';
import { StatusBar } from './components/StatusBar.js';
import { WelcomeScreen } from './mascot/welcome.js';
import { PermissionPrompt } from './components/PermissionPrompt.js';
import { TaskList } from './components/TaskList.js';
import { ContextViewer } from './components/ContextViewer.js';

// Systems
import { executeCommand } from './commands/index.js';
import { isOnboarded, markOnboarded, detectOllama } from './onboarding/wizard.js';
import { setTheme } from './themes/engine.js';
// Initialize themes on import
import './themes/dark.js';
import './themes/light.js';

interface AppProps {
  settings: Settings;
  initialPrompt?: string;
  options: CliOptions;
}

type AppState = 'welcome' | 'idle' | 'loading' | 'streaming' | 'tool-running' | 'permission';

interface PendingPermission {
  toolName: string;
  input: Record<string, unknown>;
  resolve: (allowed: boolean, always?: boolean) => void;
}

interface EngineHandle {
  sendMessage: (content: string) => Promise<void>;
  abort: () => void;
  compact: () => Promise<void>;
}

export function App({ settings, initialPrompt, options }: AppProps) {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>(initialPrompt ? 'loading' : 'welcome');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamContent, setStreamContent] = useState('');
  const [tokenCount, setTokenCount] = useState({ input: 0, output: 0 });
  const [showWelcome, setShowWelcome] = useState(!initialPrompt);
  const [currentModel, setCurrentModel] = useState(settings.activeModel);
  const [currentProvider, setCurrentProvider] = useState(settings.activeProvider);
  const [backgroundTasks, setBackgroundTasks] = useState<AgentInstance[]>([]);
  const [showContext, setShowContext] = useState(false);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);

  const engineRef = useRef<EngineHandle | null>(null);

  // Set initial theme
  useEffect(() => {
    setTheme(settings.theme);
  }, []);

  // First-run onboarding check
  useEffect(() => {
    if (!isOnboarded() && !initialPrompt) {
      detectOllama().then((found) => {
        if (found && !settings.activeProvider) {
          setCurrentProvider('ollama');
        }
      });
      markOnboarded().catch(() => {});
    }
  }, []);

  useEffect(() => {
    initEngine().then(() => {
      if (initialPrompt) {
        handleSubmit(initialPrompt);
      }
    });
  }, []);

  async function initEngine() {
    const {
      createProvider,
      createDefaultToolRegistry,
      PermissionEngine,
      HookEngineImpl,
      createSession,
      prepareCompactionPrompt,
      applyCompaction,
    } = await import('@fridaycode/core');

    const providerConfig = settings.providers[currentProvider] ?? settings.providers[settings.activeProvider];
    if (!providerConfig) return;

    const provider = createProvider(providerConfig);
    const toolRegistry = createDefaultToolRegistry();
    const permissionRules = [
      ...settings.permissions.allow.map((t: string) => ({ action: 'allow' as const, tool: t })),
      ...settings.permissions.deny.map((t: string) => ({ action: 'deny' as const, tool: t })),
    ];
    const permissions = new PermissionEngine(settings.permissionMode, permissionRules);
    const hooks = new HookEngineImpl();
    const session = createSession(process.cwd(), 'interactive');

    let abortController = new AbortController();
    let allMessages: Message[] = [];

    engineRef.current = {
      sendMessage: async (content: string) => {
        abortController = new AbortController();
        const userMsg: Message = { role: 'user', content, timestamp: Date.now() };
        allMessages = [...allMessages, userMsg];
        setMessages((prev) => [...prev, userMsg]);
        setState('streaming');
        setStreamContent('');

        let loopMessages = [...allMessages];
        let continueLoop = true;
        let turns = 0;
        const maxTurns = options.maxTurns ?? settings.compactMessageThreshold ?? 50;

        while (continueLoop && turns < maxTurns) {
          turns++;
          let assistantContent = '';
          let toolCalls: Message['toolCalls'] = [];

          const chatOptions = {
            model: currentModel,
            provider: providerConfig.type,
            messages: loopMessages,
            tools: toolRegistry.getDefinitions(),
            stream: true,
            maxTokens: settings.maxTokens,
          } as import('@fridaycode/shared').ChatOptions;

          for await (const chunk of provider.chat(chatOptions)) {
            if (abortController.signal.aborted) break;

            switch (chunk.type) {
              case 'text':
                assistantContent += chunk.content ?? '';
                setStreamContent((prev) => prev + (chunk.content ?? ''));
                break;
              case 'tool_use':
                if (chunk.toolCall) {
                  toolCalls = toolCalls ?? [];
                  toolCalls.push(chunk.toolCall);
                }
                break;
              case 'done':
                if (chunk.usage) {
                  setTokenCount((prev) => ({
                    input: prev.input + chunk.usage!.inputTokens,
                    output: prev.output + chunk.usage!.outputTokens,
                  }));
                }
                break;
            }
          }

          if (abortController.signal.aborted) break;

          const assistantMsg: Message = {
            role: 'assistant',
            content: assistantContent,
            toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
            timestamp: Date.now(),
          };
          loopMessages = [...loopMessages, assistantMsg];

          if (!toolCalls || toolCalls.length === 0) {
            continueLoop = false;
            break;
          }

          // Execute tool calls
          setState('tool-running');
          for (const toolCall of toolCalls) {
            const context = {
              workingDir: process.cwd(),
              sessionId: session.id,
              permissions,
              hooks,
              settings,
              abortSignal: abortController.signal,
            } as ToolContext;

            const result = await toolRegistry.execute(
              toolCall.name,
              toolCall.input,
              context,
            );
            result.toolCallId = toolCall.id;

            const toolMsg: Message = {
              role: 'tool',
              content: result.content,
              toolCallId: toolCall.id,
              timestamp: Date.now(),
            };
            loopMessages = [...loopMessages, toolMsg];
          }

          setState('streaming');
          setStreamContent('');
        }

        // Final: sync all messages
        const finalAssistant = loopMessages.filter((m) => m.role !== 'user' || m === userMsg);
        allMessages = loopMessages;
        setMessages([...loopMessages]);
        setStreamContent('');
        setState('idle');
      },

      abort: () => {
        abortController.abort();
        setState('idle');
      },

      compact: async () => {
        const { keepMessages, summaryInput } = prepareCompactionPrompt(allMessages);
        if (!summaryInput) return;
        // Use the model to generate the summary
        let summary = '';
        const compactOptions = {
          model: currentModel,
          provider: providerConfig.type,
          messages: [{ role: 'user' as const, content: summaryInput }],
          stream: true,
          maxTokens: 1024,
        } as import('@fridaycode/shared').ChatOptions;
        for await (const chunk of provider.chat(compactOptions)) {
          if (chunk.type === 'text' && chunk.content) {
            summary += chunk.content;
          }
        }
        allMessages = applyCompaction(summary, keepMessages);
        setMessages([...allMessages]);
      },
    };
  }

  const handleSubmit = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Route all slash commands through the unified router
      if (content.startsWith('/')) {
        const handled = await executeCommand(content, {
          cwd: process.cwd(),
          sessionId: undefined,
          model: currentModel,
          provider: currentProvider,
          print: (text) => {
            setMessages((prev) => [
              ...prev,
              { role: 'system', content: text, timestamp: Date.now() },
            ]);
          },
          setModel: (model) => {
            setCurrentModel(model);
          },
          setProvider: (prov) => {
            setCurrentProvider(prov);
          },
          clearMessages: () => {
            setMessages([]);
          },
          exit: () => {
            exit();
          },
          compact: async () => {
            await engineRef.current?.compact();
          },
        });
        if (handled) return;
      }

      if (showWelcome) setShowWelcome(false);

      await engineRef.current?.sendMessage(content);
    },
    [messages, currentModel, currentProvider, showWelcome],
  );

  // Permission prompt handlers
  const handlePermissionAllow = useCallback(() => {
    pendingPermission?.resolve(true);
    setPendingPermission(null);
    setState('tool-running');
  }, [pendingPermission]);

  const handlePermissionDeny = useCallback(() => {
    pendingPermission?.resolve(false);
    setPendingPermission(null);
    setState('idle');
  }, [pendingPermission]);

  const handlePermissionAllowAlways = useCallback(() => {
    pendingPermission?.resolve(true, true);
    setPendingPermission(null);
    setState('tool-running');
  }, [pendingPermission]);

  // Global key handlers
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (state === 'streaming' || state === 'tool-running') {
        engineRef.current?.abort();
      } else {
        exit();
      }
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      {showWelcome && <WelcomeScreen settings={settings} />}

      <Output messages={messages} streamContent={streamContent} state={state} />

      {backgroundTasks.length > 0 && (
        <TaskList tasks={backgroundTasks} visible={true} />
      )}

      {showContext && (
        <ContextViewer
          inputTokens={tokenCount.input}
          outputTokens={tokenCount.output}
          contextLimit={settings.maxTokens * 4}
          messageCount={messages.length}
        />
      )}

      {state === 'permission' && pendingPermission && (
        <PermissionPrompt
          toolName={pendingPermission.toolName}
          input={pendingPermission.input}
          onAllow={handlePermissionAllow}
          onDeny={handlePermissionDeny}
          onAllowAlways={handlePermissionAllowAlways}
        />
      )}

      <StatusBar
        model={currentModel}
        provider={currentProvider}
        tokenCount={tokenCount}
        state={state}
      />

      <Prompt onSubmit={handleSubmit} disabled={state !== 'idle' && state !== 'welcome'} />
    </Box>
  );
}
