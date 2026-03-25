export * from './types.js';
export * from './registry.js';

// Import adapters to trigger self-registration
import './adapters/openai.js';
import './adapters/anthropic.js';
import './adapters/ollama.js';
import './adapters/google-gemini.js';
import './adapters/mistral.js';
import './adapters/groq.js';
import './adapters/deepseek.js';
import './adapters/openai-compatible.js';
import './adapters/aws-bedrock.js';
import './adapters/azure-openai.js';
import './adapters/cohere.js';
import './adapters/together.js';
