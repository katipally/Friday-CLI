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
  return (
    <Box flexDirection="column" paddingX={1} marginBottom={1}>
      <Box gap={1}>
        <Text color="green" bold>
          {'\u2733'}
        </Text>
        <Text color="white" bold>
          FridayCode
        </Text>
        <Text color="gray" dimColor>
          v{version}
        </Text>
      </Box>

      <Box marginLeft={2} flexDirection="column">
        <Box gap={1}>
          <Text color="gray">Model:</Text>
          <Text color="cyan">{provider}/{model}</Text>
          {mode && mode !== 'code' && (
            <>
              <Text color="gray">{'\u00B7'}</Text>
              <Text color="magenta">{mode} mode</Text>
            </>
          )}
          {projectType && (
            <>
              <Text color="gray">{'\u00B7'}</Text>
              <Text color="yellow">{projectType}</Text>
            </>
          )}
        </Box>
        <Box gap={1}>
          <Text color="gray" dimColor>
            /help for commands {'\u00B7'} Ctrl+C to exit {'\u00B7'} Ctrl+L to clear
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
