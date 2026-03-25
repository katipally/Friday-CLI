export * from './types.js';
export * from './registry.js';

// Import adapters to trigger self-registration
import './adapters/openai.js';
import './adapters/anthropic.js';
import './adapters/ollama.js';
