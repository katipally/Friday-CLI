import React from 'react';
import { Box, Text } from 'ink';
import type { Message } from '@fridaycode/shared';

interface OutputProps {
  messages: Message[];
  streamContent: string;
  state: string;
  toolStatus?: { name: string; status: 'running' | 'done' | 'error' };
}

export function Output({ messages, streamContent, state, toolStatus }: OutputProps) {
  return (
    <Box flexDirection="column" paddingX={0}>
      {messages.map((msg, i) => (
        <MessageRow key={i} message={msg} />
      ))}

      {/* Streaming response */}
      {state === 'streaming' && streamContent && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="#A3E635" bold>{'◆ Friday'}</Text>
          <Box marginLeft={2} marginTop={0}>
            <Text>{streamContent}</Text>
            <Text color="#8B5CF6">{'▍'}</Text>
          </Box>
        </Box>
      )}

      {/* Tool running indicator */}
      {state === 'tool-running' && toolStatus && (
        <Box marginLeft={2} marginTop={0}>
          <Text>
            <Text color="#8B5CF6">{'  ⏵ '}</Text>
            <Text dimColor>{toolStatus.name}</Text>
            {toolStatus.status === 'running' && <Text color="#8B5CF6">{' ...'}</Text>}
            {toolStatus.status === 'done' && <Text color="#A3E635">{' ✓'}</Text>}
            {toolStatus.status === 'error' && <Text color="#F43F5E">{' ✗'}</Text>}
          </Text>
        </Box>
      )}

      {/* Loading/thinking */}
      {state === 'loading' && (
        <Box marginTop={1}>
          <Text color="#8B5CF6">{'◆ '}</Text>
          <Text dimColor>Thinking...</Text>
        </Box>
      )}
    </Box>
  );
}

function MessageRow({ message }: { message: Message }) {
  const content = typeof message.content === 'string'
    ? message.content
    : Array.isArray(message.content)
      ? message.content.map((b) => b.text ?? b.content ?? '').join('')
      : JSON.stringify(message.content);

  switch (message.role) {
    case 'user':
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="#8B5CF6" bold>{'❯ You'}</Text>
          <Box marginLeft={2}>
            <Text>{content}</Text>
          </Box>
        </Box>
      );

    case 'assistant':
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="#A3E635" bold>{'◆ Friday'}</Text>
          <Box marginLeft={2} flexDirection="column">
            <Text>{content}</Text>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <Box flexDirection="column" marginTop={0}>
                {message.toolCalls.map((tc, i) => (
                  <ToolCallRow key={i} name={tc.name} input={tc.input} />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      );

    case 'tool':
      return (
        <Box marginLeft={2} marginTop={0}>
          <Text dimColor>
            {'  '}
            {content.length > 300 ? content.slice(0, 300) + '…' : content}
          </Text>
        </Box>
      );

    case 'system':
      return (
        <Box marginTop={1}>
          <Text color="#64748B" italic>{'  '}{content}</Text>
        </Box>
      );

    default:
      return null;
  }
}

function ToolCallRow({ name, input }: { name: string; input: Record<string, unknown> }) {
  // Show a compact summary of the tool call
  const summary = formatToolInput(name, input);
  return (
    <Box marginTop={0}>
      <Text>
        <Text color="#8B5CF6">{'⏵ '}</Text>
        <Text color="#22D3EE" bold>{name}</Text>
        {summary && <Text dimColor>{' '}{summary}</Text>}
        <Text color="#A3E635">{' ✓'}</Text>
      </Text>
    </Box>
  );
}

function formatToolInput(name: string, input: Record<string, unknown>): string {
  // Show the most relevant parameter based on tool type
  if (input.command && typeof input.command === 'string') {
    return truncate(input.command, 60);
  }
  if (input.path && typeof input.path === 'string') {
    return truncate(String(input.path), 60);
  }
  if (input.pattern && typeof input.pattern === 'string') {
    return truncate(String(input.pattern), 60);
  }
  if (input.query && typeof input.query === 'string') {
    return truncate(String(input.query), 60);
  }
  if (input.content && typeof input.content === 'string') {
    return truncate(input.content, 40);
  }
  const keys = Object.keys(input);
  if (keys.length === 0) return '';
  return keys.join(', ');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}
