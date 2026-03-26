import React from 'react';
import { Text, Box } from 'ink';
import { getTheme } from '../theme.js';
import { Mascot } from './Mascot.js';

interface WelcomeScreenProps {
  version: string;
  model: string;
  provider: string;
  projectName?: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  version,
  model,
  provider,
  projectName,
}) => {
  const theme = getTheme();

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color={theme.colors.primary} bold>
          {`
  ███████╗██████╗ ██╗██████╗  █████╗ ██╗   ██╗
  ██╔════╝██╔══██╗██║██╔══██╗██╔══██╗╚██╗ ██╔╝
  █████╗  ██████╔╝██║██║  ██║███████║ ╚████╔╝
  ██╔══╝  ██╔══██╗██║██║  ██║██╔══██║  ╚██╔╝
  ██║     ██║  ██║██║██████╔╝██║  ██║   ██║
  ╚═╝     ╚═╝  ╚═╝╚═╝╚═════╝ ╚═╝  ╚═╝   ╚═╝`}
        </Text>
      </Box>

      <Mascot mood="greeting" compact />

      <Box marginY={1} flexDirection="column">
        <Text color={theme.colors.textDim}>
          {theme.icons.model} Model: <Text color={theme.colors.accent}>{model}</Text>
          <Text color={theme.colors.textDim}> ({provider})</Text>
        </Text>
        {projectName && (
          <Text color={theme.colors.textDim}>
            📁 Project: <Text color={theme.colors.text}>{projectName}</Text>
          </Text>
        )}
        <Text color={theme.colors.textDim}>
          📦 Version: <Text color={theme.colors.text}>v{version}</Text>
        </Text>
      </Box>

      <Box borderStyle="single" borderColor={theme.colors.border} paddingX={1}>
        <Text color={theme.colors.textDim}>
          Type a message to start • <Text color={theme.colors.primary}>/help</Text> for commands • <Text color={theme.colors.primary}>Ctrl+C</Text> to exit
        </Text>
      </Box>
    </Box>
  );
};
