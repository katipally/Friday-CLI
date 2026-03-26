# FridayCode Provider Architecture & Dynamic Models

> **Status**: Draft  
> **Target**: v2.0  
> **Scope**: Provider system overhaul — dynamic model discovery, new providers, resilience, cost tracking

---

## Table of Contents

1. [Current State & Problems](#current-state--problems)
2. [Dynamic Model Discovery](#dynamic-model-discovery)
3. [New Providers](#new-providers)
4. [Provider Interface Overhaul](#provider-interface-overhaul)
5. [Retry & Resilience](#retry--resilience)
6. [Cost Tracking Overhaul](#cost-tracking-overhaul)
7. [Configuration](#configuration)
8. [TypeScript Interfaces](#typescript-interfaces)

---

## Current State & Problems

FridayCode currently supports **12 providers**, but the implementation has significant limitations:

### Current Provider Inventory

| Provider      | Models Hardcoded? | Dynamic Fetch? | Status                     |
| ------------- | ----------------- | -------------- | -------------------------- |
| OpenAI        | ✅ Yes            | ❌ No          | Stale model list           |
| Anthropic     | ✅ Yes            | ❌ No          | Stale model list           |
| Google Gemini | ✅ Yes            | ❌ No          | Stale model list           |
| Mistral       | ✅ Yes            | ❌ No          | Stale model list           |
| Groq          | ✅ Yes            | ❌ No          | Stale model list           |
| DeepSeek      | ✅ Yes            | ❌ No          | Stale model list           |
| Together      | ✅ Yes            | ❌ No          | Stale model list           |
| Fireworks     | ✅ Yes            | ❌ No          | Stale model list           |
| Cohere        | ✅ Yes            | ❌ No          | Stale model list           |
| Ollama        | ❌ No             | ✅ Yes         | ✅ Only one doing it right |
| OpenRouter    | ❌ Not added yet  | —              | Needs implementation       |
| xAI / Grok    | ❌ Not added yet  | —              | Needs implementation       |

### Key Problems

1. **Hardcoded model lists go stale immediately.** When providers release new models (which happens weekly), FridayCode users can't access them until we ship a code update.
2. **No capability metadata.** We don't know which models support tools, vision, streaming, or what their context windows are. This causes runtime failures.
3. **No resilience.** A single API failure = user-visible error. No retries, no fallbacks, no circuit breaking.
4. **Cost tracking is post-hoc.** We tell users what they spent AFTER the request, not before. Budget enforcement is broken.
5. **Missing major providers.** OpenRouter (200+ models from one API key) and xAI/Grok are not supported.

---

## Dynamic Model Discovery

### Core Principle

> **Every provider MUST fetch its model list from the API at runtime.** Hardcoded lists are only used as a last-resort fallback when the API is unreachable AND no cached data exists.

### API Endpoints (Verified 2025)

#### OpenAI

```
GET https://api.openai.com/v1/models
Authorization: Bearer <API_KEY>
```

Response shape:

```json
{
  "data": [
    {
      "id": "gpt-4o",
      "object": "model",
      "created": 1715367049,
      "owned_by": "system"
    }
  ]
}
```

**Filtering**: Only include models where `id` starts with `gpt-`, `o1-`, `o3-`, `o4-`, or `chatgpt-`. Exclude fine-tune IDs (contain `ft:`), embedding models, and moderation models.

---

#### Anthropic

```
GET https://api.anthropic.com/v1/models
x-api-key: <API_KEY>
anthropic-version: 2023-06-01
```

Response shape:

```json
{
  "data": [
    {
      "id": "claude-sonnet-4-20250514",
      "display_name": "Claude Sonnet 4",
      "type": "model",
      "created_at": "2025-05-14T00:00:00Z"
    }
  ]
}
```

**Filtering**: Include all returned models (Anthropic only returns chat models). Prefer display names for UI.

---

#### Google Gemini

```
GET https://generativelanguage.googleapis.com/v1beta/models?key=<API_KEY>
```

Response shape:

```json
{
  "models": [
    {
      "name": "models/gemini-2.0-flash",
      "displayName": "Gemini 2.0 Flash",
      "supportedGenerationMethods": ["generateContent", "streamGenerateContent"],
      "inputTokenLimit": 1048576,
      "outputTokenLimit": 8192
    }
  ]
}
```

**Filtering**: Only include models where `supportedGenerationMethods` includes `generateContent`. Strip `models/` prefix for model ID.

---

#### Mistral

```
GET https://api.mistral.ai/v1/models
Authorization: Bearer <API_KEY>
```

Response shape:

```json
{
  "data": [
    {
      "id": "mistral-large-latest",
      "object": "model",
      "created": 1715367049,
      "owned_by": "mistralai",
      "capabilities": {
        "completion_chat": true,
        "function_calling": true,
        "vision": false
      },
      "max_context_length": 128000
    }
  ]
}
```

**Filtering**: Only include models where `capabilities.completion_chat` is `true`.

---

#### Groq

```
GET https://api.groq.com/openai/v1/models
Authorization: Bearer <API_KEY>
```

Response follows OpenAI format. **Filtering**: Include all models (Groq only serves chat models).

---

#### DeepSeek

```
GET https://api.deepseek.com/v1/models
Authorization: Bearer <API_KEY>
```

Response follows OpenAI format. **Filtering**: Include all returned models.

---

#### Together

```
GET https://api.together.xyz/v1/models
Authorization: Bearer <API_KEY>
```

Response shape:

```json
{
  "data": [
    {
      "id": "meta-llama/Llama-3-70b-chat-hf",
      "object": "model",
      "type": "chat",
      "context_length": 8192,
      "pricing": {
        "input": 0.0009,
        "output": 0.0009
      }
    }
  ]
}
```

**Filtering**: Only include models where `type` is `"chat"` or `"language"`.

---

#### Fireworks

```
GET https://api.fireworks.ai/inference/v1/models
Authorization: Bearer <API_KEY>
```

Response follows OpenAI format with extensions. **Filtering**: Include models suitable for chat completion.

---

#### Cohere

```
GET https://api.cohere.com/v2/models
Authorization: Bearer <API_KEY>
```

Response shape:

```json
{
  "models": [
    {
      "name": "command-r-plus",
      "endpoints": ["chat", "generate"],
      "context_length": 128000,
      "tokenizer_url": "..."
    }
  ]
}
```

**Filtering**: Only include models where `endpoints` includes `"chat"`.

---

#### Ollama (Local)

```
GET http://localhost:11434/api/tags
(No authentication required)
```

Response shape:

```json
{
  "models": [
    {
      "name": "llama3:latest",
      "model": "llama3:latest",
      "size": 4661224676,
      "digest": "...",
      "details": {
        "parameter_size": "8B",
        "quantization_level": "Q4_0"
      }
    }
  ]
}
```

**Filtering**: Include all models. **Note**: Ollama runs locally so this already works correctly in the current codebase.

---

#### OpenRouter (NEW — Meta-Provider)

```
GET https://openrouter.ai/api/v1/models
Authorization: Bearer <API_KEY>
```

Response shape:

```json
{
  "data": [
    {
      "id": "anthropic/claude-sonnet-4",
      "name": "Claude Sonnet 4",
      "pricing": {
        "prompt": "0.000003",
        "completion": "0.000015"
      },
      "context_length": 200000,
      "top_provider": {
        "max_completion_tokens": 8192
      },
      "architecture": {
        "modality": "text+image->text",
        "tokenizer": "Claude",
        "instruct_type": "claude"
      }
    }
  ]
}
```

**Filtering**: Include all models (OpenRouter curates its list). **Note**: OpenRouter provides 200+ models from all major providers through a single API key.

---

#### xAI / Grok (NEW)

```
GET https://api.x.ai/v1/models
Authorization: Bearer <API_KEY>
```

Response follows OpenAI format. **Filtering**: Include all returned models.

---

### Caching Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                    Model Discovery Flow                       │
│                                                              │
│  Request for model list                                       │
│         │                                                    │
│         ▼                                                    │
│  ┌─ Cache Check ─┐                                           │
│  │  < 1 hour old? │── Yes ──▸ Return cached list             │
│  └───────┬───────┘                                           │
│          │ No / Missing                                       │
│          ▼                                                    │
│  ┌─ API Request ──┐                                           │
│  │  Fetch models  │── Success ──▸ Update cache ──▸ Return     │
│  └───────┬───────┘                                           │
│          │ Failure                                            │
│          ▼                                                    │
│  ┌─ Stale Cache? ─┐                                          │
│  │  Any age        │── Yes ──▸ Return stale + warning         │
│  └───────┬───────┘                                           │
│          │ No cache at all                                    │
│          ▼                                                    │
│  Return hardcoded defaults (minimal set)                      │
│  + show "API unreachable" warning                            │
└──────────────────────────────────────────────────────────────┘
```

**Cache location**: `~/.friday/cache/models/<provider>.json`

**Cache format**:

```json
{
  "provider": "openai",
  "fetchedAt": "2025-01-15T10:30:00Z",
  "expiresAt": "2025-01-15T11:30:00Z",
  "models": [
    {
      "id": "gpt-4o",
      "name": "GPT-4o",
      "capabilities": { "...": "..." }
    }
  ]
}
```

**Cache rules**:

- TTL: **1 hour** by default, configurable per provider
- `/models` command: Force refresh, bypass cache
- `/models --cached`: Show cached list without refresh
- Stale cache used as fallback (any age) when API is unreachable
- Cache is per-provider, independently managed

---

## New Providers

### OpenRouter — Meta-Provider

OpenRouter is a **meta-provider** that proxies requests to 200+ models from all major providers through a single API key. This is especially valuable for users who don't want to manage multiple API keys.

**Key features**:

- Single API key for all providers
- Automatic fallback between providers
- Usage-based pricing with no minimums
- OpenAI-compatible API format

**Base URL**: `https://openrouter.ai/api/v1`  
**Chat endpoint**: `POST /chat/completions` (OpenAI-compatible)  
**Models endpoint**: `GET /models`

**Special headers**:

```
Authorization: Bearer <OPENROUTER_API_KEY>
HTTP-Referer: https://fridaycode.dev
X-Title: FridayCode
```

---

### xAI / Grok

xAI provides the Grok family of models through an OpenAI-compatible API.

**Base URL**: `https://api.x.ai/v1`  
**Chat endpoint**: `POST /chat/completions` (OpenAI-compatible)  
**Models endpoint**: `GET /models`

**Authentication**: Bearer token with xAI API key.

---

### Auto-Detect OpenAI-Compatible Endpoints

Many providers and local inference servers expose OpenAI-compatible APIs. FridayCode should support a generic "OpenAI-compatible" provider:

```json
{
  "providers": {
    "my-local-server": {
      "type": "openai-compatible",
      "baseUrl": "http://localhost:8080/v1",
      "apiKey": "optional-key",
      "models": "auto"
    }
  }
}
```

**Discovery**: Try `GET <baseUrl>/models`. If it returns an OpenAI-format response, use those models. If it fails, require manual model specification in config.

---

## Provider Interface Overhaul

### ProviderAdapter Interface

Every provider implements a unified `ProviderAdapter` interface:

```typescript
interface ProviderAdapter {
  /** Unique provider identifier */
  readonly id: string;

  /** Human-readable provider name */
  readonly name: string;

  /** Base URL for API requests */
  readonly baseUrl: string;

  /** Whether this provider is currently available (API key configured, reachable) */
  isAvailable(): Promise<boolean>;

  /** Fetch available models from the provider API */
  listModels(options?: ListModelsOptions): Promise<ModelInfo[]>;

  /** Stream a chat completion response */
  generateStream(request: GenerateRequest): AsyncIterable<StreamChunk>;

  /** Generate a response with tool/function calling */
  generateWithTools(request: ToolRequest): AsyncIterable<StreamChunk>;

  /** Get capabilities for a specific model */
  getModelCapabilities(modelId: string): Promise<ModelCapabilities>;

  /** Validate that the API key and connection work */
  validateConnection(): Promise<ValidationResult>;
}
```

### ModelCapabilities

```typescript
interface ModelCapabilities {
  /** Maximum total tokens (input + output) */
  maxTokens: number;

  /** Maximum context window size (input tokens) */
  contextWindow: number;

  /** Maximum output tokens */
  maxOutputTokens: number;

  /** Whether the model supports tool/function calling */
  supportsTools: boolean;

  /** Whether the model supports vision/image inputs */
  supportsVision: boolean;

  /** Whether the model supports streaming responses */
  supportsStreaming: boolean;

  /** Whether the model supports structured output / JSON mode */
  supportsJsonMode: boolean;

  /** Whether the model supports system messages */
  supportsSystemMessage: boolean;

  /** Pricing per million tokens (null if unknown/free) */
  pricing: ModelPricing | null;

  /** Model family for grouping in UI */
  family: string;

  /** Release date if known */
  releasedAt: Date | null;

  /** Whether this model is deprecated */
  deprecated: boolean;

  /** Deprecation replacement model ID if deprecated */
  replacedBy: string | null;
}

interface ModelPricing {
  /** Cost per million input tokens in USD */
  inputPerMillion: number;

  /** Cost per million output tokens in USD */
  outputPerMillion: number;

  /** Cost per image input if applicable */
  imageInput?: number;
}
```

### ModelInfo

```typescript
interface ModelInfo {
  /** Model identifier used in API calls */
  id: string;

  /** Human-readable display name */
  name: string;

  /** Provider that serves this model */
  providerId: string;

  /** Model capabilities */
  capabilities: ModelCapabilities;

  /** Whether this model is recommended / featured */
  featured: boolean;

  /** Tags for filtering (e.g., "fast", "reasoning", "code", "vision") */
  tags: string[];
}
```

### Automatic Capability Detection

When a provider's API returns model metadata, we automatically map it to `ModelCapabilities`:

| Provider      | Context Window Source      | Tool Support Source             | Vision Source                            |
| ------------- | -------------------------- | ------------------------------- | ---------------------------------------- |
| OpenAI        | Known mapping table        | Model ID pattern (`gpt-4*`)     | Model ID pattern (`*-vision`, `gpt-4o*`) |
| Anthropic     | API metadata               | All Claude 3+ models            | All Claude 3+ models                     |
| Google Gemini | `inputTokenLimit` field    | `supportedGenerationMethods`    | Model ID pattern (`*-vision`)            |
| Mistral       | `max_context_length` field | `capabilities.function_calling` | `capabilities.vision`                    |
| OpenRouter    | `context_length` field     | `architecture.modality`         | `architecture.modality` contains `image` |
| Together      | `context_length` field     | Known mapping                   | Known mapping                            |
| Ollama        | Model metadata / defaults  | Depends on base model           | Depends on base model                    |

---

## Retry & Resilience

### Exponential Backoff with Jitter

All provider API calls use exponential backoff for retryable errors:

```typescript
interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number; // default: 3

  /** Initial delay in milliseconds */
  initialDelayMs: number; // default: 1000

  /** Maximum delay in milliseconds */
  maxDelayMs: number; // default: 30000

  /** Backoff multiplier */
  backoffMultiplier: number; // default: 2

  /** Jitter factor (0-1). 0 = no jitter, 1 = full jitter */
  jitterFactor: number; // default: 0.5

  /** HTTP status codes that trigger retry */
  retryableStatuses: number[]; // default: [429, 500, 502, 503, 504]
}
```

**Backoff formula**:

```
delay = min(initialDelayMs * (backoffMultiplier ^ attempt), maxDelayMs)
jitter = random(0, delay * jitterFactor)
finalDelay = delay + jitter
```

**Example retry sequence** (defaults):

```
Attempt 1: failed → wait ~1.0-1.5s
Attempt 2: failed → wait ~2.0-3.0s
Attempt 3: failed → wait ~4.0-6.0s
Attempt 4: give up → surface error to user
```

### Circuit Breaker Pattern

Prevents cascading failures by stopping requests to a failing provider:

```typescript
interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number; // default: 5

  /** Duration to keep circuit open (ms) */
  cooldownMs: number; // default: 60000 (1 minute)

  /** Number of test requests in half-open state */
  halfOpenRequests: number; // default: 1

  /** Time window for counting failures (ms) */
  failureWindowMs: number; // default: 120000 (2 minutes)
}
```

**State machine**:

```
                 failure count
                 >= threshold
  ┌────────┐  ──────────────▸  ┌────────┐
  │ CLOSED │                   │  OPEN  │
  │(normal)│  ◂──────────────  │(reject)│
  └────────┘    test request    └───┬────┘
       ▲         succeeds           │
       │                       cooldown
       │         ┌───────────┐  expires
       └─────────│ HALF-OPEN │◂─────┘
        all pass │ (testing) │
                 └───────────┘
```

- **CLOSED** (normal): Requests flow through. Failures are counted.
- **OPEN** (rejecting): All requests immediately fail with `ProviderUnavailableError`. No API calls made.
- **HALF-OPEN** (testing): One test request allowed through. If it succeeds, circuit closes. If it fails, circuit opens again.

### Provider Fallback Chain

Users can configure fallback providers:

```json
{
  "providers": {
    "anthropic": {
      "apiKey": "...",
      "fallback": "openai"
    },
    "openai": {
      "apiKey": "...",
      "fallback": "openrouter"
    }
  }
}
```

**Fallback behavior**:

1. Primary provider fails (after retries exhausted)
2. Check if fallback provider is configured
3. Map the model to an equivalent on the fallback provider (e.g., `claude-sonnet-4` → `gpt-4o`)
4. Retry the request on the fallback provider
5. Notify user: "⚠️ Anthropic unavailable. Using OpenAI (gpt-4o) as fallback."

**Model mapping table** (configurable):

```json
{
  "modelMappings": {
    "claude-sonnet-4": { "openai": "gpt-4o", "google": "gemini-2.0-flash" },
    "gpt-4o": { "anthropic": "claude-sonnet-4", "google": "gemini-2.0-flash" },
    "gemini-2.0-flash": { "openai": "gpt-4o", "anthropic": "claude-sonnet-4" }
  }
}
```

### Request Timeout Configuration

Each provider has configurable timeouts:

```typescript
interface TimeoutConfig {
  /** Connection timeout (ms) */
  connectTimeoutMs: number; // default: 10000

  /** Time to first byte / first token (ms) */
  firstTokenTimeoutMs: number; // default: 30000

  /** Total request timeout (ms) */
  totalTimeoutMs: number; // default: 300000 (5 min)

  /** Idle timeout between stream chunks (ms) */
  streamIdleTimeoutMs: number; // default: 60000
}
```

---

## Cost Tracking Overhaul

### Dynamic Pricing

Model pricing is sourced dynamically where possible:

| Source                      | Priority        | Availability         |
| --------------------------- | --------------- | -------------------- |
| Provider API metadata       | 1 (highest)     | Together, OpenRouter |
| FridayCode pricing database | 2               | All major models     |
| User config overrides       | 3 (always wins) | Per-user             |
| Zero / unknown              | 4 (fallback)    | Unlisted models      |

**Pricing update flow**:

```
1. On model list refresh, check for pricing in API response
2. Merge with built-in pricing database
3. Apply user overrides from config
4. Cache final pricing alongside model info
```

### Per-Provider Cost Overrides

Users can override pricing in their config:

```json
{
  "costOverrides": {
    "openai/gpt-4o": {
      "inputPerMillion": 2.5,
      "outputPerMillion": 10.0
    },
    "anthropic/claude-sonnet-4": {
      "inputPerMillion": 3.0,
      "outputPerMillion": 15.0
    }
  }
}
```

### Budget Enforcement — BEFORE Request

**Critical change**: Budget is checked BEFORE sending requests, not after.

```
┌──────────────────────────────────────────────────────────────┐
│                    Budget Check Flow                          │
│                                                              │
│  User sends message                                          │
│         │                                                    │
│         ▼                                                    │
│  Estimate cost of request:                                    │
│    - Count input tokens (prompt + context)                   │
│    - Estimate output tokens (model's avg or max)             │
│    - Calculate: estimated_cost = input_cost + output_cost    │
│         │                                                    │
│         ▼                                                    │
│  ┌─ Budget Check ─────────────────────────────────────┐      │
│  │  remaining_budget = limit - spent_today            │      │
│  │  estimated_cost <= remaining_budget ?              │      │
│  └────────┬───────────────────────────┬──────────────┘      │
│       Yes │                           │ No                   │
│           ▼                           ▼                      │
│     Send request               Show warning:                 │
│     Track actual cost          "Estimated cost: $X.XX        │
│                                 Budget remaining: $Y.YY      │
│                                 Proceed anyway? [y/N]"       │
│                                                              │
│  After response received:                                     │
│    - Calculate actual cost from real token counts             │
│    - Update running totals                                    │
│    - Show cost in StatusBar                                   │
└──────────────────────────────────────────────────────────────┘
```

### Cost Tracking Granularity

Track costs at multiple levels:

```typescript
interface CostTracking {
  /** Per-request cost record */
  request: {
    requestId: string;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    timestamp: Date;
  };

  /** Per-session aggregates */
  session: {
    sessionId: string;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
    requestCount: number;
    startedAt: Date;
  };

  /** Per-day aggregates */
  daily: {
    date: string; // YYYY-MM-DD
    totalCost: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
  };

  /** Per-month aggregates */
  monthly: {
    month: string; // YYYY-MM
    totalCost: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
    dailyBreakdown: Record<string, number>;
  };
}
```

### Budget Configuration

```json
{
  "budget": {
    "daily": 5.0,
    "monthly": 100.0,
    "perSession": null,
    "warningThreshold": 0.8,
    "hardLimit": true,
    "currency": "USD"
  }
}
```

| Setting            | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `daily`            | Maximum spend per calendar day (USD)                               |
| `monthly`          | Maximum spend per calendar month (USD)                             |
| `perSession`       | Maximum spend per session (null = unlimited)                       |
| `warningThreshold` | Show warning at this % of budget (0.8 = 80%)                       |
| `hardLimit`        | If `true`, block requests over budget. If `false`, warn but allow. |
| `currency`         | Display currency (costs always calculated in USD)                  |

### Cost Commands

| Command                | Description                             |
| ---------------------- | --------------------------------------- |
| `/cost`                | Show current session cost breakdown     |
| `/cost today`          | Show today's cost by provider and model |
| `/cost month`          | Show this month's cost summary          |
| `/cost history`        | Show cost history chart (last 30 days)  |
| `/budget`              | Show budget limits and remaining        |
| `/budget set <amount>` | Set daily budget                        |

---

## Configuration

FridayCode reads provider configuration from two locations:

1. **Global**: `~/.friday/config.json` (user-level defaults)
2. **Project**: `.friday/config.json` (project-level overrides)

Project config is merged on top of global config (project wins on conflicts).

### Full Configuration Schema

```json
{
  "$schema": "https://fridaycode.dev/schema/config.json",
  "version": 2,

  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4",

  "providers": {
    "openai": {
      "enabled": true,
      "apiKey": "${OPENAI_API_KEY}",
      "baseUrl": "https://api.openai.com/v1",
      "defaultModel": "gpt-4o",
      "fallback": "anthropic",
      "timeout": {
        "connectTimeoutMs": 10000,
        "firstTokenTimeoutMs": 30000,
        "totalTimeoutMs": 300000,
        "streamIdleTimeoutMs": 60000
      },
      "retry": {
        "maxRetries": 3,
        "initialDelayMs": 1000,
        "maxDelayMs": 30000,
        "backoffMultiplier": 2
      },
      "circuitBreaker": {
        "failureThreshold": 5,
        "cooldownMs": 60000
      },
      "modelCache": {
        "ttlMs": 3600000
      },
      "headers": {}
    },

    "anthropic": {
      "enabled": true,
      "apiKey": "${ANTHROPIC_API_KEY}",
      "baseUrl": "https://api.anthropic.com",
      "defaultModel": "claude-sonnet-4",
      "fallback": "openai"
    },

    "google": {
      "enabled": true,
      "apiKey": "${GOOGLE_API_KEY}",
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "defaultModel": "gemini-2.0-flash"
    },

    "mistral": {
      "enabled": false,
      "apiKey": "${MISTRAL_API_KEY}",
      "baseUrl": "https://api.mistral.ai/v1",
      "defaultModel": "mistral-large-latest"
    },

    "groq": {
      "enabled": true,
      "apiKey": "${GROQ_API_KEY}",
      "baseUrl": "https://api.groq.com/openai/v1",
      "defaultModel": "llama-3.1-70b-versatile"
    },

    "deepseek": {
      "enabled": false,
      "apiKey": "${DEEPSEEK_API_KEY}",
      "baseUrl": "https://api.deepseek.com/v1",
      "defaultModel": "deepseek-chat"
    },

    "together": {
      "enabled": false,
      "apiKey": "${TOGETHER_API_KEY}",
      "baseUrl": "https://api.together.xyz/v1",
      "defaultModel": "meta-llama/Llama-3-70b-chat-hf"
    },

    "fireworks": {
      "enabled": false,
      "apiKey": "${FIREWORKS_API_KEY}",
      "baseUrl": "https://api.fireworks.ai/inference/v1",
      "defaultModel": "accounts/fireworks/models/llama-v3p1-70b-instruct"
    },

    "cohere": {
      "enabled": false,
      "apiKey": "${COHERE_API_KEY}",
      "baseUrl": "https://api.cohere.com/v2",
      "defaultModel": "command-r-plus"
    },

    "ollama": {
      "enabled": true,
      "baseUrl": "http://localhost:11434",
      "defaultModel": "llama3:latest"
    },

    "openrouter": {
      "enabled": true,
      "apiKey": "${OPENROUTER_API_KEY}",
      "baseUrl": "https://openrouter.ai/api/v1",
      "defaultModel": "anthropic/claude-sonnet-4",
      "headers": {
        "HTTP-Referer": "https://fridaycode.dev",
        "X-Title": "FridayCode"
      }
    },

    "xai": {
      "enabled": false,
      "apiKey": "${XAI_API_KEY}",
      "baseUrl": "https://api.x.ai/v1",
      "defaultModel": "grok-2"
    },

    "custom-local": {
      "type": "openai-compatible",
      "enabled": false,
      "baseUrl": "http://localhost:8080/v1",
      "apiKey": "",
      "defaultModel": "auto"
    }
  },

  "modelMappings": {
    "claude-sonnet-4": {
      "openai": "gpt-4o",
      "google": "gemini-2.0-flash",
      "groq": "llama-3.1-70b-versatile"
    },
    "gpt-4o": {
      "anthropic": "claude-sonnet-4",
      "google": "gemini-2.0-flash"
    }
  },

  "budget": {
    "daily": 5.0,
    "monthly": 100.0,
    "perSession": null,
    "warningThreshold": 0.8,
    "hardLimit": true,
    "currency": "USD"
  },

  "costOverrides": {}
}
```

### Environment Variable Interpolation

API keys support environment variable interpolation with `${VAR_NAME}` syntax:

```json
{
  "apiKey": "${OPENAI_API_KEY}"
}
```

FridayCode resolves these at runtime from:

1. Process environment variables
2. `.env` file in project root
3. `~/.friday/.env` for global secrets

**Security**: API keys are never logged, never included in error reports, and masked in UI (`sk-...abc`).

---

## TypeScript Interfaces

Complete TypeScript type definitions for the provider system:

```typescript
// ─── Core Types ──────────────────────────────────────────────

/** Unique provider identifier */
type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'groq'
  | 'deepseek'
  | 'together'
  | 'fireworks'
  | 'cohere'
  | 'ollama'
  | 'openrouter'
  | 'xai'
  | `custom-${string}`;

/** Model identifier (provider-specific) */
type ModelId = string;

// ─── Provider Adapter ────────────────────────────────────────

interface ProviderAdapter {
  readonly id: ProviderId;
  readonly name: string;
  readonly baseUrl: string;

  isAvailable(): Promise<boolean>;
  listModels(options?: ListModelsOptions): Promise<ModelInfo[]>;
  generateStream(request: GenerateRequest): AsyncIterable<StreamChunk>;
  generateWithTools(request: ToolRequest): AsyncIterable<StreamChunk>;
  getModelCapabilities(modelId: ModelId): Promise<ModelCapabilities>;
  validateConnection(): Promise<ValidationResult>;
}

interface ListModelsOptions {
  /** Bypass cache and fetch fresh from API */
  forceRefresh?: boolean;

  /** Filter by capability */
  filter?: {
    supportsTools?: boolean;
    supportsVision?: boolean;
    supportsStreaming?: boolean;
    minContextWindow?: number;
    maxPricingPerMillion?: number;
  };

  /** Sort order */
  sortBy?: 'name' | 'contextWindow' | 'pricing' | 'releaseDate';
}

// ─── Model Information ───────────────────────────────────────

interface ModelInfo {
  id: ModelId;
  name: string;
  providerId: ProviderId;
  capabilities: ModelCapabilities;
  featured: boolean;
  tags: ModelTag[];
}

type ModelTag =
  | 'fast'
  | 'reasoning'
  | 'code'
  | 'vision'
  | 'multimodal'
  | 'cheap'
  | 'flagship'
  | 'experimental';

interface ModelCapabilities {
  maxTokens: number;
  contextWindow: number;
  maxOutputTokens: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsJsonMode: boolean;
  supportsSystemMessage: boolean;
  pricing: ModelPricing | null;
  family: string;
  releasedAt: Date | null;
  deprecated: boolean;
  replacedBy: ModelId | null;
}

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  imageInput?: number;
}

// ─── Request / Response ──────────────────────────────────────

interface GenerateRequest {
  model: ModelId;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  stream: boolean;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  toolCallId?: string;
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; imageUrl: { url: string; detail?: 'low' | 'high' | 'auto' } };

interface ToolRequest extends GenerateRequest {
  tools: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
}

interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

// ─── Streaming ───────────────────────────────────────────────

type StreamChunk =
  | { type: 'text'; text: string }
  | { type: 'tool_call_start'; toolCall: { id: string; name: string } }
  | { type: 'tool_call_delta'; toolCall: { id: string; arguments: string } }
  | { type: 'tool_call_end'; toolCall: { id: string } }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'done'; finishReason: FinishReason };

type FinishReason = 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'error';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

// ─── Validation ──────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  provider: ProviderId;
  errors: ValidationError[];
  latencyMs: number;
}

interface ValidationError {
  code: 'AUTH_FAILED' | 'NETWORK_ERROR' | 'INVALID_URL' | 'RATE_LIMITED' | 'UNKNOWN';
  message: string;
}

// ─── Retry & Resilience ─────────────────────────────────────

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryableStatuses: number[];
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownMs: number;
  halfOpenRequests: number;
  failureWindowMs: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureAt: Date | null;
  openedAt: Date | null;
  halfOpenAttempts: number;
}

// ─── Timeout ─────────────────────────────────────────────────

interface TimeoutConfig {
  connectTimeoutMs: number;
  firstTokenTimeoutMs: number;
  totalTimeoutMs: number;
  streamIdleTimeoutMs: number;
}

// ─── Cost Tracking ───────────────────────────────────────────

interface CostRecord {
  requestId: string;
  sessionId: string;
  model: ModelId;
  provider: ProviderId;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  timestamp: Date;
}

interface SessionCostSummary {
  sessionId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  requestCount: number;
  startedAt: Date;
  byModel: Record<ModelId, number>;
}

interface DailyCostSummary {
  date: string;
  totalCost: number;
  byProvider: Record<ProviderId, number>;
  byModel: Record<ModelId, number>;
}

interface MonthlyCostSummary {
  month: string;
  totalCost: number;
  byProvider: Record<ProviderId, number>;
  byModel: Record<ModelId, number>;
  dailyBreakdown: Record<string, number>;
}

interface BudgetConfig {
  daily: number | null;
  monthly: number | null;
  perSession: number | null;
  warningThreshold: number;
  hardLimit: boolean;
  currency: string;
}

// ─── Provider Configuration ──────────────────────────────────

interface ProviderConfig {
  enabled: boolean;
  type?: 'openai-compatible';
  apiKey?: string;
  baseUrl: string;
  defaultModel?: ModelId;
  fallback?: ProviderId;
  timeout?: Partial<TimeoutConfig>;
  retry?: Partial<RetryConfig>;
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  modelCache?: { ttlMs: number };
  headers?: Record<string, string>;
}

interface FridayConfig {
  $schema?: string;
  version: number;
  defaultProvider: ProviderId;
  defaultModel: ModelId;
  providers: Record<ProviderId, ProviderConfig>;
  modelMappings: Record<ModelId, Record<ProviderId, ModelId>>;
  budget: BudgetConfig;
  costOverrides: Record<string, Partial<ModelPricing>>;
}

// ─── Provider Registry ───────────────────────────────────────

interface ProviderRegistry {
  /** Register a provider adapter */
  register(provider: ProviderAdapter): void;

  /** Get a provider by ID */
  get(id: ProviderId): ProviderAdapter | undefined;

  /** Get all registered providers */
  getAll(): ProviderAdapter[];

  /** Get all enabled providers */
  getEnabled(): ProviderAdapter[];

  /** Get the default provider */
  getDefault(): ProviderAdapter;

  /** List all available models across all enabled providers */
  listAllModels(options?: ListModelsOptions): Promise<ModelInfo[]>;

  /** Find a model by ID across all providers */
  findModel(modelId: ModelId): Promise<{ provider: ProviderAdapter; model: ModelInfo } | undefined>;

  /** Get the fallback provider for a given provider */
  getFallback(providerId: ProviderId): ProviderAdapter | undefined;
}

// ─── Model Cache ─────────────────────────────────────────────

interface ModelCache {
  /** Get cached models for a provider */
  get(providerId: ProviderId): CachedModelList | undefined;

  /** Store models for a provider */
  set(providerId: ProviderId, models: ModelInfo[], ttlMs: number): void;

  /** Check if cache is fresh (within TTL) */
  isFresh(providerId: ProviderId): boolean;

  /** Force invalidate cache for a provider */
  invalidate(providerId: ProviderId): void;

  /** Invalidate all provider caches */
  invalidateAll(): void;

  /** Persist cache to disk */
  persist(): Promise<void>;

  /** Load cache from disk */
  load(): Promise<void>;
}

interface CachedModelList {
  provider: ProviderId;
  models: ModelInfo[];
  fetchedAt: Date;
  expiresAt: Date;
}
```

---

## Implementation Plan

| Phase  | Scope                                                    | Effort    |
| ------ | -------------------------------------------------------- | --------- |
| **P0** | ProviderAdapter interface, ModelCapabilities, ModelCache | 1 week    |
| **P1** | Dynamic model fetching for all 12 existing providers     | 2 weeks   |
| **P2** | OpenRouter + xAI + OpenAI-compatible generic provider    | 1 week    |
| **P3** | Retry, circuit breaker, fallback chain                   | 1 week    |
| **P4** | Cost tracking overhaul (pre-request budget, tracking)    | 1 week    |
| **P5** | Configuration schema, migration from v1 config           | 0.5 weeks |
| **P6** | `/models`, `/cost`, `/budget` commands                   | 0.5 weeks |

**Total estimated effort: ~7 weeks**
