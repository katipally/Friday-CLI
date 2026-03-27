import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, Static, useInput, useApp } from 'ink';
import type { Settings, Message, AgentInstance, ToolContext, ModelProvider, Model, Session } from '@fridaycode/shared';
import type { CliOptions } from './index.js';

// Components
import { Output } from './components/Output.js';
import { MessageRow } from './components/Output.js';
import { Prompt } from './components/Prompt.js';
import { StatusLine } from './components/StatusBar.js';
import { WelcomeScreen } from './branding/welcome.js';
import { PermissionPrompt } from './components/PermissionPrompt.js';
import { TaskList } from './components/TaskList.js';
import { ContextViewer } from './components/ContextViewer.js';
import { ModelSwitcher } from './components/ModelSwitcher.js';

// Systems
import { executeCommand } from './commands/index.js';
import { isOnboarded, markOnboarded, detectOllama } from './onboarding/wizard.js';
import { setTheme } from './themes/engine.js';
import { getPromptBarColor } from './branding/spinner.js';
// Initialize themes
import './themes/dark.js';
import './themes/light.js';
import './themes/cyberpunk.js';
import './themes/dracula.js';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
  const [backgroundTasks, setBackgroundTasks] = useState<AgentInstance[]>([]);
  const [showContext, setShowContext] = useState(false);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [toolStatus, setToolStatus] = useState<ToolStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [engineReady, setEngineReady] = useState(false);
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  // New UI state
  const [permissionMode, setPermissionMode] = useState<'default' | 'acceptAll' | 'plan'>('default');
  const [verbose, setVerbose] = useState(false);
  const [turnDuration, setTurnDuration] = useState(0);
  const [gitBranch, setGitBranch] = useState('');
  const [promptSuggestion, setPromptSuggestion] = useState('');
  const [sessionName, setSessionName] = useState<string | undefined>(undefined);

  // Track completed messages for Static rendering (perf optimization)
  const [completedMsgCount, setCompletedMsgCount] = useState(0);

  // Refs for mutable state in closures
  const providerRef = useRef<ModelProvider | null>(null);
  const allMessagesRef = useRef<Message[]>([]);
  const abortRef = useRef<AbortController>(new AbortController());
  const sessionRef = useRef<Session | null>(null);
  const memoryContextRef = useRef<string>('');
  const coreRef = useRef<{
    toolRegistry: import('@fridaycode/shared').Tool extends unknown ? any : never;
    permissions: any;
    hooks: any;
    sessionMod: any;
    prepareCompactionPrompt: any;
    applyCompaction: any;
    agentEngine: any;
    estimateTokenCount: any;
    mcpManager: any;
    pluginRegistry: any;
    pluginLifecycle: any;
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

    // Detect git branch
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        timeout: 2000,
      }).trim();
      setGitBranch(branch);
    } catch { /* not in a git repo */ }

    initEngine();
  }, []);

  // Commit messages to static rendering when a turn completes
  useEffect(() => {
    if ((state === 'idle' || state === 'welcome') && messages.length > completedMsgCount) {
      setCompletedMsgCount(messages.length);
    }
  }, [state, messages.length]);

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

      // Register settings-defined hooks
      if (settings.hooks) {
        for (const [event, defs] of Object.entries(settings.hooks)) {
          for (const def of defs) {
            hooks.register({ ...def, event: event as any });
          }
        }
      }

      // Create or resume session
      let session: Session;
      if (options.session) {
        const resumed = core.resumeSession(process.cwd(), options.session);
        if (resumed) {
          session = resumed;
          allMessagesRef.current = resumed.messages;
          setMessages(resumed.messages);
          setShowWelcome(false);
        } else {
          session = core.createSession(process.cwd(), 'interactive');
        }
      } else if (options.resume) {
        const sessions = core.listSessions(process.cwd());
        if (sessions.length > 0) {
          const resumed = core.resumeSession(process.cwd(), sessions[0].id);
          if (resumed) {
            session = resumed;
            allMessagesRef.current = resumed.messages;
            setMessages(resumed.messages);
            setShowWelcome(false);
          } else {
            session = core.createSession(process.cwd(), 'interactive');
          }
        } else {
          session = core.createSession(process.cwd(), 'interactive');
        }
      } else {
        session = core.createSession(process.cwd(), 'interactive');
      }
      sessionRef.current = session;
      setSessionName(session.name);

      // Dispatch SessionStart hook
      hooks.dispatch({ event: 'SessionStart', sessionId: session.id }).catch(() => {});

      // Load memory context (FRIDAY.md + auto-memory + rules)
      try {
        const memoryFiles = core.loadMemoryFiles(process.cwd());
        const memContext = core.resolveImports(memoryFiles);
        const autoMemory = core.loadAutoMemory(process.cwd());
        const parts: string[] = [];
        if (memContext) parts.push(memContext);
        if (autoMemory) parts.push(`\n# Auto-learned context\n${autoMemory}`);
        memoryContextRef.current = parts.join('\n');
      } catch {
        // Memory loading is non-critical
      }

      // Create AgentEngine for background tasks
      const agentEngine = new core.AgentEngine({
        provider,
        toolRegistry,
        settings,
        onStream: (chunk, agentId) => {
          // Could update background task UI here
        },
        onMessage: (message, agentId) => {
          // Could log background messages here
        },
      });

      coreRef.current = {
        toolRegistry,
        permissions,
        hooks,
        sessionMod: core,
        prepareCompactionPrompt: core.prepareCompactionPrompt,
        applyCompaction: core.applyCompaction,
        agentEngine,
        estimateTokenCount: core.estimateTokenCount,
        mcpManager: null,
        pluginRegistry: null,
        pluginLifecycle: null,
      };

      // Initialize MCP servers (non-blocking)
      if (settings.mcpServers && Object.keys(settings.mcpServers).length > 0) {
        const mcpManager = new core.McpServerManager(settings.mcpServers);
        coreRef.current.mcpManager = mcpManager;
        mcpManager.connectAll().then((statuses: import('@fridaycode/core').McpServerStatus[]) => {
          const connected = statuses.filter((s: import('@fridaycode/core').McpServerStatus) => s.connected);
          if (connected.length > 0) {
            // Register MCP tools into toolRegistry
            const mcpTools = mcpManager.createToolAdapters();
            for (const tool of mcpTools) {
              toolRegistry.register(tool);
            }
          }
        }).catch(() => { /* MCP init is non-critical */ });
      }

      // Initialize plugins (non-blocking)
      try {
        const pluginRegistry = new core.PluginRegistry();
        const pluginLifecycle = new core.PluginLifecycle(pluginRegistry, hooks);
        coreRef.current.pluginRegistry = pluginRegistry;
        coreRef.current.pluginLifecycle = pluginLifecycle;
        pluginLifecycle.initialize(process.cwd()).catch(() => { /* plugin init non-critical */ });
      } catch { /* plugins non-critical */ }

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
    const { toolRegistry, permissions, hooks, sessionMod } = coreRef.current;

    abortRef.current = new AbortController();
    const userMsg: Message = { role: 'user', content, timestamp: Date.now() };
    allMessagesRef.current = [...allMessagesRef.current, userMsg];
    setMessages((prev) => [...prev, userMsg]);

    // Persist to session
    if (sessionRef.current && sessionMod) {
      try { sessionMod.appendMessage(sessionRef.current, userMsg); } catch { /* non-critical */ }
    }

    setState('streaming');
    setStreamContent('');
    setTurnDuration(0);
    const turnStart = Date.now();

    try {
      let loopMessages = [...allMessagesRef.current];
      let continueLoop = true;
      let turns = 0;
      const maxTurns = options.maxTurns ?? settings.compactMessageThreshold ?? 50;

      // Inject memory context as system message if first turn
      if (memoryContextRef.current && loopMessages.length <= 2) {
        loopMessages = [
          { role: 'system' as const, content: memoryContextRef.current, timestamp: Date.now() },
          ...loopMessages,
        ];
      }

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

        // Persist assistant message to session
        if (sessionRef.current && coreRef.current?.sessionMod) {
          try { coreRef.current.sessionMod.appendMessage(sessionRef.current, assistantMsg); } catch { /* non-critical */ }
        }

        if (!toolCalls || toolCalls.length === 0) {
          continueLoop = false;
          break;
        }

        // Execute tool calls
        setState('tool-running');
        for (const toolCall of toolCalls) {
          setToolStatus({ name: toolCall.name, status: 'running' });

          // Dispatch PreToolUse hook
          hooks.dispatch({ event: 'PreToolUse', toolName: toolCall.name, toolInput: toolCall.input, sessionId: sessionRef.current?.id }).catch(() => {});

          const context = {
            workingDir: process.cwd(),
            sessionId: sessionRef.current?.id ?? '',
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

            // Dispatch PostToolUse hook
            hooks.dispatch({ event: 'PostToolUse', toolName: toolCall.name, toolResult: result, sessionId: sessionRef.current?.id }).catch(() => {});

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
      setTurnDuration(Date.now() - turnStart);

      // Auto-compaction notification
      if (coreRef.current?.estimateTokenCount && !settings.disableAutoCompact) {
        const estimatedTokens = coreRef.current.estimateTokenCount(loopMessages);
        const threshold = (settings.maxTokens ?? 8192) * 3; // warn at ~75% of a 4x context window
        if (estimatedTokens > threshold) {
          addSystemMessage(`◆ Context is getting large (~${Math.round(estimatedTokens / 1000)}k tokens). Consider /compact to summarize.`);
        }
      }

      // Show a prompt suggestion after response
      const suggestions = [
        'Try: "explain this code"',
        'Try: "what could be improved?"',
        'Try: "write tests for this"',
        'Try: /diff to see changes',
        'Try: /compact if context is large',
      ];
      setPromptSuggestion(suggestions[Math.floor(Math.random() * suggestions.length)]);
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

  // ─── @ File Mention Expansion ────────────────────────────
  function expandFileMentions(content: string): string {
    // Match @path/to/file patterns
    const mentionRegex = /@([\w./_-]+\.\w+)/g;
    let expanded = content;
    let match: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((match = mentionRegex.exec(content)) !== null) {
      const filePath = match[1];
      if (seen.has(filePath)) continue;
      seen.add(filePath);

      const resolved = path.resolve(process.cwd(), filePath);
      try {
        if (fs.existsSync(resolved)) {
          const fileContent = fs.readFileSync(resolved, 'utf-8');
          const truncated = fileContent.length > 10000
            ? fileContent.slice(0, 10000) + '\n...(truncated)'
            : fileContent;
          expanded += `\n\n<file path="${filePath}">\n${truncated}\n</file>`;
        }
      } catch { /* file not readable, skip */ }
    }

    return expanded;
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
          sessionId: sessionRef.current?.id,
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
          resumeSession: (sessionId: string) => {
            if (!coreRef.current?.sessionMod) return;
            const resumed = coreRef.current.sessionMod.resumeSession(process.cwd(), sessionId);
            if (resumed) {
              sessionRef.current = resumed;
              allMessagesRef.current = resumed.messages;
              setMessages(resumed.messages);
              setSessionName(resumed.name);
            }
          },
          renameSession: (name: string) => {
            if (sessionRef.current) {
              sessionRef.current.name = name;
              setSessionName(name);
              if (coreRef.current?.sessionMod) {
                coreRef.current.sessionMod.saveSession(sessionRef.current);
              }
            }
          },
          rewindToMessage: (index: number) => {
            if (sessionRef.current && coreRef.current?.sessionMod) {
              coreRef.current.sessionMod.rewindSession(sessionRef.current, index);
              allMessagesRef.current = sessionRef.current.messages;
              setMessages([...sessionRef.current.messages]);
            } else {
              allMessagesRef.current = allMessagesRef.current.slice(0, index);
              setMessages([...allMessagesRef.current]);
            }
          },
          forkSession: () => {
            if (sessionRef.current && coreRef.current?.sessionMod) {
              const forked = coreRef.current.sessionMod.forkSession(sessionRef.current);
              sessionRef.current = forked;
              setSessionName(forked.name);
            }
          },
          getMessageCount: () => allMessagesRef.current.length,
          sendMessage: (prompt: string) => {
            setTimeout(() => sendMessage(prompt), 50);
          },
          setPermissionMode: (mode: 'default' | 'acceptAll' | 'plan') => {
            setPermissionMode(mode);
          },
          toggleVerbose: () => {
            setVerbose(v => {
              addSystemMessage(!v ? 'Verbose mode on' : 'Verbose mode off');
              return !v;
            });
          },
          getTokenCount: () => tokenCount,
          getMcpManager: () => coreRef.current?.mcpManager,
          getHooks: () => coreRef.current?.hooks,
          getPluginRegistry: () => coreRef.current?.pluginRegistry,
          getPluginLifecycle: () => coreRef.current?.pluginLifecycle,
        });
        if (handled) return;
      }

      if (showWelcome) setShowWelcome(false);

      // Expand @ file mentions
      const expanded = expandFileMentions(content);
      await sendMessage(expanded);
    },
    [currentModel, currentProvider, showWelcome, engineReady, availableModels, tokenCount],
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
    // Ctrl+O: Toggle verbose mode
    if (key.ctrl && input === 'o') {
      setVerbose(v => !v);
      addSystemMessage(verbose ? 'Verbose mode off' : 'Verbose mode on');
    }
    // Ctrl+T: Toggle context viewer
    if (key.ctrl && input === 't') {
      setShowContext(prev => !prev);
    }
    // Shift+Tab: Cycle permission modes
    if (key.shift && key.tab) {
      setPermissionMode(prev => {
        const modes: ('default' | 'acceptAll' | 'plan')[] = ['default', 'acceptAll', 'plan'];
        const idx = modes.indexOf(prev);
        const next = modes[(idx + 1) % modes.length];
        addSystemMessage(`Permission mode → ${next}`);
        return next;
      });
    }
    // Ctrl+B: Show background tasks
    if (key.ctrl && input === 'b') {
      const engine = coreRef.current?.agentEngine;
      if (engine) {
        const instances = engine.getAllInstances();
        const running = instances.filter((i: AgentInstance) => i.status === 'running');
        if (running.length === 0) {
          addSystemMessage('No background tasks running.');
        } else {
          const lines = running.map((i: AgentInstance) =>
            `  ${i.id.slice(0, 8)}  ${i.definition.name ?? 'task'}  ${i.status}`
          );
          addSystemMessage('Background tasks:\n' + lines.join('\n'));
        }
        setBackgroundTasks(instances);
      } else {
        addSystemMessage('No background tasks running.');
      }
    }
  });

  // ─── Render ────────────────────────────────────────────────
  const isLoading = state === 'streaming' || state === 'loading' || state === 'tool-running';

  // Split messages: completed (Static) vs active (dynamic)
  const completedMessages = messages.slice(0, completedMsgCount);
  const activeMessages = messages.slice(completedMsgCount);

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

      {/* Completed messages — permanently rendered, never re-rendered (perf win) */}
      {state !== 'model-select' && completedMessages.length > 0 && (
        <Static items={completedMessages}>
          {(msg, i) => (
            <Box key={`msg-${i}-${msg.timestamp ?? i}`}>
              <MessageRow message={msg} verbose={verbose} />
            </Box>
          )}
        </Static>
      )}

      {/* Active messages + streaming output (dynamic, re-rendered each frame) */}
      {state !== 'model-select' && (
        <Output
          messages={activeMessages}
          streamContent={streamContent}
          state={state}
          toolStatus={toolStatus ?? undefined}
          verbose={verbose}
          turnStartTime={turnDuration > 0 ? turnDuration : undefined}
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

      {/* Tmux-style status bar + prompt (always at bottom) */}
      {state !== 'model-select' && (
        <Box flexDirection="column" marginTop={0}>
          <StatusLine
            model={currentModel}
            provider={currentProvider}
            tokenCount={tokenCount}
            state={state}
            gitBranch={gitBranch}
            permissionMode={permissionMode}
            turnDuration={turnDuration}
            sessionName={sessionName}
            mcpServerCount={coreRef.current?.mcpManager?.getConnectedServers()?.length}
          />
          <Prompt
            onSubmit={handleSubmit}
            disabled={state === 'permission' || state === 'error'}
            loading={isLoading}
            permissionMode={permissionMode}
            suggestion={promptSuggestion}
            availableModels={availableModels.map(m => m.id)}
          />
        </Box>
      )}
    </Box>
  );
}
