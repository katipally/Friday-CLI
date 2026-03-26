import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { COLORS } from '@fridaycode/shared';

interface PromptProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
}

export function Prompt({ onSubmit, disabled }: PromptProps) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const handleSubmit = useCallback(
    (input: string) => {
      if (disabled) return;
      if (!input.trim()) return;

      setHistory((prev) => [input, ...prev]);
      setHistoryIndex(-1);
      onSubmit(input);
      setValue('');
    },
    [disabled, onSubmit],
  );

  useInput((input, key) => {
    if (disabled) return;

    // History navigation
    if (key.upArrow && history.length > 0) {
      const newIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(newIndex);
      setValue(history[newIndex]);
    }
    if (key.downArrow) {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setValue(history[newIndex]);
      } else {
        setHistoryIndex(-1);
        setValue('');
      }
    }
  });

  return (
    <Box borderStyle="single" borderColor={COLORS.deepViolet} paddingX={1}>
      <Text color={COLORS.deepViolet} bold>
        {'❯ '}
      </Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder={disabled ? 'Waiting...' : 'Ask Friday anything...'}
      />
    </Box>
  );
}
