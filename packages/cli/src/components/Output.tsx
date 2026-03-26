import React from 'react';
import { Box, Text } from 'ink';
import type { Message } from '@fridaycode/shared';
import { COLORS } from '@fridaycode/shared';

interface OutputProps {
  messages: Message[];
  streamContent: string;
  state: string;
}

export function Output({ messages, streamContent, state }: OutputProps) {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}

      {state === 'streaming' && streamContent && (
        <Box marginY={1}>
          <Text color={COLORS.icySlate}>{streamContent}</Text>
          <Text color={COLORS.deepViolet}>{'▊'}</Text>
        </Box>
      )}

      {state === 'tool-running' && (
        <Box marginY={1}>
          <Text color={COLORS.acidicPistachio}>⟳ Running tool...</Text>
        </Box>
      )}

      {state === 'loading' && (
        <Box marginY={1}>
          <Text color={COLORS.deepViolet}>● Thinking...</Text>
        </Box>
      )}
    </Box>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

  switch (message.role) {
    case 'user':
      return (
        <Box marginY={1}>
          <Text color={COLORS.deepViolet} bold>
            You:{' '}
          </Text>
          <Text>{content}</Text>
        </Box>
      );

    case 'assistant':
      return (
        <Box marginY={1} flexDirection="column">
          <Text color={COLORS.acidicPistachio} bold>
            Friday:
          </Text>
          <Box marginLeft={2}>
            <Text color={COLORS.icySlate}>{content}</Text>
          </Box>
          {message.toolCalls && message.toolCalls.length > 0 && (
            <Box marginLeft={2} marginTop={1}>
              {message.toolCalls.map((tc, i) => (
                <Text key={i} color={COLORS.starkRose} dimColor>
                  ⚡ {tc.name}({Object.keys(tc.input).join(', ')})
                </Text>
              ))}
            </Box>
          )}
        </Box>
      );

    case 'tool':
      return (
        <Box marginY={0} marginLeft={4}>
          <Text color={COLORS.midnightSlate} dimColor>
            📎 {content.length > 200 ? content.slice(0, 200) + '...' : content}
          </Text>
        </Box>
      );

    case 'system':
      return (
        <Box marginY={1}>
          <Text color={COLORS.starkRose} italic>
            {content}
          </Text>
        </Box>
      );

    default:
      return null;
  }
}
