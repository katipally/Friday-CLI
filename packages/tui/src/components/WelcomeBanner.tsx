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
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan" bold>
        {`
  ███████╗██████╗ ██╗██████╗  █████╗ ██╗   ██╗
  ██╔════╝██╔══██╗██║██╔══██╗██╔══██╗╚██╗ ██╔╝
  █████╗  ██████╔╝██║██║  ██║███████║ ╚████╔╝
  ██╔══╝  ██╔══██╗██║██║  ██║██╔══██║  ╚██╔╝
  ██║     ██║  ██║██║██████╔╝██║  ██║   ██║
  ╚═╝     ╚═╝  ╚═╝╚═╝╚═════╝ ╚═╝  ╚═╝   ╚═╝`}
      </Text>
      <Box marginLeft={2} marginTop={1} gap={2}>
        <Text color="gray">v{version}</Text>
        <Text color="gray">|</Text>
        <Text color="green">{provider}/{model}</Text>
        {mode && (
          <>
            <Text color="gray">|</Text>
            <Text color="magenta">mode:{mode}</Text>
          </>
        )}
        {projectType && (
          <>
            <Text color="gray">|</Text>
            <Text color="yellow">{projectType}</Text>
          </>
        )}
      </Box>
      <Box marginLeft={2} marginTop={0} gap={2}>
        <Text color="gray" dimColor>
          Open-source AI coding agent • github.com/katipally/fridaycode
        </Text>
        <Text color="gray">|</Text>
        <Text color="cyan">Type /help for commands</Text>
      </Box>
    </Box>
  );
};
