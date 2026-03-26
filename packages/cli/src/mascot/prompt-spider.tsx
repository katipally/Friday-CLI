import React from 'react';
import { Box, Text } from 'ink';
import type { SpiderExpression } from '@fridaycode/shared';
import { COLORS } from '@fridaycode/shared';
import { renderSmallSpider } from './renderer.js';

interface PromptSpiderProps {
  expression: SpiderExpression;
}

export function PromptSpider({ expression }: PromptSpiderProps) {
  return (
    <Box>
      <Text>{renderSmallSpider(expression)}</Text>
    </Box>
  );
}
