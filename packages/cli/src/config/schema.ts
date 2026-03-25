import { z } from 'zod';

export const providerConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string().optional(),
});

export const permissionsConfigSchema = z.object({
  autoApproveRead: z.boolean().default(true),
  autoApproveWrite: z.boolean().default(false),
  blockedCommands: z.array(z.string()).default(['rm -rf /', 'sudo rm']),
  workspaceOnly: z.boolean().default(true),
});

export const costBudgetSchema = z.object({
  perSession: z.number().nullable().default(null),
  perDay: z.number().nullable().default(null),
});

export const mcpServerSchema = z.object({
  name: z.string(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  transport: z.enum(['stdio', 'http-sse']).default('stdio'),
});

export const fridayConfigSchema = z.object({
  defaultProvider: z.string().default('openai'),
  defaultModel: z.string().default('gpt-4o'),
  providers: z.record(z.string(), providerConfigSchema).default({}),
  permissions: permissionsConfigSchema.default({}),
  theme: z.string().default('dark'),
  language: z.string().default('en'),
  telemetry: z.boolean().default(false),
  maxIterations: z.number().min(1).max(200).default(50),
  costBudget: costBudgetSchema.default({}),
  mcp: z.object({
    servers: z.array(mcpServerSchema).default([]),
  }).default({}),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().optional(),
});

export type FridayConfig = z.infer<typeof fridayConfigSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
