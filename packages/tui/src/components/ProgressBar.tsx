import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../theme.js';

export interface ProgressBarProps {
  current: number;
  total: number;
  width?: number;
  label?: string;
  showPercentage?: boolean;
  showCount?: boolean;
}

function getProgressColor(ratio: number, theme: ReturnType<typeof getTheme>): string {
  if (ratio < 0.33) return theme.colors.error;
  if (ratio < 0.66) return theme.colors.warning;
  return theme.colors.success;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  width = 30,
  label,
  showPercentage = true,
  showCount = false,
}) => {
  const theme = getTheme();

  const safeCurrent = Math.max(0, Math.min(current, total));
  const ratio = total > 0 ? safeCurrent / total : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  const filledStr = '█'.repeat(filled);
  const emptyStr = '░'.repeat(empty);
  const color = getProgressColor(ratio, theme);
  const percentage = Math.round(ratio * 100);

  return (
    <Box gap={1}>
      {label && (
        <Text color={theme.colors.text}>{label}</Text>
      )}
      <Text>
        <Text color={color}>{filledStr}</Text>
        <Text color={theme.colors.textDim}>{emptyStr}</Text>
      </Text>
      {showPercentage && (
        <Text color={color}>{percentage}%</Text>
      )}
      {showCount && (
        <Text color={theme.colors.textDim}>
          {safeCurrent}/{total}
        </Text>
      )}
    </Box>
  );
};
