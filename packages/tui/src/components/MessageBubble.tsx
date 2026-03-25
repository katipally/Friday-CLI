import React from 'react';
import { Box, Text } from 'ink';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  isStreaming?: boolean;
  toolName?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  role,
  content,
  isStreaming = false,
  toolName,
}) => {
  const getRoleDisplay = () => {
    switch (role) {
      case 'user':
        return { icon: '👤', color: 'cyan' as const, label: 'You' };
      case 'assistant':
        return { icon: '🤖', color: 'green' as const, label: 'Friday' };
      case 'tool':
        return { icon: '🔧', color: 'yellow' as const, label: toolName || 'Tool' };
      case 'system':
        return { icon: 'ℹ️', color: 'gray' as const, label: 'System' };
    }
  };

  const display = getRoleDisplay();

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1}>
        <Text>{display.icon}</Text>
        <Text color={display.color} bold>
          {display.label}
        </Text>
        {isStreaming && <Text color="yellow">●</Text>}
      </Box>
      <Box marginLeft={3} flexDirection="column">
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
};
