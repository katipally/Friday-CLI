import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Settings, Message, AgentInstance, ToolContext, ModelProvider, Model } from '@fridaycode/shared';
import type { CliOptions } from './index.js';

// Components
import { Output } from './components/Output.js';
import { Prompt } from './components/Prompt.js';
import { StatusLine } from './components/StatusBar.js';
import { WelcomeScreen } from './mascot/welcome.js';
import { PermissionPrompt } from './components/PermissionPrompt.js';
import { TaskList } from './components/TaskList.js';
import { ContextViewer } from './components/ContextViewer.js';
import { ModelSwitcher } from './components/ModelSwitcher.js';

// Systems
import { executeCommand } from './commands/index.js';
import { isOnboarded, markOnboarded, detectOllama } from './onboarding/wizard.js';
import { setTheme } from './themes/engine.js';
// Initialize themes
import './themes/dark.js';
import './themes/light.js';

interface AppProps {
  settings: Settings;
  initialPrompt?: string;
  options: CliOptions;
}

type AppState =
  | 'welcome'
  | 'idle'
  | 'loading'
  | 'streaming'
  | 'tool-running'
  | 'permission'
  | 'model-select'
  | 'error';

interface PendingPermission {
  toolName: string;
  input: Record<string, unknown>;
  resolve: (allowed: boolean, always?: boolean) => void;
}

interface ToolStatus {
  name: string;
  status: 'running' | 'done' | 'error';
}

export function App({ settings, initialPrompt, options }: AppProps) {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>('welcome');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamContent, setStreamContent] = useState('');
  const [tokenCount, setTokenCount] = useState({ input: 0, output: 0 });
  const [showWelcome, setShowWelcome] = useState(!initialPrompt);
  const [currentModel, setCurrentModel] = useState(settings.activeModel);
  const [currentProvider, setCurrentProvider] = useState(settings.activeProvider);
  const [backgroundTasks] = useState<AgentInstance[]>([]);
  const [showContext, setShowContext] = useState(false);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [toolStatus, setToolStatus] = useState<ToolStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [engineReady, setEngineReady] = useState(false);
  const [availableModels, setAvailableModels] = useState<Model[]>([]);

  // Refs for mutable state in closures
  const providerRef = useRef<ModelProvider | null>(null);
  const allMessagesRef = useRef<Message[]>([]);
  const abortRef = useRef<AbortController>(new AbortController());
  const coreRef = useRef<{
    toolRegistry: import('@fridaycode/shared').Tool extends unknown ? any : never;
    permissions: any;
    hooks: any;
    session: any;
    prepareCompactionPrompt: any;
    applyCompaction: any;
  } | null>(null);

  // ─── Initialization ────────────────────────────────────────
  useEffect(() => {
    setTheme(settings.theme);

    if (!isOnboarded() && !initialPrompt) {
      detectOllama().then((found) => {
        if (found && !currentProvider) {
          setCurrentProvider('ollama');
        }
      });
      markOnboarded().catch(() => {});
    }

    initEngine();
  }, []);

  async function initEngine() {
    try {
      const core = await import('@fridaycode/core');

      // Find the provider config - try current, then activeProvider, then first available
      let providerConfig = settings.providers[currentProvider];
      if (!providerConfig) {
        providerConfig = settings.providers[settings.activeProvider];
      }
      if (!providerConfig) {
        // Find first enabled provider
        for (const [, cfg] of Object.entries(settings.providers)) {
          if (cfg && cfg.enabled !== false) {
            providerConfig = cfg;
            break;
          }
        }
      }
      if (!providerConfig) {
        // Fallback: create a default ollama config
        providerConfig = {
          type: 'ollama' as const,
          enabled: true,
          baseUrl: 'http://localhost:11434',
        };
      }

      const provider = core.createProvider(providerConfig);
      providerRef.current = provider;

      const toolRegistry = core.createDefaultToolRegistry();
      const permissionRules = [
        ...settings.permissions.allow.map((t: string) => ({ action: 'allow' as const, tool: t })),
        ...settings.permissions.deny.map((t: string) => ({ action: 'deny' as const, tool: t })),
      ];
      const permissions = new core.PermissionEngine(settings.permissionMode, permissionRules);
      const hooks = new core.HookEngineImpl();
      const session = core.createSession(process.cwd(), 'interactive');

      coreRef.current = {
        toolRegistry,
        permissions,
        hooks,
        session,
        prepareCompactionPrompt: core.prepareCompactionPrompt,
        applyCompaction: core.applyCompaction,
      };

      // Auto-detect model if none set
      if (!currentModel) {
        try {
          const models = await provider.listModels();
          setAvailableModels(models);
          if (models.length > 0) {
            setCurrentModel(models[0].id);
          }
        } catch {
          // Provider might not be available (e.g., Ollama not running)
        }
      }

      setEngineReady(true);

      if (initialPrompt) {
        // Small delay to let React render first
        setTimeout(() => sendMessage(initialPrompt!), 100);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to initialize: ${err.message}`);
      setState('error');
    }
  }

  // ─── Send Message (Agentic Loop) ──────────────────────────
  async function sendMessage(content: string) {
    if (!providerRef.current || !coreRef.current) {
      addSystemMessage('Engine not ready. Please wait...');
      return;
    }

    const provider = providerRef.current;
    const { toolRegistry, permissions, hooks, session } = coreRef.current;

    abortRef.current = new AbortController();
    const userMsg: Message = { role: 'user', content, timestamp: Date.now() };
    allMessagesRef.current = [...allMessagesRef.current, userMsg];
    setMessages((prev) => [...prev, userMsg]);
    setState('streaming');
    setStreamContent('');

    try {
      let loopMessages = [...allMessagesRef.current];
      let continueLoop = true;
      let turns = 0;
      const maxTurns = options.maxTurns ?? settings.compactMessageThreshold ?? 50;

      while (continueLoop && turns < maxTurns) {
        turns++;
        let assistantContent = '';
        let toolCalls: Message['toolCalls'] = [];

        const modelToUse = currentModel || 'llama3.1';

        const chatOptions = {
          model: modelToUse,
          provider: (providerRef.current as any).type ?? currentProvider,
          messages: loopMessages,
          tools: toolRegistry.getDefinitions(),
          stream: true,
          maxTokens: settings.maxTokens,
        } as import('@fridaycode/shared').ChatOptions;

        try {
          for await (const chunk of provider.chat(chatOptions)) {
            if (abortRef.current.signal.aborted) break;

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
              case 'error':
                addSystemMessage(`Error: ${chunk.content}`);
                setState('idle');
                return;
              case 'done':
                if (chunk.usage) {
                  setTokenCount((prev) => ({
                    input: prev.input + (chunk.usage?.inputTokens ?? 0),
                    output: prev.output + (chunk.usage?.outputTokens ?? 0),
                  }));
                }
                break;
            }
          }
        } catch (err: any) {
          const errText = err.message || String(err);
          if (errText.includes('ECONNREFUSED') || errText.includes('fetch failed')) {
            addSystemMessage(`Cannot connect to ${currentProvider}. Is the server running?`);
          } else {
            addSystemMessage(`Provider error: ${errText}`);
          }
          setState('idle');
          return;
        }

        if (abortRef.current.signal.aborted) {
          addSystemMessage('Aborted.');
          break;
        }

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
          setToolStatus({ name: toolCall.name, status: 'running' });

          const context = {
            workingDir: process.cwd(),
            sessionId: session.id,
            permissions,
            hooks,
            settings,
            abortSignal: abortRef.current.signal,
          } as ToolContext;

          try {
            const result = await toolRegistry.execute(
              toolCall.name,
              toolCall.input,
              context,
            );
            result.toolCallId = toolCall.id;
            setToolStatus({ name: toolCall.name, status: 'done' });

            const toolMsg: Message = {
              role: 'tool',
              content: result.content,
              toolCallId: toolCall.id,
              timestamp: Date.now(),
            };
            loopMessages = [...loopMessages, toolMsg];
          } catch (err: any) {
            setToolStatus({ name: toolCall.name, status: 'error' });
            const toolMsg: Message = {
              role: 'tool',
              content: `Error: ${err.message}`,
              toolCallId: toolCall.id,
              timestamp: Date.now(),
            };
            loopMessages = [...loopMessages, toolMsg];
          }
        }

        setState('streaming');
        setStreamContent('');
      }

      allMessagesRef.current = loopMessages;
      setMessages([...loopMessages]);
      setStreamContent('');
      setToolStatus(null);
      setState('idle');
    } catch (err: any) {
      addSystemMessage(`Unexpected error: ${err.message}`);
      setState('idle');
    }
  }

  function addSystemMessage(text: string) {
    setMessages((prev) => [...prev, {
      role: 'system' as const,
      content: text,
      timestamp: Date.now(),
    }]);
  }

  // ─── Compact ───────────────────────────────────────────────
  async function compact() {
    if (!coreRef.current || !providerRef.current) return;
    const { prepareCompactionPrompt, applyCompaction } = coreRef.current;
    const { keepMessages, summaryInput } = prepareCompactionPrompt(allMessagesRef.current);
    if (!summaryInput) {
      addSystemMessage('Nothing to compact.');
      return;
    }
    addSystemMessage('Compacting context...');
    let summary = '';
    const compactOptions = {
      model: currentModel,
      provider: (providerRef.current as any).type ?? currentProvider,
      messages: [{ role: 'user' as const, content: summaryInput }],
      stream: true,
      maxTokens: 1024,
    } as import('@fridaycode/shared').ChatOptions;
    for await (const chunk of providerRef.current.chat(compactOptions)) {
      if (chunk.type === 'text' && chunk.content) {
        summary += chunk.content;
      }
    }
    allMessagesRef.current = applyCompaction(summary, keepMessages);
    setMessages([...allMessagesRef.current]);
    addSystemMessage('Context compacted.');
  }

  // ─── Handle Submit ─────────────────────────────────────────
  const handleSubmit = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Slash commands
      if (content.startsWith('/')) {
        // Special handling for /context toggle
        if (content.trim() === '/context') {
          setShowContext((prev) => !prev);
          return;
        }

        // Handle /model with interactive picker
        if (content.trim() === '/model' && availableModels.length > 0) {
          setState('model-select');
          return;
        }
        // Handle /model with no models cached — try to fetch
        if (content.trim() === '/model' && providerRef.current) {
          try {
            const models = await providerRef.current.listModels();
            setAvailableModels(models);
            if (models.length > 0) {
              setState('model-select');
              return;
            }
          } catch {
            addSystemMessage('Could not fetch models from provider.');
            return;
          }
        }

        const handled = await executeCommand(content, {
          cwd: process.cwd(),
          sessionId: coreRef.current?.session?.id,
          model: currentModel,
          provider: currentProvider,
          print: (text: string) => addSystemMessage(text),
          setModel: (model: string) => setCurrentModel(model),
          setProvider: (prov: string) => setCurrentProvider(prov),
          clearMessages: () => {
            setMessages([]);
            allMessagesRef.current = [];
          },
          exit: () => exit(),
          compact: () => compact(),
        });
        if (handled) return;
      }

      if (showWelcome) setShowWelcome(false);

      await sendMessage(content);
    },
    [currentModel, currentProvider, showWelcome, engineReady, availableModels],
  );

  // ─── Permission Handlers ───────────────────────────────────
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

  // ─── Model Switcher Handlers ───────────────────────────────
  const handleModelSelect = useCallback((modelId: string) => {
    setCurrentModel(modelId);
    addSystemMessage(`Model switched to ${modelId}`);
    setState('idle');
  }, []);

  const handleModelCancel = useCallback(() => {
    setState('idle');
  }, []);

  // ─── Global Keys ──────────────────────────────────────────
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (state === 'streaming' || state === 'tool-running') {
        abortRef.current.abort();
        setState('idle');
      } else {
        exit();
      }
    }
  });

  // ─── Render ────────────────────────────────────────────────
  const isLoading = state === 'streaming' || state === 'loading' || state === 'tool-running';

  return (
    <Box flexDirection="column">
      {/* Welcome screen */}
      {showWelcome && state !== 'model-select' && (
        <WelcomeScreen settings={{...settings, activeModel: currentModel, activeProvider: currentProvider}} cwd={process.cwd()} />
      )}

      {/* Error display */}
      {state === 'error' && errorMsg && (
        <Box marginY={1}>
          <Text color="#F43F5E" bold>Error: </Text>
          <Text>{errorMsg}</Text>
        </Box>
      )}

      {/* Model switcher overlay */}
      {state === 'model-select' && (
        <ModelSwitcher
          models={availableModels}
          currentModel={currentModel}
          onSelect={handleModelSelect}
          onCancel={handleModelCancel}
        />
      )}

      {/* Messages + streaming output */}
      {state !== 'model-select' && (
        <Output
          messages={messages}
          streamContent={streamContent}
          state={state}
          toolStatus={toolStatus ?? undefined}
        />
      )}

      {/* Background tasks */}
      {backgroundTasks.length > 0 && (
        <TaskList tasks={backgroundTasks} visible={true} />
      )}

      {/* Context viewer */}
      {showContext && (
        <ContextViewer
          inputTokens={tokenCount.input}
          outputTokens={tokenCount.output}
          contextLimit={settings.maxTokens * 4}
          messageCount={messages.length}
        />
      )}

      {/* Permission prompt */}
      {state === 'permission' && pendingPermission && (
        <PermissionPrompt
          toolName={pendingPermission.toolName}
          input={pendingPermission.input}
          onAllow={handlePermissionAllow}
          onDeny={handlePermissionDeny}
          onAllowAlways={handlePermissionAllowAlways}
        />
      )}

      {/* Status line + prompt */}
      {state !== 'model-select' && (
        <Box flexDirection="column" marginTop={0}>
          <StatusLine
            model={currentModel}
            provider={currentProvider}
            tokenCount={tokenCount}
            state={state}
          />
          <Prompt
            onSubmit={handleSubmit}
            disabled={state === 'permission' || state === 'error'}
            loading={isLoading}
          />
        </Box>
      )}
    </Box>
  );
}
