import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getPromptBarColor, getSpinnerFrame } from '../branding/spinner.js';
import { getCompletions, type CompletionResult } from '../input/completion.js';

type PermissionMode = 'default' | 'acceptAll' | 'plan';

interface PromptProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  permissionMode?: PermissionMode;
  promptBarColor?: string;
  suggestion?: string;
  vimMode?: boolean;
  workingDir?: string;
  availableModels?: string[];
  registeredCommands?: string[];
}

export function Prompt({
  onSubmit,
  disabled,
  loading,
  permissionMode = 'default',
  promptBarColor: barColorProp,
  suggestion,
  vimMode,
  workingDir = process.cwd(),
  availableModels,
  registeredCommands,
}: PromptProps) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [spinnerText, setSpinnerText] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [multilineMode, setMultilineMode] = useState(false);
  const [multilineBuffer, setMultilineBuffer] = useState<string[]>([]);

  // Autocomplete state
  const [completions, setCompletions] = useState<string[]>([]);
  const [completionIndex, setCompletionIndex] = useState(-1);
  const [completionPrefix, setCompletionPrefix] = useState('');

  const barColor = barColorProp || getPromptBarColor();

  // Animate spinner during loading
  useEffect(() => {
    if (!loading) { setSpinnerText(''); return; }
    const interval = setInterval(() => {
      setSpinnerText(getSpinnerFrame());
    }, 80);
    return () => clearInterval(interval);
  }, [loading]);

  // Fetch completions as user types
  useEffect(() => {
    if (disabled || loading || searchMode || !value) {
      setCompletions([]);
      setCompletionIndex(-1);
      return;
    }
    let cancelled = false;
    getCompletions(value, workingDir, availableModels).then((result) => {
      if (cancelled) return;
      setCompletions(result.items);
      setCompletionPrefix(result.prefix);
      setCompletionIndex(-1);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [value, workingDir, availableModels, disabled, loading, searchMode]);

  // Update search results when query changes
  useEffect(() => {
    if (!searchMode || !searchQuery) {
      setSearchResults([]);
      return;
    }
    const lower = searchQuery.toLowerCase();
    const matches = history.filter(h => h.toLowerCase().includes(lower));
    setSearchResults(matches);
    setSearchIndex(0);
    if (matches.length > 0) {
      setValue(matches[0]);
    }
  }, [searchQuery, searchMode]);

  const handleSubmit = useCallback(
    (input: string) => {
      if (disabled || loading) return;

      // In search mode, accept the selection
      if (searchMode) {
        setSearchMode(false);
        setSearchQuery('');
        return;
      }

      // Multiline: submit the full multiline buffer
      if (multilineMode) {
        const full = [...multilineBuffer, input].join('\n');
        setMultilineBuffer([]);
        setMultilineMode(false);
        if (!full.trim()) return;
        setHistory((prev) => [full, ...prev]);
        setHistoryIndex(-1);
        onSubmit(full);
        setValue('');
        return;
      }

      if (!input.trim()) return;
      setHistory((prev) => [input, ...prev]);
      setHistoryIndex(-1);
      setCompletions([]);
      setCompletionIndex(-1);
      onSubmit(input);
      setValue('');
    },
    [disabled, loading, onSubmit, searchMode, multilineMode, multilineBuffer],
  );

  useInput((input, key) => {
    if (disabled || loading) return;

    // Tab: cycle through completions
    if (key.tab && !searchMode) {
      if (completions.length > 0) {
        const nextIdx = (completionIndex + 1) % completions.length;
        setCompletionIndex(nextIdx);
        // Replace the prefix portion of input with the completion
        const trimmed = value.trimStart();
        if (trimmed.startsWith('/')) {
          // Slash command: replace whole first word
          const rest = trimmed.includes(' ') ? trimmed.slice(trimmed.indexOf(' ')) : '';
          setValue(completions[nextIdx] + rest);
        } else {
          // File path or other: replace last word
          const words = value.split(/\s+/);
          words[words.length - 1] = completions[nextIdx];
          setValue(words.join(' '));
        }
      }
      return;
    }

    // Ctrl+R: toggle reverse search
    if (key.ctrl && input === 'r') {
      if (searchMode) {
        if (searchResults.length > 0) {
          const next = (searchIndex + 1) % searchResults.length;
          setSearchIndex(next);
          setValue(searchResults[next]);
        }
      } else {
        setSearchMode(true);
        setSearchQuery('');
      }
      return;
    }

    // Escape: exit search mode, multiline mode, or dismiss completions
    if (key.escape) {
      if (searchMode) {
        setSearchMode(false);
        setSearchQuery('');
        setValue('');
        return;
      }
      if (multilineMode) {
        setMultilineMode(false);
        setMultilineBuffer([]);
        return;
      }
      if (completionIndex >= 0) {
        setCompletionIndex(-1);
        return;
      }
    }

    // In search mode, type to filter
    if (searchMode) {
      if (key.backspace || key.delete) {
        setSearchQuery(q => q.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta && !key.escape && input.length === 1) {
        setSearchQuery(q => q + input);
        return;
      }
      if (key.return) {
        setSearchMode(false);
        setSearchQuery('');
        return;
      }
      return;
    }

    // Ctrl+J: toggle multiline mode
    if (key.ctrl && input === 'j') {
      if (!multilineMode) {
        setMultilineMode(true);
        if (value.trim()) {
          setMultilineBuffer([value]);
          setValue('');
        }
      } else {
        setMultilineBuffer(prev => [...prev, value]);
        setValue('');
      }
      return;
    }

    // History navigation
    if (!searchMode) {
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
    }
  });

  // Determine if input starts with ! (shell mode)
  const isShellMode = value.startsWith('!');
  const isSlashCmd = value.startsWith('/');

  if (loading) {
    return (
      <Box flexDirection="column">
        <Box paddingLeft={0}>
          <Text color={barColor} bold>{'\u258c'}</Text>
          <Text> </Text>
          <Text>{spinnerText}</Text>
        </Box>
      </Box>
    );
  }

  // Ghost completion text (show first match when not actively cycling)
  const ghostText = (!searchMode && !multilineMode && completions.length > 0 && completionIndex < 0 && value)
    ? completions[0].slice(completionPrefix.length)
    : '';

  return (
    <Box flexDirection="column">
      {/* Reverse search indicator */}
      {searchMode && (
        <Box paddingLeft={2}>
          <Text color="#22D3EE">(reverse-i-search)`{searchQuery}': </Text>
          {searchResults.length > 0 && (
            <Text dimColor>{searchResults[searchIndex]}</Text>
          )}
          {searchResults.length === 0 && searchQuery && (
            <Text color="#64748B" italic>no match</Text>
          )}
        </Box>
      )}

      {/* Multiline buffer display */}
      {multilineMode && multilineBuffer.length > 0 && (
        <Box flexDirection="column" paddingLeft={2}>
          {multilineBuffer.map((line, i) => (
            <Box key={i}>
              <Text color="#64748B">{i === 0 ? '\u250c ' : '\u2502 '}</Text>
              <Text>{line}</Text>
            </Box>
          ))}
          <Box>
            <Text color="#64748B">{'\u2514 '}</Text>
            <Text dimColor italic>(Ctrl+J to add line, Enter to submit)</Text>
          </Box>
        </Box>
      )}

      {/* Prompt input line */}
      <Box paddingLeft={0}>
        <Text color={barColor} bold>{'\u258c'}</Text>
        <Text> </Text>
        {isShellMode ? (
          <Text color="#FB923C" bold>{'$ '}</Text>
        ) : multilineMode ? (
          <Text color="#22D3EE" bold>{'\u250a '}</Text>
        ) : (
          <Text color={barColor} bold>{'\u276f '}</Text>
        )}
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={disabled ? '' : searchMode ? 'type to search...' : 'Message Friday...'}
        />
        {ghostText && (
          <Text color="#475569">{ghostText}</Text>
        )}
      </Box>

      {/* Autocomplete dropdown (show up to 5 matches) */}
      {completions.length > 0 && value && !searchMode && !multilineMode && (isSlashCmd || value.includes('@')) && (
        <Box flexDirection="column" paddingLeft={4}>
          {completions.slice(0, 6).map((item, i) => (
            <Box key={item}>
              <Text color={i === completionIndex ? '#A78BFA' : '#64748B'} bold={i === completionIndex}>
                {i === completionIndex ? '\u25b8 ' : '  '}{item}
              </Text>
            </Box>
          ))}
          {completions.length > 6 && (
            <Text dimColor>  ...{completions.length - 6} more (Tab to cycle)</Text>
          )}
        </Box>
      )}

      {/* Suggestion hint (only when input is empty and no completions showing) */}
      {suggestion && !value && !searchMode && !multilineMode && (
        <Box paddingLeft={4}>
          <Text color="#475569" italic>{suggestion}</Text>
        </Box>
      )}
    </Box>
  );
}
