import React from 'react';
import { Text, Box } from 'ink';
import { CodeBlock } from './CodeBlock.js';

export interface MarkdownRendererProps {
  content: string;
  width?: number;
}

interface ParsedBlock {
  type: 'paragraph' | 'code' | 'heading' | 'blockquote' | 'list' | 'hr';
  content: string;
  language?: string;
  level?: number;
}

const HEADING_COLORS: Record<number, string> = {
  1: 'magenta',
  2: 'cyan',
  3: 'blue',
  4: 'green',
  5: 'yellow',
  6: 'white',
};

function parseBlocks(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Fenced code block
    const codeMatch = /^```(\w*)/.exec(line);
    if (codeMatch) {
      const language = codeMatch[1] || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      // Skip closing ```
      if (i < lines.length) i++;
      blocks.push({ type: 'code', content: codeLines.join('\n'), language });
      continue;
    }

    // Horizontal rule
    if (/^(---|\*\*\*|___)$/.test(line.trim())) {
      blocks.push({ type: 'hr', content: '' });
      i++;
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.+)/.exec(line);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        content: headingMatch[2]!,
        level: headingMatch[1]!.length,
      });
      i++;
      continue;
    }

    // Blockquote (collect consecutive > lines)
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('>')) {
        quoteLines.push(lines[i]!.replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', content: quoteLines.join('\n') });
      continue;
    }

    // Unordered list (collect consecutive - or * list items)
    if (/^\s*[-*+]\s+/.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]!)) {
        listLines.push(lines[i]!.replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', content: listLines.join('\n') });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        listLines.push(lines[i]!.replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', content: listLines.join('\n') });
      continue;
    }

    // Blank line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph (collect until blank line or special block)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !lines[i]!.startsWith('```') &&
      !lines[i]!.startsWith('#') &&
      !lines[i]!.startsWith('>') &&
      !/^\s*[-*+]\s+/.test(lines[i]!) &&
      !/^\s*\d+\.\s+/.test(lines[i]!) &&
      !/^(---|\*\*\*|___)$/.test(lines[i]!.trim())
    ) {
      paraLines.push(lines[i]!);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', content: paraLines.join('\n') });
    }
  }

  return blocks;
}

/**
 * Renders inline markdown formatting within a single text segment.
 * Handles bold, italic, inline code, and bold+italic.
 */
function renderInlineSegments(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match: bold+italic (***), bold (**), italic (*/_), inline code (`)
  const inlinePattern = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = inlinePattern.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      nodes.push(<Text key={key++}>{text.slice(lastIndex, match.index)}</Text>);
    }

    if (match[2] != null) {
      // Bold + italic ***text***
      nodes.push(<Text key={key++} bold italic>{match[2]}</Text>);
    } else if (match[3] != null) {
      // Bold **text**
      nodes.push(<Text key={key++} bold>{match[3]}</Text>);
    } else if (match[4] != null) {
      // Italic *text*
      nodes.push(<Text key={key++} italic>{match[4]}</Text>);
    } else if (match[5] != null) {
      // Italic _text_
      nodes.push(<Text key={key++} italic>{match[5]}</Text>);
    } else if (match[6] != null) {
      // Inline code `text`
      nodes.push(<Text key={key++} dimColor>{match[6]}</Text>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(<Text key={key++}>{text.slice(lastIndex)}</Text>);
  }

  return nodes;
}

const InlineText: React.FC<{ text: string }> = ({ text }) => {
  const segments = renderInlineSegments(text);
  return <Text>{segments}</Text>;
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, width }) => {
  const blocks = parseBlocks(content);

  return (
    <Box flexDirection="column" width={width}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'code':
            return (
              <CodeBlock
                key={idx}
                code={block.content}
                language={block.language}
                showLineNumbers={block.content.split('\n').length > 3}
              />
            );

          case 'heading': {
            const color = HEADING_COLORS[block.level ?? 1] ?? 'white';
            const prefix = block.level === 1 ? '# ' : block.level === 2 ? '## ' : `${'#'.repeat(block.level ?? 3)} `;
            return (
              <Box key={idx} marginY={block.level === 1 ? 1 : 0}>
                <Text color={color} bold>
                  {prefix}{block.content}
                </Text>
              </Box>
            );
          }

          case 'blockquote':
            return (
              <Box key={idx} marginLeft={1} paddingLeft={1} borderStyle="single" borderLeft borderRight={false} borderTop={false} borderBottom={false} borderColor="gray">
                <Box flexDirection="column">
                  {block.content.split('\n').map((line, li) => (
                    <InlineText key={li} text={line} />
                  ))}
                </Box>
              </Box>
            );

          case 'list':
            return (
              <Box key={idx} flexDirection="column" marginLeft={1}>
                {block.content.split('\n').map((item, li) => (
                  <Box key={li} gap={1}>
                    <Text color="cyan">•</Text>
                    <InlineText text={item} />
                  </Box>
                ))}
              </Box>
            );

          case 'hr':
            return (
              <Box key={idx} marginY={1}>
                <Text dimColor>{'─'.repeat(width ?? 40)}</Text>
              </Box>
            );

          case 'paragraph':
          default:
            return (
              <Box key={idx} marginBottom={1}>
                <Box flexDirection="column">
                  {block.content.split('\n').map((line, li) => (
                    <InlineText key={li} text={line} />
                  ))}
                </Box>
              </Box>
            );
        }
      })}
    </Box>
  );
};
