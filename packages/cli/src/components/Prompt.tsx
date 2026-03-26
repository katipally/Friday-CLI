import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getPromptBarColor, getSpinnerFrame } from '../mascot/spider.js';

type PermissionMode = 'default' | 'acceptAll' | 'plan';

interface PromptProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  model?: string;
  provider?: string;
  permissionMode?: PermissionMode;
  promptBarColor?: string;
  turnDuration?: number;
  suggestion?: string;
}

const MODE_LABELS: Record<PermissionMode, { icon: string; label: string; color: string }> = {
  default:   { icon: '⏵',  label: '',                 color: '#64748B' },
  acceptAll: { icon: '⏵⏵', label: 'auto-accept on',   color: '#A3E635' },
  plan:      { icon: '⏸',  label: 'plan mode',        color: '#FBBF24' },
};

export function Prompt({
  onSubmit,
  disabled,
  loading,
  model,
  provider,
  permissionMode = 'default',
  promptBarColor: barColorProp,
  turnDuration,
  suggestion,
}: PromptProps) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [spinnerText, setSpinnerText] = useState('');

  const barColor = barColorProp || getPromptBarColor();
  const modeInfo = MODE_LABELS[permissionMode];

  // Animate spinner during loading
  useEffect(() => {
    if (!loading) { setSpinnerText(''); return; }
    const interval = setInterval(() => {
      setSpinnerText(getSpinnerFrame());
    }, 80);
    return () => clearInterval(interval);
  }, [loading]);

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

  // Determine if input starts with ! (shell mode)
  const isShellMode = value.startsWith('!');

  if (loading) {
    return (
      <Box flexDirection="column">
        <Box paddingLeft={0}>
          <Text color={barColor} bold>{'▌'}</Text>
          <Text> </Text>
          <Text>{spinnerText}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Prompt bar with model/mode info */}
      <Box paddingLeft={0}>
        <Text color={barColor} bold>{'▌'}</Text>
        <Text> </Text>
        {isShellMode ? (
          <Text color="#FB923C" bold>{'$ '}</Text>
        ) : (
          <Text color={barColor} bold>{'❯ '}</Text>
        )}
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={disabled ? '' : 'Message Friday...'}
        />
      </Box>

      {/* Sub-line: mode indicator + model */}
      <Box paddingLeft={2} gap={1}>
        {permissionMode !== 'default' && (
          <Text color={modeInfo.color}>
            {modeInfo.icon} {modeInfo.label}
          </Text>
        )}
        {model && (
          <Text dimColor>{model}</Text>
        )}
        {turnDuration !== undefined && turnDuration > 0 && (
          <Text dimColor>· wove for {formatDuration(turnDuration)}</Text>
        )}
      </Box>

      {/* Suggestion ghost text */}
      {suggestion && !value && (
        <Box paddingLeft={4}>
          <Text color="#475569" italic>{suggestion}</Text>
        </Box>
      )}
    </Box>
  );
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}
