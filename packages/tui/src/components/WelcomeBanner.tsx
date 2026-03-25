import React from 'react';
import { Box, Text } from 'ink';

interface WelcomeBannerProps {
  version: string;
  model: string;
  provider: string;
}

export const WelcomeBanner: React.FC<WelcomeBannerProps> = ({ version, model, provider }) => {
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
        <Text color="gray">|</Text>
        <Text color="gray">Type /help for commands</Text>
      </Box>
      <Box marginLeft={2} marginTop={0}>
        <Text color="gray" dimColor>
          Open-source AI coding agent • github.com/anthropic-ai/friday-cli
        </Text>
      </Box>
    </Box>
  );
};
