import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  model: string;
  provider: string;
  tokenCount: { input: number; output: number };
  state: string;
  gitBranch?: string;
  permissionMode?: 'default' | 'acceptAll' | 'plan';
  turnDuration?: number;
  cost?: number;
  sessionName?: string;
}

export function StatusBar({ model, provider, tokenCount, state }: StatusBarProps) {
  return (
    <Box paddingX={0} marginTop={0}>
      <Text dimColor>{'─'.repeat(60)}</Text>
    </Box>
  );
}

// Compact inline status shown above prompt
export function StatusLine({
  model,
  provider,
  tokenCount,
  state,
  gitBranch,
  permissionMode = 'default',
  turnDuration,
  cost,
  sessionName,
}: StatusBarProps) {
  const totalTokens = tokenCount.input + tokenCount.output;

  // State indicator with animation feel
  const stateIcon = state === 'streaming' ? '●'
    : state === 'tool-running' ? '⟳'
    : state === 'loading' ? '◌'
    : '●';
  const stateColor = state === 'streaming' ? '#A3E635'
    : state === 'tool-running' ? '#22D3EE'
    : state === 'loading' ? '#8B5CF6'
    : '#475569';

  // Permission mode indicator
  const modeIcon = permissionMode === 'acceptAll' ? '⏵⏵'
    : permissionMode === 'plan' ? '⏸'
    : '';
  const modeColor = permissionMode === 'acceptAll' ? '#A3E635'
    : permissionMode === 'plan' ? '#FBBF24'
    : '';

  return (
    <Box paddingX={0} gap={1} marginBottom={0}>
      {/* State dot */}
      <Text color={stateColor}>{stateIcon}</Text>

      {/* Provider/model */}
      <Text dimColor>{provider}/</Text>
      <Text color="#A78BFA">{model || 'auto'}</Text>

      {/* Permission mode */}
      {modeIcon && (
        <Text color={modeColor}>{modeIcon}</Text>
      )}

      {/* Git branch */}
      {gitBranch && (
        <>
          <Text dimColor>·</Text>
          <Text color="#FBBF24">⎇ {gitBranch}</Text>
        </>
      )}

      {/* Token count */}
      {totalTokens > 0 && (
        <>
          <Text dimColor>·</Text>
          <TokenDisplay input={tokenCount.input} output={tokenCount.output} />
        </>
      )}

      {/* Cost */}
      {cost !== undefined && cost > 0 && (
        <>
          <Text dimColor>·</Text>
          <Text color="#A3E635">${cost.toFixed(4)}</Text>
        </>
      )}

      {/* Turn duration */}
      {turnDuration !== undefined && turnDuration > 0 && (
        <>
          <Text dimColor>·</Text>
          <Text dimColor>{formatDuration(turnDuration)}</Text>
        </>
      )}

      {/* Session name */}
      {sessionName && (
        <>
          <Text dimColor>·</Text>
          <Text dimColor italic>{sessionName}</Text>
        </>
      )}
    </Box>
  );
}

function TokenDisplay({ input, output }: { input: number; output: number }) {
  const total = input + output;
  // Color code based on usage
  const color = total > 100000 ? '#F43F5E'
    : total > 50000 ? '#FBBF24'
    : total > 10000 ? '#FB923C'
    : '#64748B';

  return (
    <Text color={color}>
      {formatTokenCount(total)}
      <Text dimColor> ({formatTokenCount(input)}↑ {formatTokenCount(output)}↓)</Text>
    </Text>
  );
}

function formatTokenCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}
