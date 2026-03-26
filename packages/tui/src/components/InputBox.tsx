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
      .filter(
        (c) =>
          c.name.startsWith(query) ||
          (c.aliases && c.aliases.some((a) => a.startsWith(query))),
      )
      .slice(0, 8);
  }, [value, commands]);

  const showSuggestions = suggestions.length > 0 && !isDisabled;

  useInput((_input, key) => {
    if (isDisabled || !showSuggestions) return;
    if (key.downArrow) {
      setSelectedIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
      return;
    }
    if (key.upArrow) {
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.tab) {
      const cmd = suggestions[selectedIdx];
      if (cmd) {
        setValue('/' + cmd.name + ' ');
        setSelectedIdx(0);
      }
    }
  });

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    setSelectedIdx(0);
  }, []);

  const handleSubmit = useCallback(
    (input: string) => {
      if (input.trim() && !isDisabled) {
        onSubmit(input.trim());
        setValue('');
        setSelectedIdx(0);
      }
    },
    [onSubmit, isDisabled],
  );

  return (
    <Box flexDirection="column">
      {/* Slash command suggestions */}
      {showSuggestions && (
        <Box flexDirection="column" paddingX={1} marginBottom={0}>
          {suggestions.map((cmd, i) => (
            <Box key={cmd.name} gap={1}>
              <Text
                color={i === selectedIdx ? 'cyan' : 'gray'}
                bold={i === selectedIdx}
              >
                {i === selectedIdx ? '\u25B6' : ' '}
              </Text>
              <Text color={i === selectedIdx ? 'cyan' : 'white'} bold={i === selectedIdx}>
                /{cmd.name}
              </Text>
              <Text color="gray" dimColor>
                {cmd.description}
              </Text>
            </Box>
          ))}
          <Text color="gray" dimColor>
            {'  \u2191\u2193 navigate \u00B7 Tab complete \u00B7 Enter select'}
          </Text>
        </Box>
      )}

      {/* Input line */}
      <Box paddingX={1}>
        <Text color={isDisabled ? 'gray' : 'green'} bold>
          {'> '}
        </Text>
        {isDisabled ? (
          <Text color="gray" dimColor>
            {'Thinking...'}
          </Text>
        ) : (
          <TextInput
            value={value}
            onChange={handleChange}
            onSubmit={handleSubmit}
            placeholder="Message Friday... (/ for commands)"
          />
        )}
      </Box>
    </Box>
  );
};
