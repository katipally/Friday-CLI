import React from 'react';
import { Box, Text } from 'ink';

interface WelcomeBannerProps {
  version: string;
  model: string;
  provider: string;
  mode?: string;
  projectType?: string;
}

export const WelcomeBanner: React.FC<WelcomeBannerProps> = ({
  version,
  model,
  provider,
  mode,
  projectType,
}) => {
  const modeStr = mode && mode !== 'code' ? ` (${mode} mode)` : '';
  const projStr = projectType ? ` in ${projectType} project` : '';

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="gray" dimColor>
        {'\u2500'.repeat(60)}
      </Text>
      <Box paddingX={1} flexDirection="column">
        <Box gap={1}>
          <Text color="cyan" bold>
            {'\u2592'}
          </Text>
          <Text bold>FridayCode</Text>
          <Text dimColor>v{version}</Text>
        </Box>
        <Text dimColor>
          {'  '}{provider}/{model}{modeStr}{projStr}
        </Text>
        <Text dimColor>
          {'  '}/help for commands, Ctrl-C to exit
        </Text>
      </Box>
      <Text color="gray" dimColor>
        {'\u2500'.repeat(60)}
      </Text>
    </Box>
  );
};
