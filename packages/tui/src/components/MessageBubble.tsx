import React from 'react';
import { Box, Text } from 'ink';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  isStreaming?: boolean;
  toolName?: string;
}

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
        <Text key={`c${key++}`} color="cyan">
          {match[4]}
        </Text>,
      );
    } else if (match[6]) {
      parts.push(
        <Text key={`i${key++}`} dimColor>
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
      <Box key={`cb${key++}`} flexDirection="column" marginY={0}>
        <Text color="gray" dimColor>
          {`\u2500\u2500 ${lang || 'code'} ${'─'.repeat(40)}`}
        </Text>
        <Box paddingLeft={1}>
          <Text color="greenBright">{code}</Text>
        </Box>
        <Text color="gray" dimColor>
          {'\u2500'.repeat(45)}
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
}) => {
  if (!content && !isStreaming) return null;

  if (role === 'user') {
    return (
      <Box marginBottom={1}>
        <Text color="cyan" bold wrap="wrap">
          {content}
        </Text>
      </Box>
    );
  }

  if (role === 'system') {
    return (
      <Box marginBottom={1} paddingLeft={1}>
        <Text color="gray" wrap="wrap">
          {content}
        </Text>
      </Box>
    );
  }

  // Assistant
  return (
    <Box flexDirection="column" marginBottom={1}>
      {isStreaming && !content && (
        <Text color="gray" dimColor>
          {'\u25CF Thinking...'}
        </Text>
      )}
      <Box flexDirection="column">
        {renderMarkdown(content)}
        {isStreaming && content && (
          <Text color="yellow">{' \u2588'}</Text>
        )}
      </Box>
    </Box>
  );
};
