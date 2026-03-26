import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getTheme } from '../theme.js';

interface SlashCommandInfo {
  name: string;
  description: string;
  aliases?: string[];
}

interface InputBoxProps {
  onSubmit: (value: string) => void;
  isDisabled?: boolean;
  commands?: SlashCommandInfo[];
}

export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  isDisabled = false,
  commands = [],
}) => {
  const t = getTheme();
  const [value, setValue] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);
  const savedInputRef = useRef('');

  const suggestions = useMemo(() => {
    if (!value.startsWith('/') || value.includes(' ')) return [];
    const query = value.slice(1).toLowerCase();
    if (!query) return commands.slice(0, 8);
    return commands
      .filter((c) =>
        c.name.startsWith(query) ||
        c.aliases?.some((a) => a.startsWith(query)),
      )
      .slice(0, 8);
  }, [value, commands]);

  const showSuggestions = suggestions.length > 0 && !isDisabled;

  useInput((_input, key) => {
    if (isDisabled) return;

    // Slash command navigation
    if (showSuggestions) {
      if (key.downArrow) {
        setSelectedIdx((p) => Math.min(p + 1, suggestions.length - 1));
        return;
      }
      if (key.upArrow) {
        setSelectedIdx((p) => Math.max(p - 1, 0));
        return;
      }
      if (key.tab) {
        const cmd = suggestions[selectedIdx];
        if (cmd) {
          setValue('/' + cmd.name + ' ');
          setSelectedIdx(0);
        }
        return;
      }
    }

    // Input history navigation (when no slash suggestions shown)
    if (!showSuggestions && historyRef.current.length > 0) {
      if (key.upArrow) {
        if (historyIdxRef.current === -1) {
          savedInputRef.current = value;
        }
        const newIdx = Math.min(historyIdxRef.current + 1, historyRef.current.length - 1);
        historyIdxRef.current = newIdx;
        setValue(historyRef.current[historyRef.current.length - 1 - newIdx] || '');
        return;
      }
      if (key.downArrow) {
        const newIdx = historyIdxRef.current - 1;
        if (newIdx < 0) {
          historyIdxRef.current = -1;
          setValue(savedInputRef.current);
        } else {
          historyIdxRef.current = newIdx;
          setValue(historyRef.current[historyRef.current.length - 1 - newIdx] || '');
        }
        return;
      }
    }
  });

  const handleChange = useCallback((v: string) => {
    setValue(v);
    setSelectedIdx(0);
    historyIdxRef.current = -1;
  }, []);

  const handleSubmit = useCallback((input: string) => {
    const trimmed = input.trim();
    if (trimmed && !isDisabled) {
      historyRef.current.push(trimmed);
      historyIdxRef.current = -1;
      savedInputRef.current = '';
      onSubmit(trimmed);
      setValue('');
      setSelectedIdx(0);
    }
  }, [onSubmit, isDisabled]);

  return (
    <Box flexDirection="column">
      {showSuggestions && (
        <Box flexDirection="column" marginLeft={2} marginBottom={0}>
          {suggestions.map((cmd, i) => (
            <Box key={cmd.name} gap={1}>
              <Text color={i === selectedIdx ? t.colors.primary : undefined} bold={i === selectedIdx} dimColor={i !== selectedIdx}>
                {i === selectedIdx ? '›' : ' '} /{cmd.name}
              </Text>
              <Text dimColor>{cmd.description}</Text>
            </Box>
          ))}
          <Text dimColor>{'  ↑↓ navigate · Tab complete · Enter select'}</Text>
        </Box>
      )}

      <Box>
        {isDisabled ? (
          <Box gap={1}>
            <Text color={t.colors.primary}>◉</Text>
            <Text color={t.colors.muted}>Processing...</Text>
          </Box>
        ) : (
          <>
            <Text color={t.colors.primary} bold>❯ </Text>
            <TextInput
              value={value}
              onChange={handleChange}
              onSubmit={handleSubmit}
              placeholder="Ask Friday anything... (/ for commands)"
            />
          </>
        )}
      </Box>
    </Box>
  );
};
