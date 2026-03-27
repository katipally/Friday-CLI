import React from 'react';
import { Box, Text, useStdout } from 'ink';

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
  mcpServerCount?: number;
  toolCount?: number;
}

export function StatusBar({ model, provider, tokenCount, state }: StatusBarProps) {
  return (
    <Box paddingX={0} marginTop={0}>
      <Text dimColor>{'─'.repeat(60)}</Text>
    </Box>
  );
}

// Tmux-style status bar — full-width dark background with segmented info
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
  mcpServerCount,
}: StatusBarProps) {
  const { stdout } = useStdout();
  const termWidth = stdout?.columns ?? 80;

  // State indicator
  const stateIcon = state === 'streaming' ? '●'
    : state === 'tool-running' ? '⟳'
    : state === 'loading' ? '◌'
    : '●';
  const stateColor = state === 'streaming' ? '#A3E635'
    : state === 'tool-running' ? '#22D3EE'
    : state === 'loading' ? '#8B5CF6'
    : '#475569';
  const stateLabel = state === 'streaming' ? 'streaming'
    : state === 'tool-running' ? 'running'
    : state === 'loading' ? 'loading'
    : state === 'idle' ? 'ready'
    : state;

  // Permission mode label
  const modeLabel = permissionMode === 'acceptAll' ? 'AUTO'
    : permissionMode === 'plan' ? 'PLAN'
    : 'INT';
  const modeColor = permissionMode === 'acceptAll' ? '#A3E635'
    : permissionMode === 'plan' ? '#FBBF24'
    : '#64748B';

  // Build left segments
  const leftSegments: React.ReactNode[] = [];

  // [friday] badge
  leftSegments.push(
    <Text key="brand" color="#1E293B" backgroundColor="#A78BFA" bold>{' friday '}</Text>
  );

  // State
  leftSegments.push(
    <Text key="sep1" color="#334155"> │ </Text>
  );
  leftSegments.push(
    <Text key="state" color={stateColor}>{stateIcon} {stateLabel}</Text>
  );

  // Provider/model
  leftSegments.push(
    <Text key="sep2" color="#334155"> │ </Text>
  );
  leftSegments.push(
    <Text key="model" color="#22D3EE">{shortModel(model || 'auto')}</Text>
  );

  // Git branch
  if (gitBranch) {
    leftSegments.push(
      <Text key="sep3" color="#334155"> │ </Text>
    );
    leftSegments.push(
      <Text key="git" color="#FBBF24">⎇ {gitBranch}</Text>
    );
  }

  // Build right segments
  const rightSegments: React.ReactNode[] = [];

  // Token count
  if ((tokenCount.input + tokenCount.output) > 0) {
    const total = tokenCount.input + tokenCount.output;
    const tokenColor = total > 100000 ? '#F43F5E'
      : total > 50000 ? '#FBBF24'
      : '#64748B';
    rightSegments.push(
      <Text key="tokens" color={tokenColor}>↑{formatTokenCount(tokenCount.input)} ↓{formatTokenCount(tokenCount.output)}</Text>
    );
  }

  // Turn duration
  if (turnDuration !== undefined && turnDuration > 0) {
    if (rightSegments.length > 0) {
      rightSegments.push(<Text key="sep-dur" color="#334155"> │ </Text>);
    }
    rightSegments.push(
      <Text key="dur" dimColor>{formatDuration(turnDuration)}</Text>
    );
  }

  // Mode
  rightSegments.push(
    <Text key="sep-mode" color="#334155"> │ </Text>
  );
  rightSegments.push(
    <Text key="mode" color={modeColor}>{modeLabel}</Text>
  );

  // MCP
  if (mcpServerCount !== undefined && mcpServerCount > 0) {
    rightSegments.push(
      <Text key="sep-mcp" color="#334155"> │ </Text>
    );
    rightSegments.push(
      <Text key="mcp" color="#22D3EE">⚡{mcpServerCount}</Text>
    );
  }

  // Session
  if (sessionName) {
    rightSegments.push(
      <Text key="sep-session" color="#334155"> │ </Text>
    );
    rightSegments.push(
      <Text key="session" dimColor italic>{sessionName.length > 12 ? sessionName.slice(0, 12) + '…' : sessionName}</Text>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={0}>
      {/* Tmux-style full-width status bar */}
      <Box
        width={termWidth}
        backgroundColor="#0F172A"
        justifyContent="space-between"
      >
        <Box gap={0}>
          {leftSegments}
        </Box>
        <Box gap={0}>
          {rightSegments}
          <Text> </Text>
        </Box>
      </Box>
    </Box>
  );
}

function shortModel(model: string): string {
  // Shorten common model names for a compact display
  if (model.length <= 20) return model;
  // e.g. "claude-sonnet-4-20250514" → "claude-sonnet-4"
  const parts = model.split('-');
  if (parts.length > 3) {
    // Drop date suffix if it looks like YYYYMMDD
    const last = parts[parts.length - 1];
    if (/^\d{8}$/.test(last)) {
      return parts.slice(0, -1).join('-');
    }
  }
  return model.slice(0, 20) + '…';
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
