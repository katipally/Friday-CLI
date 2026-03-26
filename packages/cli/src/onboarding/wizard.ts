import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { getConfigDir, createLogger } from '@fridaycode/shared';
import { saveConfig, ensureConfigDir } from '../config/loader.js';

const logger = createLogger('onboarding');

const PROVIDERS = [
  { name: 'openai', label: 'OpenAI', envKey: 'OPENAI_API_KEY', defaultModel: 'gpt-4o' },
  { name: 'anthropic', label: 'Anthropic', envKey: 'ANTHROPIC_API_KEY', defaultModel: 'claude-sonnet-4-20250514' },
  { name: 'gemini', label: 'Google Gemini', envKey: 'GOOGLE_API_KEY', defaultModel: 'gemini-2.0-flash' },
  { name: 'ollama', label: 'Ollama (local)', envKey: '', defaultModel: 'llama3.1' },
  { name: 'mistral', label: 'Mistral AI', envKey: 'MISTRAL_API_KEY', defaultModel: 'mistral-large-latest' },
  { name: 'groq', label: 'Groq', envKey: 'GROQ_API_KEY', defaultModel: 'llama-3.1-70b-versatile' },
  { name: 'deepseek', label: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY', defaultModel: 'deepseek-chat' },
  { name: 'azure', label: 'Azure OpenAI', envKey: 'AZURE_OPENAI_API_KEY', defaultModel: 'gpt-4o' },
  { name: 'bedrock', label: 'AWS Bedrock', envKey: 'AWS_ACCESS_KEY_ID', defaultModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0' },
  { name: 'cohere', label: 'Cohere', envKey: 'COHERE_API_KEY', defaultModel: 'command-r-plus' },
  { name: 'together', label: 'Together AI', envKey: 'TOGETHER_API_KEY', defaultModel: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo' },
];

function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

export function needsOnboarding(): boolean {
  const configPath = path.join(getConfigDir(), 'config.json');
  return !fs.existsSync(configPath);
}

export function detectApiKeys(): { provider: string; envKey: string }[] {
  return PROVIDERS.filter((p) => p.envKey && process.env[p.envKey]).map((p) => ({
    provider: p.name,
    envKey: p.envKey,
  }));
}

export async function runOnboarding(): Promise<void> {
  const rl = createInterface();

  try {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║     🌟 Welcome to Friday CLI! 🌟        ║');
    console.log('║   Open-source AI coding agent            ║');
    console.log('╚══════════════════════════════════════════╝\n');

    // Detect existing API keys
    const detected = detectApiKeys();
    if (detected.length > 0) {
      console.log('✅ Detected API keys in environment:');
      detected.forEach((d) => console.log(`   • ${d.provider} (${d.envKey})`));
      console.log();
    }

    // Provider selection
    console.log('Available providers:');
    PROVIDERS.forEach((p, i) => {
      const envStatus = p.envKey && process.env[p.envKey] ? ' ✅' : p.envKey ? '' : ' (no key needed)';
      console.log(`  ${i + 1}. ${p.label}${envStatus}`);
    });
    console.log();

    const providerChoice = await ask(rl, 'Choose your default provider (1-11, or name): ');
    let selectedProvider = PROVIDERS[0];

    const idx = parseInt(providerChoice, 10);
    if (idx >= 1 && idx <= PROVIDERS.length) {
      selectedProvider = PROVIDERS[idx - 1];
    } else {
      const found = PROVIDERS.find(
        (p) => p.name.toLowerCase() === providerChoice.toLowerCase() ||
               p.label.toLowerCase() === providerChoice.toLowerCase(),
      );
      if (found) selectedProvider = found;
    }

    console.log(`\n→ Selected: ${selectedProvider.label}`);

    // API key setup
    const providers: Record<string, { apiKey?: string; baseUrl?: string }> = {};

    if (selectedProvider.envKey) {
      const existingKey = process.env[selectedProvider.envKey];
      if (existingKey) {
        console.log(`  Using ${selectedProvider.envKey} from environment`);
        providers[selectedProvider.name] = { apiKey: existingKey };
      } else {
        const apiKey = await ask(rl, `  Enter your ${selectedProvider.label} API key: `);
        if (apiKey) {
          providers[selectedProvider.name] = { apiKey };
          console.log('  ✅ API key saved');
        } else {
          console.log(`  ⚠️  No key provided. Set ${selectedProvider.envKey} env var later.`);
        }
      }
    }

    if (selectedProvider.name === 'ollama') {
      const host = await ask(rl, '  Ollama host (default: http://localhost:11434): ');
      providers.ollama = { baseUrl: host || 'http://localhost:11434' };
    }

    // Model selection
    const modelChoice = await ask(
      rl,
      `\nDefault model (press Enter for ${selectedProvider.defaultModel}): `,
    );
    const model = modelChoice || selectedProvider.defaultModel;

    // Theme
    const themeChoice = await ask(rl, '\nTheme - dark or light (default: dark): ');
    const theme = themeChoice === 'light' ? 'light' : 'dark';

    // Save config
    ensureConfigDir();
    const config = {
      defaultProvider: selectedProvider.name,
      defaultModel: model,
      providers,
      theme,
      telemetry: false,
    };

    saveConfig(config, true);

    console.log(`\n✅ Configuration saved to ${path.join(getConfigDir(), 'config.json')}`);
    console.log('\n📋 Quick tips:');
    console.log('   • Type a message to chat with AI');
    console.log('   • Use /help to see all commands');
    console.log('   • Use /model to switch models');
    console.log('   • Create FRIDAY.md for project-specific instructions');
    console.log('   • Press Ctrl+C to exit\n');
  } finally {
    rl.close();
  }
}

export function generateFridayMd(projectPath: string = process.cwd()): string {
  const projectName = path.basename(projectPath);

  return `# ${projectName} — Friday Instructions

## Project Overview
<!-- Describe your project here. Friday will use this context for all responses. -->
This is the ${projectName} project.

## Tech Stack
<!-- List your technologies so Friday knows what tools and patterns to use -->
- Language: 
- Framework: 
- Database: 
- Testing: 

## Coding Conventions
<!-- Define your coding standards -->
- Use descriptive variable names
- Write tests for new features
- Follow existing code patterns

## Instructions
<!-- Specific instructions for Friday when working in this project -->
- Always run tests after making changes
- Prefer functional patterns where possible
- Keep changes minimal and focused

## File Structure
<!-- Describe important directories and files -->
\`\`\`
${projectName}/
├── src/           # Source code
├── tests/         # Test files
└── docs/          # Documentation
\`\`\`
`;
}
