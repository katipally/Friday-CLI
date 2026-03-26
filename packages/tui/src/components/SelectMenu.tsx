import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme } from '../theme.js';

export interface SelectItem<T> {
  label: string;
  value: T;
  description?: string;
  icon?: string;
  disabled?: boolean;
}

export interface SelectMenuProps<T> {
  items: SelectItem<T>[];
  onSelect: (item: T) => void;
  onCancel?: () => void;
  title?: string;
  maxVisible?: number;
  filterEnabled?: boolean;
}

function highlightMatch(text: string, query: string, matchColor: string, baseColor: string): React.ReactNode {
  if (!query) {
    return <Text color={baseColor}>{text}</Text>;
  }

  const lower = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lower.indexOf(lowerQuery);
  if (idx === -1) {
    return <Text color={baseColor}>{text}</Text>;
  }

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);

  return (
    <Text>
      <Text color={baseColor}>{before}</Text>
      <Text color={matchColor} bold underline>{match}</Text>
      <Text color={baseColor}>{after}</Text>
    </Text>
  );
}

export function SelectMenu<T>({
  items,
  onSelect,
  onCancel,
  title,
  maxVisible = 10,
  filterEnabled = true,
}: SelectMenuProps<T>): React.ReactElement | null {
  const theme = getTheme();
  const [cursor, setCursor] = useState(0);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter) return items;
    const lower = filter.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        (item.description && item.description.toLowerCase().includes(lower)),
    );
  }, [items, filter]);

  const selectableIndices = useMemo(
    () => filtered.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i !== -1),
    [filtered],
  );

  const clampedCursor = Math.min(cursor, Math.max(0, filtered.length - 1));

  const scrollOffset = useMemo(() => {
    if (filtered.length <= maxVisible) return 0;
    const half = Math.floor(maxVisible / 2);
    if (clampedCursor <= half) return 0;
    if (clampedCursor >= filtered.length - (maxVisible - half)) {
      return filtered.length - maxVisible;
    }
    return clampedCursor - half;
  }, [clampedCursor, filtered.length, maxVisible]);

  const visibleItems = filtered.slice(scrollOffset, scrollOffset + maxVisible);
  const hasScrollUp = scrollOffset > 0;
  const hasScrollDown = scrollOffset + maxVisible < filtered.length;

  function moveToNextSelectable(from: number, direction: 1 | -1): number {
    if (selectableIndices.length === 0) return from;
    let next = from + direction;
    while (next >= 0 && next < filtered.length) {
      if (!filtered[next]!.disabled) return next;
      next += direction;
    }
    return from;
  }

  useInput((input, key) => {
    if (key.escape) {
      onCancel?.();
      return;
    }

    if (key.return) {
      const item = filtered[clampedCursor];
      if (item && !item.disabled) {
        onSelect(item.value);
      }
      return;
    }

    if (key.upArrow) {
      setCursor((prev) => moveToNextSelectable(Math.min(prev, filtered.length - 1), -1));
      return;
    }

    if (key.downArrow) {
      setCursor((prev) => moveToNextSelectable(Math.min(prev, filtered.length - 1), 1));
      return;
    }

    if (filterEnabled && key.backspace) {
      setFilter((prev) => {
        const next = prev.slice(0, -1);
        setCursor(0);
        return next;
      });
      return;
    }

    if (filterEnabled && input && !key.ctrl && !key.meta) {
      setFilter((prev) => {
        const next = prev + input;
        setCursor(0);
        return next;
      });
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.colors.borderFocused} paddingX={1}>
      {title && (
        <Box marginBottom={1}>
          <Text bold color={theme.colors.primary}>
            {title}
          </Text>
        </Box>
      )}

      {filterEnabled && (
        <Box marginBottom={1}>
          <Text color={theme.colors.textDim}>Filter: </Text>
          <Text color={theme.colors.inputText}>{filter || ' '}</Text>
          <Text color={theme.colors.accent}>▎</Text>
        </Box>
      )}

      {hasScrollUp && (
        <Text color={theme.colors.textDim}>  ↑ more</Text>
      )}

      {visibleItems.length === 0 ? (
        <Text color={theme.colors.textDim} italic>
          No matching items
        </Text>
      ) : (
        visibleItems.map((item, i) => {
          const actualIndex = scrollOffset + i;
          const isActive = actualIndex === clampedCursor;
          const isDisabled = item.disabled === true;

          const indicator = isActive ? '▸ ' : '  ';
          const labelColor = isDisabled
            ? theme.colors.textDim
            : isActive
              ? theme.colors.accent
              : theme.colors.text;

          return (
            <Box key={actualIndex} flexDirection="row" gap={1}>
              <Text color={isActive ? theme.colors.accent : theme.colors.textDim}>
                {indicator}
              </Text>
              {item.icon && <Text>{item.icon} </Text>}
              <Box>
                {isDisabled ? (
                  <Text color={theme.colors.textDim} strikethrough>
                    {item.label}
                  </Text>
                ) : (
                  highlightMatch(item.label, filter, theme.colors.warning, labelColor)
                )}
                {item.description && (
                  <Text color={theme.colors.textDim}>
                    {' — '}
                    {item.description}
                  </Text>
                )}
              </Box>
            </Box>
          );
        })
      )}

      {hasScrollDown && (
        <Text color={theme.colors.textDim}>  ↓ more</Text>
      )}

      <Box marginTop={1}>
        <Text color={theme.colors.textDim}>
          ↑↓ navigate  ⏎ select  esc cancel
        </Text>
      </Box>
    </Box>
  );
}
