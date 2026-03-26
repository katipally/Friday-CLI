import React from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme } from '../theme.js';

export interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  defaultYes?: boolean;
  detail?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  message,
  onConfirm,
  onCancel,
  defaultYes = false,
  detail,
}) => {
  const theme = getTheme();

  useInput((input, key) => {
    const lower = input.toLowerCase();

    if (lower === 'y') {
      onConfirm();
      return;
    }

    if (lower === 'n' || key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      if (defaultYes) {
        onConfirm();
      } else {
        onCancel();
      }
    }
  });

  const hint = defaultYes ? '[Y/n]' : '[y/N]';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.permissionPrompt}
      paddingX={1}
    >
      <Box gap={1}>
        <Text color={theme.colors.warning}>{theme.icons.warning}</Text>
        <Text bold color={theme.colors.text}>
          {message}
        </Text>
        <Text color={theme.colors.accent} bold>
          {hint}
        </Text>
      </Box>
      {detail && (
        <Box marginLeft={3} marginTop={0}>
          <Text color={theme.colors.textDim}>{detail}</Text>
        </Box>
      )}
    </Box>
  );
};
