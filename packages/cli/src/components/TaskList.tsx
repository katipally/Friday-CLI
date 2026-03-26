import React from 'react';
import { Box, Text } from 'ink';
import type { AgentInstance } from '@fridaycode/shared';
import { COLORS } from '@fridaycode/shared';

interface TaskListProps {
  tasks: AgentInstance[];
  visible: boolean;
}

export function TaskList({ tasks, visible }: TaskListProps) {
  if (!visible || tasks.length === 0) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={COLORS.deepViolet}
      paddingX={1}
      marginY={1}
    >
      <Text color={COLORS.deepViolet} bold>
        Background Tasks (Ctrl+T to toggle)
      </Text>
      {tasks.map((task) => (
        <Box key={task.id} gap={2}>
          <Text color={getStatusColor(task.status)}>
            {getStatusIcon(task.status)}
          </Text>
          <Text color={COLORS.icySlate}>{task.id.slice(0, 8)}</Text>
          <Text>{task.definition.name}</Text>
          <Text dimColor>
            {task.definition.description?.slice(0, 40) ?? task.definition.initialPrompt?.slice(0, 40) ?? ''}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'running':
      return '⟳';
    case 'completed':
      return '✓';
    case 'failed':
      return '✗';
    case 'stopped':
      return '■';
    default:
      return '?';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'running':
      return COLORS.deepViolet;
    case 'completed':
      return COLORS.acidicPistachio;
    case 'failed':
      return COLORS.starkRose;
    case 'stopped':
      return COLORS.midnightSlate;
    default:
      return COLORS.icySlate;
  }
}
