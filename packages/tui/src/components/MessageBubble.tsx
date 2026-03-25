import React from 'react';
import { Box, Text } from 'ink';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  isStreaming?: boolean;
  toolName?: string;
}

// ---------------------------------------------------------------------------
// Simple regex-based markdown renderer (no external libraries)
// ---------------------------------------------------------------------------

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)|(\*(.+?)\*)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(
        <Text key={`b${key++}`} bold>
          {match[2]}
        </Text>,
      );
    } else if (match[4]) {
      parts.push(
        <Text key={`c${key++}`} color="green">
          {match[4]}
        </Text>,
      );
    } else if (match[6]) {
      parts.push(
        <Text key={`i${key++}`} italic>
          {match[6]}
        </Text>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function renderMarkdown(text: string): React.ReactNode[] {
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const segment = text.slice(lastIndex, match.index);
      if (segment.trim()) {
        elements.push(
          <Text key={`t${key++}`} wrap="wrap">
            {renderInlineMarkdown(segment)}
          </Text>,
        );
      }
    }

    const lang = match[1];
    const code = match[2].trimEnd();
    elements.push(
      <Box key={`cb${key++}`} flexDirection="column" marginY={1}>
        <Text color="gray" dimColor>
          {`── ${lang || 'code'} ${'─'.repeat(20)}`}
        </Text>
        <Box paddingLeft={1}>
          <Text color="greenBright">{code}</Text>
        </Box>
        <Text color="gray" dimColor>
          {'─'.repeat(25)}
        </Text>
      </Box>,
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining.trim()) {
      elements.push(
        <Text key={`t${key++}`} wrap="wrap">
          {renderInlineMarkdown(remaining)}
        </Text>,
      );
    }
  }

  if (elements.length === 0) {
    elements.push(
      <Text key="full" wrap="wrap">
        {renderInlineMarkdown(text)}
      </Text>,
    );
  }

  return elements;
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
        {role === 'assistant' ? (
          renderMarkdown(content)
        ) : (
          <Text wrap="wrap">{content}</Text>
        )}
      </Box>
    </Box>
  );
};
