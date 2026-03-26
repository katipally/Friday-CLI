import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

export interface InputWithHistoryProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  history?: string[];
  placeholder?: string;
  prefix?: string;
}

export function InputWithHistory({
  value,
  onChange,
  onSubmit,
  history = [],
  placeholder = '',
  prefix = '',
}: InputWithHistoryProps): React.ReactElement {
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedInput, setSavedInput] = useState('');

  const navigateHistory = useCallback(
    (direction: 'up' | 'down') => {
      if (history.length === 0) return;

      if (direction === 'up') {
        if (historyIndex === -1) {
          setSavedInput(value);
        }
        const nextIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(nextIndex);
        onChange(history[nextIndex]!);
      } else {
        if (historyIndex <= 0) {
          setHistoryIndex(-1);
          onChange(savedInput);
        } else {
          const nextIndex = historyIndex - 1;
          setHistoryIndex(nextIndex);
          onChange(history[nextIndex]!);
        }
      }
    },
    [history, historyIndex, value, savedInput, onChange],
  );

  useInput((input, key) => {
    if (key.return) {
      onSubmit(value);
      setHistoryIndex(-1);
      setSavedInput('');
      return;
    }

    if (key.upArrow) {
      navigateHistory('up');
      return;
    }

    if (key.downArrow) {
      navigateHistory('down');
      return;
    }

    if (key.backspace) {
      setHistoryIndex(-1);
      onChange(value.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta && !key.escape) {
      setHistoryIndex(-1);
      onChange(value + input);
    }
  });

  const showPlaceholder = value.length === 0;

  return (
    <Box flexDirection="row">
      {prefix && <Text dimColor>{prefix}</Text>}
      {showPlaceholder ? (
        <Text dimColor>{placeholder}</Text>
      ) : (
        <Text>{value}</Text>
      )}
      <Text color="cyan">▎</Text>
    </Box>
  );
}
