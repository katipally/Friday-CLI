import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface PromptProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function Prompt({ onSubmit, disabled, loading }: PromptProps) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const handleSubmit = useCallback(
    (input: string) => {
      if (disabled || loading) return;
      if (!input.trim()) return;

      setHistory((prev) => [input, ...prev]);
      setHistoryIndex(-1);
      onSubmit(input);
      setValue('');
    },
    [disabled, loading, onSubmit],
  );

  useInput((_input, key) => {
    if (disabled || loading) return;

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

  if (loading) {
    return (
      <Box paddingLeft={0}>
        <Text color="#8B5CF6" bold>{'> '}</Text>
        <Text dimColor italic>Thinking...</Text>
      </Box>
    );
  }

  return (
    <Box paddingLeft={0}>
      <Text color="#8B5CF6" bold>{'> '}</Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder={disabled ? '' : 'Message Friday...'}
      />
    </Box>
  );
}
