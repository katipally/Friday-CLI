import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useStdin } from 'ink';
import type { AgentEvent, AgentMode } from '@anthropic-ai/friday-core';
import { WelcomeBanner } from './components/WelcomeBanner.js';
import { MessageBubble } from './components/MessageBubble.js';
import { InputBox } from './components/InputBox.js';
import { StatusBar } from './components/StatusBar.js';
import { Spinner } from './components/Spinner.js';
import { ToolOutput } from './components/ToolOutput.js';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolSuccess?: boolean;
  isStreaming?: boolean;
}

interface AppProps {
  version: string;
  model: string;
  provider: string;
  mode: AgentMode;
  onMessage: (message: string) => AsyncGenerator<AgentEvent>;
  onSlashCommand?: (command: string, args: string) => void;
}

export const App: React.FC<AppProps> = ({
  version,
  model,
  provider,
  mode,
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
        if (command === 'exit' || command === 'quit') {
          exit();
          return;
        }
        if (command === 'clear') {
          setMessages([]);
          return;
        }
        if (onSlashCommand) {
          onSlashCommand(command, argParts.join(' '));
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
      <WelcomeBanner version={version} model={model} provider={provider} />

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
