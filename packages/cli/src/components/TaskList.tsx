import React from 'react';
import { Box, Text } from 'ink';
import type { AgentInstance } from '@fridaycode/shared';

interface TaskListProps {
  tasks: AgentInstance[];
  visible: boolean;
}

export function TaskList({ tasks, visible }: TaskListProps) {
  if (!visible || tasks.length === 0) return null;

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      <Text color="#8B5CF6" bold>Background Tasks</Text>
      {tasks.map((task) => {
        const icon = task.status === 'running' ? '⟳'
          : task.status === 'completed' ? '✓'
          : task.status === 'failed' ? '✗' : '■';
        const color = task.status === 'running' ? '#8B5CF6'
          : task.status === 'completed' ? '#A3E635'
          : task.status === 'failed' ? '#F43F5E' : '#64748B';
        return (
          <Box key={task.id} gap={1} marginLeft={2}>
            <Text color={color}>{icon}</Text>
            <Text>{task.definition.name}</Text>
            <Text dimColor>{task.id.slice(0, 8)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
