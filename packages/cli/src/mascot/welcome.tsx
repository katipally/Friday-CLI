import React from 'react';
import { Box, Text } from 'ink';
import type { Settings } from '@fridaycode/shared';
import { APP_NAME, COLORS } from '@fridaycode/shared';
import { renderLargeSpider } from './renderer.js';

interface WelcomeScreenProps {
  settings: Settings;
}

export function WelcomeScreen({ settings }: WelcomeScreenProps) {
  const spider = settings.showSpider !== false ? renderLargeSpider('greeting') : '';

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      {settings.showSpider !== false && (
        <Box>
          <Text>{spider}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={COLORS.deepViolet} bold>
          {'  '}
          {APP_NAME}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color={COLORS.icySlate}>
          AI coding assistant in your terminal
        </Text>
      </Box>

      <Box marginTop={1} gap={2}>
        <Text color={COLORS.midnightSlate}>
          Provider:{' '}
          <Text color={COLORS.acidicPistachio}>{settings.activeProvider}</Text>
        </Text>
        <Text color={COLORS.midnightSlate}>
          Model:{' '}
          <Text color={COLORS.acidicPistachio}>{settings.activeModel}</Text>
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color={COLORS.midnightSlate} dimColor>
          Type a message to start · /help for commands · Ctrl+C to exit
        </Text>
      </Box>
    </Box>
  );
}
