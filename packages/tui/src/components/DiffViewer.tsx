import React from 'react';
import { Text, Box } from 'ink';
import { getTheme } from '../theme.js';

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

interface DiffViewerProps {
  fileName: string;
  lines: DiffLine[];
  collapsed?: boolean;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ fileName, lines, collapsed = false }) => {
  const theme = getTheme();

  const stats = {
    additions: lines.filter((l) => l.type === 'add').length,
    deletions: lines.filter((l) => l.type === 'remove').length,
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.colors.diffHeader} marginY={1}>
      {/* Header */}
      <Box paddingX={1} justifyContent="space-between">
        <Text color={theme.colors.diffHeader} bold>📄 {fileName}</Text>
        <Text>
          <Text color={theme.colors.diffAdd}>+{stats.additions}</Text>
          <Text color={theme.colors.muted}> / </Text>
          <Text color={theme.colors.diffRemove}>-{stats.deletions}</Text>
        </Text>
      </Box>

      {/* Diff content */}
      {!collapsed && (
        <Box flexDirection="column" paddingX={1}>
          {lines.map((line, i) => {
            const lineColor =
              line.type === 'add' ? theme.colors.diffAdd :
              line.type === 'remove' ? theme.colors.diffRemove :
              line.type === 'header' ? theme.colors.diffHeader :
              theme.colors.diffContext;

            const prefix =
              line.type === 'add' ? '+' :
              line.type === 'remove' ? '-' :
              line.type === 'header' ? '@' :
              ' ';

            return (
              <Text key={i} color={lineColor}>
                <Text dimColor>{prefix} </Text>
                {line.content}
              </Text>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

/**
 * Parse a unified diff string into DiffLine objects.
 */
export function parseDiff(diffText: string): { fileName: string; lines: DiffLine[] }[] {
  const files: { fileName: string; lines: DiffLine[] }[] = [];
  let currentFile: { fileName: string; lines: DiffLine[] } | null = null;

  for (const rawLine of diffText.split('\n')) {
    if (rawLine.startsWith('diff --git') || rawLine.startsWith('---') || rawLine.startsWith('+++')) {
      if (rawLine.startsWith('+++ b/')) {
        const fileName = rawLine.slice(6);
        currentFile = { fileName, lines: [] };
        files.push(currentFile);
      }
      continue;
    }

    if (!currentFile) continue;

    if (rawLine.startsWith('@@')) {
      currentFile.lines.push({ type: 'header', content: rawLine });
    } else if (rawLine.startsWith('+')) {
      currentFile.lines.push({ type: 'add', content: rawLine.slice(1) });
    } else if (rawLine.startsWith('-')) {
      currentFile.lines.push({ type: 'remove', content: rawLine.slice(1) });
    } else {
      currentFile.lines.push({ type: 'context', content: rawLine.slice(1) || rawLine });
    }
  }

  return files;
}
