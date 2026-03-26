import React from 'react';
import { Text, Box } from 'ink';
import { highlight, supportsLanguage } from 'cli-highlight';

export interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  startLine?: number;
  highlightLines?: number[];
  maxHeight?: number;
  title?: string;
}

function highlightCode(code: string, language?: string): string {
  if (language && supportsLanguage(language)) {
    try {
      return highlight(code, { language, ignoreIllegals: true });
    } catch {
      return code;
    }
  }
  // Auto-detect or plain text fallback
  try {
    return highlight(code, { ignoreIllegals: true });
  } catch {
    return code;
  }
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  showLineNumbers = false,
  startLine = 1,
  highlightLines = [],
  maxHeight,
  title,
}) => {
  const allLines = code.replace(/\n$/, '').split('\n');
  const truncated = maxHeight != null && allLines.length > maxHeight;
  const visibleLines = truncated ? allLines.slice(0, maxHeight) : allLines;

  const highlighted = highlightCode(visibleLines.join('\n'), language);
  const highlightedLines = highlighted.split('\n');

  const totalVisible = visibleLines.length;
  const gutterWidth = showLineNumbers
    ? String(startLine + totalVisible - 1).length
    : 0;

  const highlightSet = new Set(highlightLines);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" marginY={1}>
      {title && (
        <Box paddingX={1}>
          <Text color="cyan" bold>
            {title}
          </Text>
          {language && (
            <Text dimColor> ({language})</Text>
          )}
        </Box>
      )}

      <Box flexDirection="column" paddingX={1}>
        {highlightedLines.map((line, idx) => {
          const lineNum = startLine + idx;
          const isHighlighted = highlightSet.has(lineNum);

          return (
            <Box key={idx}>
              {showLineNumbers && (
                <Text dimColor>
                  {String(lineNum).padStart(gutterWidth, ' ')}
                  {' │ '}
                </Text>
              )}
              <Text bold={isHighlighted} color={isHighlighted ? 'yellow' : undefined}>
                {line}
              </Text>
            </Box>
          );
        })}
        {truncated && (
          <Text dimColor>
            {showLineNumbers ? `${' '.repeat(gutterWidth)}   ` : ''}... ({allLines.length - maxHeight!} more lines)
          </Text>
        )}
      </Box>
    </Box>
  );
};
