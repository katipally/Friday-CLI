import React, { useState, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme } from '../theme.js';

export interface PaletteItem {
  name: string;
  description: string;
  category: string;
  shortcut?: string;
  icon?: string;
}

export interface CommandPaletteProps {
  commands: PaletteItem[];
  onSelect: (command: PaletteItem) => void;
  onDismiss: () => void;
  recentCommands?: string[];
}

interface FuzzyMatch {
  item: PaletteItem;
  score: number;
  matchIndices: number[];
}

function fuzzyMatch(text: string, query: string): { score: number; indices: number[] } | null {
  const lower = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const indices: number[] = [];
  let score = 0;
  let qi = 0;

  for (let ti = 0; ti < lower.length && qi < lowerQuery.length; ti++) {
    if (lower[ti] === lowerQuery[qi]) {
      indices.push(ti);
      // Consecutive matches score higher
      if (indices.length > 1 && indices[indices.length - 2] === ti - 1) {
        score += 2;
      }
      // Start-of-word matches score higher
      if (ti === 0 || text[ti - 1] === ' ' || text[ti - 1] === '/' || text[ti - 1] === '-') {
        score += 3;
      }
      score += 1;
      qi++;
    }
  }

  if (qi < lowerQuery.length) return null;
  return { score, indices };
}

function highlightFuzzyMatch(
  text: string,
  matchIndices: number[],
  matchColor: string,
  baseColor: string,
): React.ReactNode {
  if (matchIndices.length === 0) {
    return <Text color={baseColor}>{text}</Text>;
  }

  const indexSet = new Set(matchIndices);
  const parts: React.ReactNode[] = [];
  let run = '';
  let runIsMatch = false;

  for (let i = 0; i < text.length; i++) {
    const isMatch = indexSet.has(i);
    if (i === 0) {
      runIsMatch = isMatch;
      run = text[i]!;
    } else if (isMatch === runIsMatch) {
      run += text[i];
    } else {
      parts.push(
        runIsMatch ? (
          <Text key={parts.length} color={matchColor} bold underline>
            {run}
          </Text>
        ) : (
          <Text key={parts.length} color={baseColor}>
            {run}
          </Text>
        ),
      );
      run = text[i]!;
      runIsMatch = isMatch;
    }
  }

  if (run) {
    parts.push(
      runIsMatch ? (
        <Text key={parts.length} color={matchColor} bold underline>
          {run}
        </Text>
      ) : (
        <Text key={parts.length} color={baseColor}>
          {run}
        </Text>
      ),
    );
  }

  return <Text>{parts}</Text>;
}

const MAX_VISIBLE = 10;

export function CommandPalette({
  commands,
  onSelect,
  onDismiss,
  recentCommands = [],
}: CommandPaletteProps): React.ReactElement {
  const theme = getTheme();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const recentSet = useMemo(() => new Set(recentCommands), [recentCommands]);

  const filteredResults = useMemo((): FuzzyMatch[] => {
    let results: FuzzyMatch[];

    if (!query) {
      results = commands.map((item) => ({
        item,
        score: 0,
        matchIndices: [],
      }));
    } else {
      results = [];
      for (const item of commands) {
        const nameMatch = fuzzyMatch(item.name, query);
        const descMatch = fuzzyMatch(item.description, query);
        const best = nameMatch
          ? descMatch && descMatch.score > nameMatch.score
            ? descMatch
            : nameMatch
          : descMatch;

        if (best) {
          results.push({
            item,
            score: best.score,
            matchIndices: best === nameMatch ? best.indices : [],
          });
        }
      }
    }

    // Sort: recent first, then by score descending, then alphabetically
    results.sort((a, b) => {
      const aRecent = recentSet.has(a.item.name) ? 1 : 0;
      const bRecent = recentSet.has(b.item.name) ? 1 : 0;
      if (aRecent !== bRecent) return bRecent - aRecent;
      if (a.score !== b.score) return b.score - a.score;
      return a.item.name.localeCompare(b.item.name);
    });

    return results;
  }, [commands, query, recentSet]);

  const clampedCursor = Math.min(cursor, Math.max(0, filteredResults.length - 1));

  const scrollOffset = useMemo(() => {
    if (filteredResults.length <= MAX_VISIBLE) return 0;
    const half = Math.floor(MAX_VISIBLE / 2);
    if (clampedCursor <= half) return 0;
    if (clampedCursor >= filteredResults.length - (MAX_VISIBLE - half)) {
      return filteredResults.length - MAX_VISIBLE;
    }
    return clampedCursor - half;
  }, [clampedCursor, filteredResults.length]);

  const visibleItems = filteredResults.slice(scrollOffset, scrollOffset + MAX_VISIBLE);
  const hasScrollUp = scrollOffset > 0;
  const hasScrollDown = scrollOffset + MAX_VISIBLE < filteredResults.length;

  const handleSelect = useCallback(
    (index: number) => {
      const result = filteredResults[index];
      if (result) {
        onSelect(result.item);
      }
    },
    [filteredResults, onSelect],
  );

  useInput((input, key) => {
    if (key.escape) {
      onDismiss();
      return;
    }

    if (key.return) {
      handleSelect(clampedCursor);
      return;
    }

    if (key.upArrow) {
      setCursor((prev) => {
        const clamped = Math.min(prev, filteredResults.length - 1);
        return Math.max(0, clamped - 1);
      });
      return;
    }

    if (key.downArrow) {
      setCursor((prev) => {
        const clamped = Math.min(prev, filteredResults.length - 1);
        return Math.min(filteredResults.length - 1, clamped + 1);
      });
      return;
    }

    if (key.backspace) {
      setQuery((prev) => {
        setCursor(0);
        return prev.slice(0, -1);
      });
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setQuery((prev) => {
        setCursor(0);
        return prev + input;
      });
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.borderFocused}
      paddingX={1}
      width="100%"
    >
      {/* Search input */}
      <Box marginBottom={1}>
        <Text color={theme.colors.accent} bold>
          {'> '}
        </Text>
        {query.length === 0 ? (
          <Text dimColor>Type a command...</Text>
        ) : (
          <Text color={theme.colors.inputText}>{query}</Text>
        )}
        <Text color={theme.colors.accent}>▎</Text>
      </Box>

      {/* Scroll up indicator */}
      {hasScrollUp && <Text color={theme.colors.textDim}>  ↑ more</Text>}

      {/* Results */}
      {filteredResults.length === 0 ? (
        <Text color={theme.colors.textDim} italic>
          No matching commands
        </Text>
      ) : (
        visibleItems.map((result, i) => {
          const actualIndex = scrollOffset + i;
          const isActive = actualIndex === clampedCursor;
          const isRecent = recentSet.has(result.item.name);

          const indicator = isActive ? '▸ ' : '  ';
          const nameColor = isActive ? theme.colors.accent : theme.colors.text;

          return (
            <Box key={result.item.name} flexDirection="row" gap={1}>
              {/* Indicator */}
              <Text color={isActive ? theme.colors.accent : theme.colors.textDim}>
                {indicator}
              </Text>

              {/* Icon */}
              {result.item.icon && <Text>{result.item.icon}</Text>}

              {/* Name with fuzzy highlight */}
              <Box>
                {highlightFuzzyMatch(
                  result.item.name,
                  result.matchIndices,
                  theme.colors.warning,
                  nameColor,
                )}
              </Box>

              {/* Description */}
              <Text color={theme.colors.textDim}>{result.item.description}</Text>

              {/* Category tag */}
              <Text color={theme.colors.info}>[{result.item.category}]</Text>

              {/* Recent badge */}
              {isRecent && !query && <Text color={theme.colors.warning}>★</Text>}

              {/* Shortcut (right-aligned via flexGrow spacer) */}
              {result.item.shortcut && (
                <>
                  <Box flexGrow={1} />
                  <Text color={theme.colors.textDim} dimColor>
                    {result.item.shortcut}
                  </Text>
                </>
              )}
            </Box>
          );
        })
      )}

      {/* Scroll down indicator */}
      {hasScrollDown && <Text color={theme.colors.textDim}>  ↓ more</Text>}

      {/* Help footer */}
      <Box marginTop={1}>
        <Text color={theme.colors.textDim}>
          ↑↓ navigate  ⏎ select  esc dismiss
        </Text>
      </Box>
    </Box>
  );
}
