import React from 'react';
import { Box, Text } from 'ink';
import type { Settings } from '@fridaycode/shared';
import { renderLogo, renderCompactLogo } from './logo.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface WelcomeScreenProps {
  settings: Settings;
  cwd: string;
}

function detectProjectInfo(cwd: string): { name: string; tech: string; gitBranch: string } {
  const name = cwd.split('/').pop() ?? cwd;
  let tech = '';
  let gitBranch = '';

  try {
    if (fs.existsSync(path.join(cwd, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
      const deps = Object.keys(pkg.dependencies ?? {}).concat(Object.keys(pkg.devDependencies ?? {}));
      if (deps.includes('next')) tech = 'Next.js';
      else if (deps.includes('react')) tech = 'React';
      else if (deps.includes('vue')) tech = 'Vue';
      else if (deps.includes('svelte')) tech = 'Svelte';
      else if (deps.includes('express')) tech = 'Express';
      else tech = 'Node.js';
    } else if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) tech = 'Rust';
    else if (fs.existsSync(path.join(cwd, 'go.mod'))) tech = 'Go';
    else if (fs.existsSync(path.join(cwd, 'requirements.txt')) || fs.existsSync(path.join(cwd, 'pyproject.toml'))) tech = 'Python';
  } catch { /* ignore */ }

  try {
    const { execSync } = require('node:child_process');
    gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8', timeout: 2000 }).trim();
  } catch { /* ignore */ }

  return { name, tech, gitBranch };
}

function countSkills(cwd: string): number {
  const builtIn = 4; // batch, debug, loop, simplify
  try {
    const skillDir = path.join(cwd, '.friday', 'skills');
    if (fs.existsSync(skillDir)) {
      return builtIn + fs.readdirSync(skillDir).filter(f => f.endsWith('.md')).length;
    }
  } catch { /* ignore */ }
  return builtIn;
}

function countMcpServers(settings: Settings): number {
  return Object.keys(settings.mcpServers ?? {}).length;
}

function hasFridayMd(cwd: string): boolean {
  return fs.existsSync(path.join(cwd, 'FRIDAY.md'));
}

const TIPS = [
  'Use @filename to reference files in your prompt',
  'Type !command to run shell commands directly',
  '/compact to save context when conversation gets long',
  '/model to switch between AI models',
  'Ctrl+C to abort a running operation',
  '/diff to see git changes made during the session',
  '/help lists all available commands',
];

export function WelcomeScreen({ settings, cwd }: WelcomeScreenProps) {
  const { name: projectName, tech, gitBranch } = detectProjectInfo(cwd);
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  const skillCount = countSkills(cwd);
  const mcpCount = countMcpServers(settings);
  const hasMemory = hasFridayMd(cwd);

  return (
    <Box flexDirection="column" paddingY={0}>
      {/* ASCII art logo */}
      <Box flexDirection="column" alignItems="center">
        <Text>{renderLogo()}</Text>
        <Text dimColor>v0.1.0</Text>
      </Box>

      {/* Separator */}
      <Box marginTop={0}>
        <Text dimColor>{'─'.repeat(60)}</Text>
      </Box>

      {/* Provider / model info */}
      <Box marginTop={1} gap={1} flexDirection="column" paddingLeft={2}>
        <Box gap={2}>
          <Text>
            <Text dimColor>provider </Text>
            <Text color="#A3E635" bold>{settings.activeProvider}</Text>
          </Text>
          <Text>
            <Text dimColor>model </Text>
            <Text color="#A3E635" bold>{settings.activeModel || '(auto)'}</Text>
          </Text>
        </Box>

        <Box gap={2}>
          <Text>
            <Text dimColor>project </Text>
            <Text color="#8B5CF6" bold>{projectName}/</Text>
            {tech && <Text color="#22D3EE"> ({tech})</Text>}
          </Text>
          {gitBranch && (
            <Text>
              <Text dimColor>branch </Text>
              <Text color="#FBBF24">⎇ {gitBranch}</Text>
            </Text>
          )}
        </Box>

        {/* Loaded resources */}
        <Box gap={2}>
          <Text dimColor>
            {skillCount} skills
          </Text>
          {mcpCount > 0 && (
            <Text dimColor>
              {mcpCount} MCP server{mcpCount !== 1 ? 's' : ''}
            </Text>
          )}
          {hasMemory && (
            <Text dimColor>FRIDAY.md loaded</Text>
          )}
        </Box>
      </Box>

      {/* Tip + help */}
      <Box marginTop={1} flexDirection="column" paddingLeft={2}>
        <Text dimColor italic>
          💡 {tip}
        </Text>
        <Box marginTop={0}>
          <Text dimColor>
            Type a message · <Text color="#64748B">/help</Text> for commands · <Text color="#64748B">Ctrl+C</Text> to exit
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
