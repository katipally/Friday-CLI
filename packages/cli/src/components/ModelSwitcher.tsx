import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Model } from '@fridaycode/shared';
import { COLORS } from '@fridaycode/shared';

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

  // Group by provider
  const groups = new Map<string, Model[]>();
  for (const model of filtered) {
    const list = groups.get(model.provider) ?? [];
    list.push(model);
    groups.set(model.provider, list);
  }

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.return) {
      if (filtered[selectedIndex]) {
        onSelect(filtered[selectedIndex].id);
      }
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(filtered.length - 1, prev + 1));
    }
    if (key.backspace || key.delete) {
      setFilter((prev) => prev.slice(0, -1));
      setSelectedIndex(0);
    }
    if (input && !key.ctrl && !key.meta) {
      setFilter((prev) => prev + input);
      setSelectedIndex(0);
    }
  });

  let flatIndex = 0;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={COLORS.deepViolet}
      paddingX={1}
    >
      <Text color={COLORS.deepViolet} bold>
        Select Model
      </Text>
      {filter && (
        <Text color={COLORS.midnightSlate}>
          Filter: {filter}
        </Text>
      )}
      {[...groups.entries()].map(([provider, provModels]) => (
        <Box key={provider} flexDirection="column" marginTop={1}>
          <Text color={COLORS.starkRose} bold underline>
            {provider}
          </Text>
          {provModels.map((model) => {
            const idx = flatIndex++;
            const isSelected = idx === selectedIndex;
            const isCurrent = model.id === currentModel;
            return (
              <Box key={model.id} gap={1}>
                <Text color={isSelected ? COLORS.deepViolet : undefined}>
                  {isSelected ? '❯' : ' '}
                </Text>
                <Text
                  color={isCurrent ? COLORS.acidicPistachio : COLORS.icySlate}
                  bold={isCurrent}
                >
                  {model.name}
                </Text>
                {isCurrent && (
                  <Text color={COLORS.acidicPistachio}> (current)</Text>
                )}
              </Box>
            );
          })}
        </Box>
      ))}
      <Text color={COLORS.midnightSlate} dimColor>
        ↑↓ navigate · Enter select · Esc cancel · Type to filter
      </Text>
    </Box>
  );
}
