import { z } from 'zod';

const providerConfigSchema = z.object({
  type: z.enum(['ollama', 'anthropic', 'openai', 'openai-compatible']),
  enabled: z.boolean().default(true),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  name: z.string().optional(),
});

const hookDefSchema = z.object({
  event: z.string(),
  matcher: z.string().optional(),
  command: z.string().optional(),
  url: z.string().optional(),
  timeout: z.number().optional(),
});

const mcpServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});

export const settingsSchema = z.object({
  // Providers
  providers: z.record(providerConfigSchema).default({}),
  activeProvider: z.string().default('ollama'),
  activeModel: z.string().default(''),

  // Permissions
  permissionMode: z.enum(['default', 'acceptAll', 'plan']).default('default'),
  permissions: z
    .object({
      allow: z.array(z.string()).default([]),
      deny: z.array(z.string()).default([]),
    })
    .default({}),

  // Model
  effort: z.enum(['low', 'medium', 'high', 'max', 'auto']).default('high'),
  fastModel: z.string().optional(),
  maxTokens: z.number().default(8192),

  // Session
  disableAutoMemory: z.boolean().default(false),
  disableAutoCompact: z.boolean().default(false),
  compactMessageThreshold: z.number().default(50),

  // UI
  theme: z.enum(['dark', 'light']).default('dark'),
  vimMode: z.boolean().default(false),
  prefersReducedMotion: z.boolean().default(false),
  statusLine: z.boolean().default(true),
  showSpider: z.boolean().default(true),

  // Hooks
  hooks: z.record(z.array(hookDefSchema)).default({}),

  // MCP
  mcpServers: z.record(mcpServerSchema).default({}),

  // Telemetry
  telemetryOptIn: z.boolean().default(false),

  // Attribution
  gitAttribution: z.boolean().default(true),
});

export type SettingsInput = z.input<typeof settingsSchema>;
export type ValidatedSettings = z.output<typeof settingsSchema>;
