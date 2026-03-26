import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../theme.js';

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
      parts.push(<Text key={key++} bold>{match[2]}</Text>);
    } else if (match[4]) {
      parts.push(<Text key={key++} color="cyan" bold>{`\`${match[4]}\``}</Text>);
    } else if (match[6]) {
      parts.push(<Text key={key++} italic dimColor>{match[6]}</Text>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

function renderMarkdown(text: string): React.ReactNode[] {
  const t = getTheme();
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const segment = text.slice(lastIndex, match.index).trim();
      if (segment) {
        for (const line of segment.split('\n')) {
          if (line.startsWith('# ')) {
            elements.push(<Text key={`t${key++}`} bold color={t.colors.primary}>{line.slice(2)}</Text>);
          } else if (line.startsWith('## ')) {
            elements.push(<Text key={`t${key++}`} bold>{line.slice(3)}</Text>);
          } else if (line.startsWith('- ') || line.startsWith('* ')) {
            elements.push(<Text key={`t${key++}`} wrap="wrap">  • {renderInlineMarkdown(line.slice(2))}</Text>);
          } else if (/^\d+\. /.test(line)) {
            const num = line.match(/^(\d+)\. /)?.[1];
            elements.push(<Text key={`t${key++}`} wrap="wrap">  {num}. {renderInlineMarkdown(line.replace(/^\d+\. /, ''))}</Text>);
          } else {
            elements.push(<Text key={`t${key++}`} wrap="wrap">{renderInlineMarkdown(line)}</Text>);
          }
        }
      }
    }
    const lang = match[1] || '';
    const code = match[2].trimEnd();
    const lines = code.split('\n');
    const gutterWidth = String(lines.length).length;
    elements.push(
      <Box key={`cb${key++}`} flexDirection="column" marginLeft={2} marginY={0}>
        <Text color={t.colors.muted}>{'╭─' + (lang ? ` ${lang} ` : '') + '─'.repeat(Math.max(0, 48 - lang.length))  + '╮'}</Text>
        {lines.map((line, i) => (
          <Text key={i} wrap="wrap">
            <Text color={t.colors.muted}>{'│'}</Text>
            <Text color={t.colors.muted}>{` ${String(i + 1).padStart(gutterWidth)} `}</Text>
            <Text color={t.colors.codeFunction}>{line}</Text>
          </Text>
        ))}
        <Text color={t.colors.muted}>{'╰' + '─'.repeat(51 + gutterWidth) + '╯'}</Text>
      </Box>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) {
      for (const line of remaining.split('\n')) {
        if (line.startsWith('# ')) {
          elements.push(<Text key={`t${key++}`} bold color={t.colors.primary}>{line.slice(2)}</Text>);
        } else if (line.startsWith('## ')) {
          elements.push(<Text key={`t${key++}`} bold>{line.slice(3)}</Text>);
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          elements.push(<Text key={`t${key++}`} wrap="wrap">  • {renderInlineMarkdown(line.slice(2))}</Text>);
        } else if (/^\d+\. /.test(line)) {
          const num = line.match(/^(\d+)\. /)?.[1];
          elements.push(<Text key={`t${key++}`} wrap="wrap">  {num}. {renderInlineMarkdown(line.replace(/^\d+\. /, ''))}</Text>);
        } else {
          elements.push(<Text key={`t${key++}`} wrap="wrap">{renderInlineMarkdown(line)}</Text>);
        }
      }
    }
  }

  if (elements.length === 0 && text.trim()) {
    for (const line of text.split('\n')) {
      elements.push(<Text key={`t${key++}`} wrap="wrap">{renderInlineMarkdown(line)}</Text>);
    }
  }

  return elements;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  role,
  content,
  isStreaming = false,
}) => {
  const t = getTheme();

  if (!content && !isStreaming) return null;

  // User message
  if (role === 'user') {
    return (
      <Box marginBottom={1}>
        <Text color={t.colors.primary} bold>❯ </Text>
        <Text bold wrap="wrap">{content}</Text>
      </Box>
    );
  }

  // System message (slash command output, errors)
  if (role === 'system') {
    const isError = content.startsWith('Error:') || content.startsWith('Command error:');
    return (
      <Box marginBottom={1} marginLeft={2}>
        <Text color={isError ? t.colors.error : t.colors.muted} wrap="wrap">{content}</Text>
      </Box>
    );
  }

  // Assistant message
  return (
    <Box flexDirection="column" marginBottom={1} marginLeft={2}>
      {isStreaming && !content && (
        <Text color={t.colors.muted}>⠋ Thinking...</Text>
      )}
      {content && renderMarkdown(content)}
      {isStreaming && content && <Text color={t.colors.warning}>█</Text>}
    </Box>
  );
};
