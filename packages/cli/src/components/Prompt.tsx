import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getPromptBarColor, getSpinnerFrame } from '../branding/spinner.js';

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
  vimMode?: boolean;
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
  vimMode,
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

      // Multiline: Shift+Enter (detected in useInput) adds to buffer
      if (multilineMode) {
        // Submit the full multiline buffer
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
      onSubmit(input);
      setValue('');
    },
    [disabled, loading, onSubmit, searchMode, multilineMode, multilineBuffer],
  );

  useInput((input, key) => {
    if (disabled || loading) return;

    // Ctrl+R: toggle reverse search
    if (key.ctrl && input === 'r') {
      if (searchMode) {
        // Cycle through search results
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

    // Escape: exit search mode or multiline mode
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
        // Add current line and prepare for next
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
              <Text color="#64748B">{i === 0 ? '┌ ' : '│ '}</Text>
              <Text>{line}</Text>
            </Box>
          ))}
          <Box>
            <Text color="#64748B">{'└ '}</Text>
            <Text dimColor italic>(Ctrl+J to add line, Enter to submit)</Text>
          </Box>
        </Box>
      )}

      {/* Prompt bar with model/mode info */}
      <Box paddingLeft={0}>
        <Text color={barColor} bold>{'▌'}</Text>
        <Text> </Text>
        {isShellMode ? (
          <Text color="#FB923C" bold>{'$ '}</Text>
        ) : multilineMode ? (
          <Text color="#22D3EE" bold>{'┊ '}</Text>
        ) : (
          <Text color={barColor} bold>{'❯ '}</Text>
        )}
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={disabled ? '' : searchMode ? 'type to search...' : 'Message Friday...'}
        />
      </Box>

      {/* Sub-line: mode indicator + model */}
      <Box paddingLeft={2} gap={1}>
        {permissionMode !== 'default' && (
          <Text color={modeInfo.color}>
            {modeInfo.icon} {modeInfo.label}
          </Text>
        )}
        {multilineMode && (
          <Text color="#22D3EE">multiline</Text>
        )}
        {model && (
          <Text dimColor>{model}</Text>
        )}
        {turnDuration !== undefined && turnDuration > 0 && (
          <Text dimColor>· took {formatDuration(turnDuration)}</Text>
        )}
      </Box>

      {/* Suggestion ghost text */}
      {suggestion && !value && !searchMode && !multilineMode && (
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
