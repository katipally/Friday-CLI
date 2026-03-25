import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface InputBoxProps {
  onSubmit: (value: string) => void;
  isDisabled?: boolean;
  placeholder?: string;
}

export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  isDisabled = false,
  placeholder = 'Type a message...',
}) => {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(
    (input: string) => {
      if (input.trim() && !isDisabled) {
        onSubmit(input.trim());
        setValue('');
      }
    },
    [onSubmit, isDisabled],
  );

  return (
    <Box borderStyle="round" borderColor={isDisabled ? 'gray' : 'cyan'} paddingX={1}>
      <Text color="cyan" bold>
        {'❯ '}
      </Text>
      {isDisabled ? (
        <Text color="gray">Processing...</Text>
      ) : (
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={placeholder}
        />
      )}
    </Box>
  );
};
