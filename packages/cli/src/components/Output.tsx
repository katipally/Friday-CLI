import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Message } from '@fridaycode/shared';

interface OutputProps {
  messages: Message[];
  streamContent: string;
  state: string;
  toolStatus?: { name: string; status: 'running' | 'done' | 'error' };
  verbose?: boolean;
  turnStartTime?: number;
}

export function Output({ messages, streamContent, state, toolStatus, verbose, turnStartTime }: OutputProps) {
  return (
    <Box flexDirection="column" paddingX={0}>
      {messages.map((msg, i) => (
        <MessageRow key={i} message={msg} verbose={verbose} />
      ))}

      {/* Streaming response */}
      {state === 'streaming' && streamContent && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="#A3E635" bold>{'◆ Friday'}</Text>
          <Box marginLeft={2} marginTop={0} flexDirection="column">
            <RichText content={streamContent} />
            <Text color="#8B5CF6">{'▍'}</Text>
          </Box>
        </Box>
      )}

      {/* Tool running indicator */}
      {state === 'tool-running' && toolStatus && (
        <Box marginLeft={2} marginTop={0}>
          <ToolStatusIndicator name={toolStatus.name} status={toolStatus.status} />
        </Box>
      )}

      {/* Loading/thinking with animation */}
      {state === 'loading' && (
        <Box marginTop={1}>
          <Text color="#8B5CF6">{'◆ '}</Text>
          <ThinkingDots />
        </Box>
      )}
    </Box>
  );
}

// ─── Thinking Animation ──────────────────────────────────────
function ThinkingDots() {
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => setFrame(f => f + 1), 300);
    return () => clearInterval(interval);
  }, []);

  const dots = '.'.repeat((frame % 3) + 1).padEnd(3);
  const colors = ['#8B5CF6', '#A78BFA', '#22D3EE'];
  const color = colors[frame % colors.length];

  return <Text color={color} italic>Thinking{dots}</Text>;
}

// ─── Tool Status Indicator ───────────────────────────────────
function ToolStatusIndicator({ name, status }: { name: string; status: 'running' | 'done' | 'error' }) {
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    if (status !== 'running') return;
    const interval = setInterval(() => setFrame(f => f + 1), 100);
    return () => clearInterval(interval);
  }, [status]);

  const spinChars = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
  const spin = status === 'running' ? spinChars[frame % spinChars.length] : '';

  return (
    <Text>
      {status === 'running' && <Text color="#8B5CF6">{spin} </Text>}
      {status === 'done' && <Text color="#A3E635">{'✓ '}</Text>}
      {status === 'error' && <Text color="#F43F5E">{'✗ '}</Text>}
      <Text color="#22D3EE" bold>{name}</Text>
      {status === 'running' && <Text dimColor>{' running...'}</Text>}
    </Text>
  );
}

// ─── Rich Text Rendering (Markdown-lite) ─────────────────────
function RichText({ content }: { content: string }) {
  const lines = content.split('\n');
  const rendered: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];
  let codeBlockStarted = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block fence
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trimStart().slice(3).trim();
        codeLines = [];
        codeBlockStarted = true;
        continue;
      } else {
        // End code block
        rendered.push(
          <CodeBlock key={`code-${i}`} language={codeLang} lines={codeLines} />
        );
        inCodeBlock = false;
        codeLang = '';
        codeLines = [];
        codeBlockStarted = false;
        continue;
      }
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      rendered.push(<Text key={i} color="#22D3EE" bold>{line.slice(4)}</Text>);
      continue;
    }
    if (line.startsWith('## ')) {
      rendered.push(<Text key={i} color="#8B5CF6" bold>{line.slice(3)}</Text>);
      continue;
    }
    if (line.startsWith('# ')) {
      rendered.push(<Text key={i} color="#8B5CF6" bold underline>{line.slice(2)}</Text>);
      continue;
    }

    // Bullet lists
    if (line.match(/^\s*[-*]\s/)) {
      const indent = line.search(/[^\s]/);
      rendered.push(
        <Text key={i}>
          {' '.repeat(indent)}
          <Text color="#8B5CF6">{'•'}</Text>
          <Text>{line.slice(indent + 2)}</Text>
        </Text>
      );
      continue;
    }

    // Numbered lists
    if (line.match(/^\s*\d+\.\s/)) {
      const match = line.match(/^(\s*)(\d+\.)\s(.*)$/);
      if (match) {
        rendered.push(
          <Text key={i}>
            {match[1]}
            <Text color="#FBBF24">{match[2]}</Text>
            <Text>{' '}{match[3]}</Text>
          </Text>
        );
        continue;
      }
    }

    // Horizontal rule
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      rendered.push(<Text key={i} dimColor>{'─'.repeat(40)}</Text>);
      continue;
    }

    // Bold and inline code
    rendered.push(<InlineFormatted key={i} text={line} />);
  }

  // If we're still in a code block (unclosed), render what we have
  if (inCodeBlock && codeLines.length > 0) {
    rendered.push(
      <CodeBlock key="code-end" language={codeLang} lines={codeLines} />
    );
  }

  return <Box flexDirection="column">{rendered}</Box>;
}

// ─── Code Block with syntax coloring ─────────────────────────
function CodeBlock({ language, lines }: { language: string; lines: string[] }) {
  return (
    <Box flexDirection="column" marginY={0} marginLeft={1}>
      {language && (
        <Text color="#64748B" dimColor>{' '}{language}</Text>
      )}
      <Box flexDirection="column" paddingLeft={1}>
        {lines.map((line, i) => (
          <Text key={i}>
            <Text color="#475569">{String(i + 1).padStart(3)} </Text>
            <SyntaxLine line={line} language={language} />
          </Text>
        ))}
      </Box>
    </Box>
  );
}

// ─── Basic Syntax Highlighting ────────────────────────────────
function SyntaxLine({ line, language }: { line: string; language: string }) {
  // Keywords for common languages
  const keywords = new Set([
    'import', 'export', 'from', 'const', 'let', 'var', 'function', 'return',
    'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'this',
    'async', 'await', 'try', 'catch', 'throw', 'switch', 'case', 'break',
    'default', 'type', 'interface', 'enum', 'implements', 'abstract',
    'def', 'elif', 'pass', 'with', 'as', 'yield', 'lambda', 'self',
    'fn', 'pub', 'mod', 'use', 'struct', 'impl', 'trait', 'match',
    'true', 'false', 'null', 'undefined', 'None', 'True', 'False',
  ]);

  // Simple token coloring
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let partIdx = 0;

  while (remaining.length > 0) {
    // String literals
    const strMatch = remaining.match(/^(["'`])(?:(?!\1|\\).|\\.)*\1/);
    if (strMatch) {
      parts.push(<Text key={partIdx++} color="#A3E635">{strMatch[0]}</Text>);
      remaining = remaining.slice(strMatch[0].length);
      continue;
    }

    // Comments
    const commentMatch = remaining.match(/^(\/\/.*|#.*)$/);
    if (commentMatch) {
      parts.push(<Text key={partIdx++} color="#64748B" italic>{commentMatch[0]}</Text>);
      remaining = '';
      continue;
    }

    // Numbers
    const numMatch = remaining.match(/^\b\d+(\.\d+)?\b/);
    if (numMatch) {
      parts.push(<Text key={partIdx++} color="#FB923C">{numMatch[0]}</Text>);
      remaining = remaining.slice(numMatch[0].length);
      continue;
    }

    // Keywords
    const wordMatch = remaining.match(/^\b[a-zA-Z_]\w*\b/);
    if (wordMatch) {
      if (keywords.has(wordMatch[0])) {
        parts.push(<Text key={partIdx++} color="#8B5CF6" bold>{wordMatch[0]}</Text>);
      } else {
        parts.push(<Text key={partIdx++}>{wordMatch[0]}</Text>);
      }
      remaining = remaining.slice(wordMatch[0].length);
      continue;
    }

    // Brackets/operators
    const opMatch = remaining.match(/^[{}()\[\]<>:;,.=+\-*/%!&|^~?@#]/);
    if (opMatch) {
      parts.push(<Text key={partIdx++} color="#64748B">{opMatch[0]}</Text>);
      remaining = remaining.slice(1);
      continue;
    }

    // Default: single char
    parts.push(<Text key={partIdx++}>{remaining[0]}</Text>);
    remaining = remaining.slice(1);
  }

  return <Text>{parts}</Text>;
}

// ─── Inline Formatting (bold, italic, inline code) ───────────
function InlineFormatted({ text }: { text: string }) {
  // Handle **bold**, *italic*, `code`
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let partIdx = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(<Text key={partIdx++} color="#22D3EE">{codeMatch[1]}</Text>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      parts.push(<Text key={partIdx++} bold>{boldMatch[1]}</Text>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      parts.push(<Text key={partIdx++} italic>{italicMatch[1]}</Text>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Find next special token
    const next = remaining.search(/[`*]/);
    if (next === -1) {
      parts.push(<Text key={partIdx++}>{remaining}</Text>);
      break;
    }
    if (next > 0) {
      parts.push(<Text key={partIdx++}>{remaining.slice(0, next)}</Text>);
      remaining = remaining.slice(next);
    } else {
      // Special char not matching a pattern — just output it
      parts.push(<Text key={partIdx++}>{remaining[0]}</Text>);
      remaining = remaining.slice(1);
    }
  }

  return <Text>{parts}</Text>;
}

// ─── Message Row ─────────────────────────────────────────────
function MessageRow({ message, verbose }: { message: Message; verbose?: boolean }) {
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
          <Box>
            <Text color="#A3E635" bold>{'◆ Friday'}</Text>
            {message.timestamp && (
              <Text dimColor>{'  '}</Text>
            )}
          </Box>
          <Box marginLeft={2} flexDirection="column">
            <RichText content={content} />
            {message.toolCalls && message.toolCalls.length > 0 && (
              <ToolCallSection toolCalls={message.toolCalls} verbose={verbose} />
            )}
          </Box>
        </Box>
      );

    case 'tool':
      if (!verbose) {
        // In non-verbose mode, tool results are collapsed
        return null;
      }
      return (
        <Box marginLeft={4} marginTop={0}>
          <Text dimColor>
            {'  '}
            {content.length > 300 ? content.slice(0, 300) + '…' : content}
          </Text>
        </Box>
      );

    case 'system':
      return (
        <Box marginTop={1}>
          <Text color="#64748B" italic>{'  ◆ '}{content}</Text>
        </Box>
      );

    default:
      return null;
  }
}

// ─── Tool Calls Section (collapsible) ────────────────────────
function ToolCallSection({ toolCalls, verbose }: { toolCalls: NonNullable<Message['toolCalls']>; verbose?: boolean }) {
  return (
    <Box flexDirection="column" marginTop={0}>
      {toolCalls.map((tc, i) => (
        <ToolCallRow key={i} name={tc.name} input={tc.input} verbose={verbose} />
      ))}
    </Box>
  );
}

function ToolCallRow({ name, input, verbose }: { name: string; input: Record<string, unknown>; verbose?: boolean }) {
  const summary = formatToolInput(name, input);

  // Compact one-line display (default)
  if (!verbose) {
    const action = getToolAction(name);
    return (
      <Box marginTop={0}>
        <Text>
          <Text color="#334155">{'  '}</Text>
          <Text color="#A3E635">{'✓ '}</Text>
          <Text color="#64748B">{action} </Text>
          <Text dimColor>{summary}</Text>
        </Text>
      </Box>
    );
  }

  // Verbose display
  return (
    <Box flexDirection="column" marginTop={0}>
      <Text>
        <Text color="#8B5CF6">{'  ⏵ '}</Text>
        <Text color="#22D3EE" bold>{name}</Text>
        {summary && <Text dimColor>{' '}{summary}</Text>}
        <Text color="#A3E635">{' ✓'}</Text>
      </Text>
    </Box>
  );
}

function getToolAction(name: string): string {
  if (name.includes('read') || name.includes('Read')) return 'Read';
  if (name.includes('write') || name.includes('Write') || name.includes('edit') || name.includes('Edit')) return 'Edited';
  if (name.includes('search') || name.includes('Search') || name.includes('grep') || name.includes('Grep')) return 'Searched';
  if (name.includes('run') || name.includes('Run') || name.includes('exec') || name.includes('Exec') || name.includes('bash') || name.includes('Bash')) return 'Ran';
  if (name.includes('list') || name.includes('List')) return 'Listed';
  if (name.includes('create') || name.includes('Create')) return 'Created';
  if (name.includes('delete') || name.includes('Delete')) return 'Deleted';
  return 'Called';
}

function formatToolInput(name: string, input: Record<string, unknown>): string {
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
