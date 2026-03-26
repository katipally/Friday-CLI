import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../theme.js';
import {
  type KeyBinding,
  formatKeyForDisplay,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
} from '../keyboard/shortcuts.js';

export interface ShortcutHelpProps {
  bindings: KeyBinding[];
}

const CategorySection: React.FC<{
  label: string;
  items: KeyBinding[];
  colors: { accent: string; text: string; textDim: string; muted: string };
}> = ({ label, items, colors }) => {
  if (items.length === 0) return null;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={colors.accent}>
        {label}
      </Text>
      <Box flexDirection="column" marginLeft={2}>
        {items.map((binding) => (
          <Box key={binding.action} flexDirection="row">
            <Box width={14}>
              <Text bold color={binding.enabled === false ? colors.muted : colors.text}>
                {formatKeyForDisplay(binding.key)}
              </Text>
            </Box>
            <Text color={binding.enabled === false ? colors.muted : colors.textDim}>
              {binding.description}
              {binding.enabled === false ? ' (disabled)' : ''}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export const ShortcutHelp: React.FC<ShortcutHelpProps> = ({ bindings }) => {
  const theme = getTheme();
  const { primary, accent, text, textDim, muted, border } = theme.colors;

  const grouped = new Map<KeyBinding['category'], KeyBinding[]>();
  for (const category of CATEGORY_ORDER) {
    grouped.set(
      category,
      bindings.filter((b) => b.category === category),
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={border}
      paddingX={2}
      paddingY={1}
    >
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color={primary}>
          ⌨ Keyboard Shortcuts
        </Text>
      </Box>

      {CATEGORY_ORDER.map((category) => (
        <CategorySection
          key={category}
          label={CATEGORY_LABELS[category]}
          items={grouped.get(category) ?? []}
          colors={{ accent, text, textDim, muted }}
        />
      ))}

      <Box justifyContent="center" marginTop={1}>
        <Text color={textDim}>
          Press <Text bold color={accent}>Esc</Text> or{' '}
          <Text bold color={accent}>^/</Text> to close
        </Text>
      </Box>
    </Box>
  );
};
