# Model Provider Architecture

## Overview
FridayCode must support multiple model providers with live model fetching. This document covers the API patterns and abstraction needed.

---

## Provider APIs

### 1. Ollama (Local Models)

**Base URL**: `http://localhost:11434`

**List Models**:
```
GET /api/tags
Response: { "models": [{ "name": "llama3.2:latest", "size": 2048, ... }] }
```

**Chat Completion**:
```
POST /api/chat
{
  "model": "llama3.2",
  "messages": [{"role": "user", "content": "..."}],
  "stream": true
}
```

**Key Features**:
- Local, free, no API key
- Model pulling: `POST /api/pull {"name": "llama3.2"}`
- Show model info: `POST /api/show {"name": "llama3.2"}`
- Also supports OpenAI-compatible endpoint at `/v1/`

### 2. Anthropic (Claude Models)

**Base URL**: `https://api.anthropic.com`

**List Models**: Not a standard endpoint; hardcode known models or use beta
**Chat Completion**:
```
POST /v1/messages
Headers: x-api-key, anthropic-version
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 8192,
  "messages": [{"role": "user", "content": "..."}],
  "stream": true
}
```

**Key Features**:
- Extended thinking (thinking blocks)
- Tool use (function calling)
- Image/document input
- System prompts
- Streaming with server-sent events

### 3. OpenAI (GPT/o-series)

**Base URL**: `https://api.openai.com`

**List Models**:
```
GET /v1/models
Response: { "data": [{ "id": "gpt-4o", ... }] }
```

**Chat Completion**:
```
POST /v1/chat/completions
Headers: Authorization: Bearer sk-...
{
  "model": "gpt-4o",
  "messages": [{"role": "user", "content": "..."}],
  "stream": true,
  "tools": [...]
}
```

**Key Features**:
- Function calling / tool use
- JSON mode / structured outputs
- Streaming
- Image input (vision models)

### 4. OpenAI-Compatible (LM Studio, vLLM, Together, Groq, etc.)

**Pattern**: Same as OpenAI but different base URL

**Examples**:
- LM Studio: `http://localhost:1234/v1/`
- vLLM: `http://localhost:8000/v1/`
- Together AI: `https://api.together.xyz/v1/`
- Groq: `https://api.groq.com/openai/v1/`
- Fireworks: `https://api.fireworks.ai/inference/v1/`
- DeepSeek: `https://api.deepseek.com/v1/`

---

## Provider Abstraction Layer

### Unified Interface (Pseudocode)
```
interface ModelProvider {
  name: string
  listModels(): Model[]
  chat(messages, options): Stream<Message>
  supportsToolUse(): boolean
  supportsVision(): boolean
  supportsStreaming(): boolean
  supportsExtendedThinking(): boolean
}

interface Model {
  id: string
  name: string
  provider: string
  contextWindow: number
  supportsToolUse: boolean
  supportsVision: boolean
  maxOutputTokens: number
}

interface ChatOptions {
  model: string
  messages: Message[]
  tools?: Tool[]
  stream: boolean
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}
```

### Live Model Fetching Strategy
1. On provider configuration, immediately fetch available models
2. Cache model list with configurable TTL (e.g., 5 minutes)
3. Show spinner while fetching
4. Gracefully handle offline providers (show cached or error)
5. Allow manual refresh via /model command

### Provider Configuration
```json
{
  "providers": {
    "ollama": {
      "enabled": true,
      "baseUrl": "http://localhost:11434",
      "default": true
    },
    "anthropic": {
      "enabled": true,
      "apiKey": "${ANTHROPIC_API_KEY}",
      "baseUrl": "https://api.anthropic.com"
    },
    "openai": {
      "enabled": true,
      "apiKey": "${OPENAI_API_KEY}",
      "baseUrl": "https://api.openai.com"
    },
    "custom": {
      "enabled": true,
      "apiKey": "${CUSTOM_API_KEY}",
      "baseUrl": "http://my-server:8000/v1",
      "type": "openai-compatible"
    }
  }
}
```

---

## Tool Use Mapping

Different providers have different tool use formats:

| Feature | Anthropic | OpenAI | Ollama |
|---------|-----------|--------|--------|
| Tool format | `tools[]` with `input_schema` | `tools[]` with `function.parameters` | Supports OpenAI format |
| Tool call | `tool_use` content block | `tool_calls` in message | Same as OpenAI |
| Tool result | `tool_result` content block | `tool` role message | Same as OpenAI |
| Streaming tools | Streamed blocks | Streamed deltas | Varies by model |

### Translation Layer
- Normalize tool definitions to internal format
- Translate to provider-specific format on API call
- Translate responses back to internal format
- Handle provider-specific features (e.g., Anthropic thinking blocks)

---

## Cost Tracking

| Provider | Pricing Model | Tracking |
|----------|--------------|----------|
| Ollama | Free (local compute) | Track tokens only |
| Anthropic | Per input/output token | Track cost in USD |
| OpenAI | Per input/output token | Track cost in USD |
| Custom | Varies | Configurable rates or token-only |

### Implementation
- Track total tokens (input + output) per session
- Calculate cost based on provider pricing
- Display via /cost command
- Budget limits via max_budget setting
