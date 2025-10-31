import { TranscriptionAdapter } from '../../types/adapters';
import { OpenAITranscriptionAdapter } from './OpenAITranscriptionAdapter';
import { env } from '../../config/env';

export class TranscriptionAdapterFactory {
  static create(provider?: string): TranscriptionAdapter {
    const selectedProvider = provider || env.TRANSCRIPTION_PROVIDER;

    switch (selectedProvider) {
      case 'openai':
        if (!env.OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY is required for OpenAI transcription');
        }
        return new OpenAITranscriptionAdapter(env.OPENAI_API_KEY);

      // Future providers can be added here
      // case 'assemblyai':
      //   return new AssemblyAITranscriptionAdapter(env.ASSEMBLYAI_API_KEY);
      // case 'whisper':
      //   return new LocalWhisperAdapter();

      default:
        throw new Error(`Unsupported transcription provider: ${selectedProvider}`);
    }
  }
}
