import React from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';

interface SpinnerProps {
  label?: string;
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ label = 'Thinking...', color = 'cyan' }) => {
  return (
    <Box gap={1}>
      <Text color={color}>
        <InkSpinner type="dots" />
      </Text>
      <Text color="gray">{label}</Text>
    </Box>
  );
};
