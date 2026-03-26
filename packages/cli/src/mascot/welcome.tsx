import React from 'react';
import { Box, Text } from 'ink';
import type { Settings } from '@fridaycode/shared';
import { renderLargeSpider } from './spider.js';

interface WelcomeScreenProps {
  settings: Settings;
  cwd: string;
}

export function WelcomeScreen({ settings, cwd }: WelcomeScreenProps) {
  const spider = settings.showSpider !== false ? renderLargeSpider('greeting') : '';
  const projectName = cwd.split('/').pop() ?? cwd;

  return (
    <Box flexDirection="column" alignItems="center" paddingY={0}>
      {settings.showSpider !== false && (
        <Text>{spider}</Text>
      )}

      <Text color="#8B5CF6" bold>
        {'  '}◆ FridayCode
      </Text>

      <Box marginTop={0}>
        <Text dimColor>
          AI-powered coding assistant in your terminal
        </Text>
      </Box>

      <Box marginTop={1} gap={1} flexDirection="column" alignItems="center">
        <Text>
          <Text dimColor>provider </Text>
          <Text color="#A3E635" bold>{settings.activeProvider}</Text>
          <Text dimColor>  model </Text>
          <Text color="#A3E635" bold>{settings.activeModel || '(auto)'}</Text>
        </Text>
        <Text>
          <Text dimColor>cwd </Text>
          <Text color="#8B5CF6">{projectName}/</Text>
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          Type a message to chat · /help for commands · Ctrl+C to exit
        </Text>
      </Box>
    </Box>
  );
}
