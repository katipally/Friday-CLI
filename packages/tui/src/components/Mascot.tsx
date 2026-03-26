import React from 'react';
import { Text, Box } from 'ink';
import { getTheme } from '../theme.js';

export type MascotMood = 'happy' | 'thinking' | 'celebrating' | 'error' | 'sleeping' | 'greeting';

const MASCOT_ART: Record<MascotMood, string> = {
  greeting: `
    ╔══════════╗
    ║  ◉    ◉  ║
    ║    ▽▽    ║
    ║  ╰────╯  ║
    ╚══════════╝
       ║║  ║║
    `,
  happy: `
    ┌──────────┐
    │  ◕    ◕  │
    │    ▽▽    │
    │  ╰────╯  │
    └──────────┘
  `,
  thinking: `
    ┌──────────┐
    │  ◑    ◑  │  ?
    │    ▽▽    │ ·
    │  ╰────╯  │·
    └──────────┘
  `,
  celebrating: `
    ┌──────────┐  ✨
    │  ★    ★  │
    │    ▽▽    │ 🎉
    │  ╰════╯  │
    └──────────┘
  `,
  error: `
    ┌──────────┐
    │  ×    ×  │
    │    ▽▽    │
    │  ╰────╯  │ !
    └──────────┘
  `,
  sleeping: `
    ┌──────────┐  z
    │  ─    ─  │   z
    │    ▽▽    │    z
    │  ╰────╯  │
    └──────────┘
  `,
};

interface MascotProps {
  mood?: MascotMood;
  message?: string;
  compact?: boolean;
}

export const Mascot: React.FC<MascotProps> = ({ mood = 'happy', message, compact = false }) => {
  const theme = getTheme();

  if (compact) {
    const faces: Record<MascotMood, string> = {
      greeting: '🤖 Friday',
      happy: '😊',
      thinking: '🤔',
      celebrating: '🎉',
      error: '😵',
      sleeping: '😴',
    };
    return (
      <Box>
        <Text color={theme.colors.primary}>{faces[mood]}</Text>
        {message && <Text color={theme.colors.text}> {message}</Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color={theme.colors.primary}>{MASCOT_ART[mood]}</Text>
      {message && (
        <Box marginLeft={2}>
          <Text color={theme.colors.accent} bold>{message}</Text>
        </Box>
      )}
    </Box>
  );
};
