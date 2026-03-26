import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

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
  const [value, setValue] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

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
    if (isDisabled || !showSuggestions) return;
    if (key.downArrow) {
      setSelectedIdx((p) => Math.min(p + 1, suggestions.length - 1));
    } else if (key.upArrow) {
      setSelectedIdx((p) => Math.max(p - 1, 0));
    } else if (key.tab) {
      const cmd = suggestions[selectedIdx];
      if (cmd) {
        setValue('/' + cmd.name + ' ');
        setSelectedIdx(0);
      }
    }
  });

  const handleChange = useCallback((v: string) => {
    setValue(v);
    setSelectedIdx(0);
  }, []);

  const handleSubmit = useCallback((input: string) => {
    if (input.trim() && !isDisabled) {
      onSubmit(input.trim());
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
              <Text color={i === selectedIdx ? 'cyan' : undefined} bold={i === selectedIdx} dimColor={i !== selectedIdx}>
                {i === selectedIdx ? '\u203A' : ' '} /{cmd.name}
              </Text>
              <Text dimColor>{cmd.description}</Text>
            </Box>
          ))}
          <Text dimColor>{'  \u2191\u2193 navigate \u00B7 Tab complete'}</Text>
        </Box>
      )}

      <Box>
        {isDisabled ? (
          <Text dimColor>{'\u25CF Thinking...'}</Text>
        ) : (
          <>
            <Text color="cyan" bold>{'\u276F '}</Text>
            <TextInput
              value={value}
              onChange={handleChange}
              onSubmit={handleSubmit}
              placeholder="Message Friday... (/ for commands)"
            />
          </>
        )}
      </Box>
    </Box>
  );
};
