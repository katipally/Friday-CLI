import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useStdin } from 'ink';
import type { AgentEvent, AgentMode } from '@fridaycode/core';
import { WelcomeBanner } from './components/WelcomeBanner.js';
import { MessageBubble } from './components/MessageBubble.js';
import { InputBox } from './components/InputBox.js';
import { StatusBar } from './components/StatusBar.js';
import { Spinner } from './components/Spinner.js';
import { ToolOutput } from './components/ToolOutput.js';
import { PermissionPrompt } from './components/PermissionPrompt.js';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolSuccess?: boolean;
  isStreaming?: boolean;
}

interface CommandResult {
  output: string;
  type: 'info' | 'success' | 'error' | 'table';
  exit?: boolean;
}

interface PendingPermission {
  toolCall: { id: string; name: string; arguments: Record<string, unknown> };
  reason: string;
  respond: (choice: 'allow_once' | 'allow_always' | 'deny') => void;
}

interface AppProps {
  version: string;
  model: string;
  provider: string;
  mode: AgentMode;
  projectType?: string;
  onMessage: (message: string) => AsyncGenerator<AgentEvent>;
  onSlashCommand?: (command: string, args: string) => Promise<CommandResult | null>;
}

export const App: React.FC<AppProps> = ({
  version,
  model,
  provider,
  mode,
  projectType,
  onMessage,
  onSlashCommand,
}) => {
  const { exit } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const [totalInputTokens, setTotalInputTokens] = useState(0);
  const [totalOutputTokens, setTotalOutputTokens] = useState(0);
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateLastAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].role === 'assistant' && updated[i].isStreaming) {
          updated[i] = { ...updated[i], content: updated[i].content + content };
          break;
        }
      }
      return updated;
    });
  }, []);

  const finalizeStream = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    );
  }, []);

  const handleSubmit = useCallback(
    async (input: string) => {
      if (isProcessing) return;

      // Handle slash commands
      if (input.startsWith('/')) {
        const [command, ...argParts] = input.slice(1).split(' ');
        if (command === 'exit' || command === 'quit' || command === 'q') {
          exit();
          return;
        }
        if (command === 'clear') {
          setMessages([]);
          return;
        }
        if (onSlashCommand) {
          try {
            const result = await onSlashCommand(command, argParts.join(' '));
            if (result) {
              if (result.exit) {
                exit();
                return;
              }
              addMessage({
                id: `cmd-${Date.now()}`,
                role: 'system',
                content: result.output,
              });
            }
          } catch (err) {
            addMessage({
              id: `cmd-err-${Date.now()}`,
              role: 'system',
              content: `Command error: ${(err as Error).message}`,
            });
          }
          return;
        }
      }

      // Add user message
      const userMsgId = `user-${Date.now()}`;
      addMessage({ id: userMsgId, role: 'user', content: input });

      // Start processing
      setIsProcessing(true);
      const streamId = `assistant-${Date.now()}`;
      setCurrentStreamId(streamId);
      addMessage({ id: streamId, role: 'assistant', content: '', isStreaming: true });

      try {
        const events = onMessage(input);
        for await (const event of events) {
          switch (event.type) {
            case 'text_delta':
              updateLastAssistantMessage(event.content);
              break;

            case 'tool_start':
              addMessage({
                id: `tool-${event.toolCall.id}`,
                role: 'tool',
                content: '',
                toolName: event.toolCall.name,
                toolArgs: event.toolCall.arguments,
              });
              break;

            case 'tool_result':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === `tool-${event.toolCall.id}`
                    ? { ...m, content: event.result.output, toolSuccess: event.result.success }
                    : m,
                ),
              );
              break;

            case 'permission_request':
              setPendingPermission({
                toolCall: event.toolCall,
                reason: event.reason,
                respond: (choice) => {
                  event.respond(choice);
                  setPendingPermission(null);
                },
              });
              break;

            case 'permission_granted':
              // Tool execution will follow via tool_start — no extra message needed
              break;

            case 'permission_denied':
              addMessage({
                id: `perm-denied-${Date.now()}`,
                role: 'system',
                content: `🚫 Permission denied: ${event.toolCall.name} — ${event.reason}`,
              });
              break;

            case 'cost_update':
              setTotalCost(event.entry.totalSessionCost);
              break;

            case 'done':
              setTotalInputTokens((prev) => prev + event.usage.inputTokens);
              setTotalOutputTokens((prev) => prev + event.usage.outputTokens);
              break;

            case 'error':
              addMessage({
                id: `error-${Date.now()}`,
                role: 'system',
                content: `Error: ${event.error.message}`,
              });
              break;

            case 'iteration':
              // Optional: show iteration count for long-running agents
              break;
          }
        }
      } catch (error) {
        addMessage({
          id: `error-${Date.now()}`,
          role: 'system',
          content: `Error: ${(error as Error).message}`,
        });
      } finally {
        finalizeStream();
        setIsProcessing(false);
        setCurrentStreamId(null);
      }
    },
    [isProcessing, onMessage, onSlashCommand, addMessage, updateLastAssistantMessage, finalizeStream, exit],
  );

  return (
    <Box flexDirection="column" width="100%">
      <WelcomeBanner
        version={version}
        model={model}
        provider={provider}
        mode={mode}
        projectType={projectType}
      />

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {messages.map((msg) =>
          msg.role === 'tool' ? (
            <ToolOutput
              key={msg.id}
              toolName={msg.toolName || 'unknown'}
              args={msg.toolArgs}
              output={msg.content || undefined}
              success={msg.toolSuccess}
              isExecuting={!msg.content && msg.toolSuccess === undefined}
            />
          ) : (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              isStreaming={msg.isStreaming}
            />
          ),
        )}
        {isProcessing && !currentStreamId && <Spinner label="Thinking..." />}
      </Box>

      {/* Permission Prompt (rendered inline when a permission is pending) */}
      {pendingPermission && (
        <PermissionPrompt
          toolName={pendingPermission.toolCall.name}
          args={pendingPermission.toolCall.arguments}
          reason={pendingPermission.reason}
          onRespond={(choice) => {
            pendingPermission.respond(choice);
          }}
        />
      )}

      {/* Input */}
      <InputBox
        onSubmit={handleSubmit}
        isDisabled={isProcessing}
        placeholder={isProcessing ? undefined : 'Ask Friday anything... (/ for commands)'}
      />

      {/* Status Bar */}
      <StatusBar
        model={model}
        provider={provider}
        mode={mode}
        cost={totalCost}
        inputTokens={totalInputTokens}
        outputTokens={totalOutputTokens}
        isThinking={isProcessing}
      />
    </Box>
  );
};
