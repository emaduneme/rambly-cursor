import { LLMAdapter } from '../../types/adapters';
import { OpenAILLMAdapter } from './OpenAILLMAdapter';
import { env } from '../../config/env';

export class LLMAdapterFactory {
  static create(provider?: string): LLMAdapter {
    const selectedProvider = provider || env.LLM_PROVIDER;

    switch (selectedProvider) {
      case 'openai':
        if (!env.OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY is required for OpenAI LLM');
        }
        return new OpenAILLMAdapter(env.OPENAI_API_KEY);

      // Future providers can be added here
      // case 'anthropic':
      //   return new AnthropicLLMAdapter(env.ANTHROPIC_API_KEY);
      // case 'cohere':
      //   return new CohereLLMAdapter(env.COHERE_API_KEY);

      default:
        throw new Error(`Unsupported LLM provider: ${selectedProvider}`);
    }
  }
}
