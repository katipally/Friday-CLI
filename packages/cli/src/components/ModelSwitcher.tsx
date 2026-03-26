import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Model } from '@fridaycode/shared';

interface ModelSwitcherProps {
  models: Model[];
  currentModel: string;
  onSelect: (modelId: string) => void;
  onCancel: () => void;
}

export function ModelSwitcher({ models, currentModel, onSelect, onCancel }: ModelSwitcherProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? models.filter(
        (m) =>
          m.name.toLowerCase().includes(filter.toLowerCase()) ||
          m.id.toLowerCase().includes(filter.toLowerCase()),
      )
    : models;

  useInput((input, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.return) {
      if (filtered[selectedIndex]) onSelect(filtered[selectedIndex].id);
      return;
    }
    if (key.upArrow) setSelectedIndex((p) => Math.max(0, p - 1));
    if (key.downArrow) setSelectedIndex((p) => Math.min(filtered.length - 1, p + 1));
    if (key.backspace || key.delete) { setFilter((p) => p.slice(0, -1)); setSelectedIndex(0); }
    if (input && !key.ctrl && !key.meta) { setFilter((p) => p + input); setSelectedIndex(0); }
  });

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      <Text color="#8B5CF6" bold>Select Model</Text>
      {filter && <Text dimColor>  filter: {filter}</Text>}
      <Box flexDirection="column" marginLeft={2} marginTop={0}>
        {filtered.slice(0, 15).map((model, idx) => {
          const isSelected = idx === selectedIndex;
          const isCurrent = model.id === currentModel;
          return (
            <Box key={model.id} gap={1}>
              <Text color={isSelected ? '#8B5CF6' : undefined}>
                {isSelected ? '❯' : ' '}
              </Text>
              <Text
                color={isCurrent ? '#A3E635' : undefined}
                bold={isCurrent || isSelected}
              >
                {model.name}
              </Text>
              <Text dimColor>({model.provider})</Text>
              {isCurrent && <Text color="#A3E635"> ●</Text>}
            </Box>
          );
        })}
      </Box>
      {filtered.length > 15 && (
        <Text dimColor>    ...and {filtered.length - 15} more (type to filter)</Text>
      )}
      <Text dimColor>  ↑↓ select · enter confirm · esc cancel · type to filter</Text>
    </Box>
  );
}
