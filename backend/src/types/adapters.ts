// Type definitions for provider adapters

export interface TranscriptionSegment {
  text: string;
  start: number; // seconds
  end: number; // seconds
  confidence?: number;
}

export interface TranscriptionResult {
  rawText: string;
  segments?: TranscriptionSegment[];
  confidence?: number;
  language?: string;
  duration?: number;
}

export interface TranscriptionOptions {
  language?: string;
  format?: 'mp3' | 'wav' | 'webm' | 'm4a';
  prompt?: string; // Context hint for better accuracy
}

export interface TranscriptionAdapter {
  transcribe(
    audioBuffer: Buffer,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult>;

  getProviderName(): string;
}

export interface PolishedNoteResult {
  content: string;
  formattingType: 'paragraphs' | 'bullets';
  metadata: {
    provider: string;
    model: string;
    tokensUsed?: number;
    finishReason?: string;
  };
}

export interface GenerationOptions {
  formattingType?: 'paragraphs' | 'bullets';
  maxLength?: number;
  tone?: 'professional' | 'casual' | 'concise';
}

export interface LLMAdapter {
  generatePolishedNote(
    transcript: string,
    options?: GenerationOptions
  ): Promise<PolishedNoteResult>;

  getProviderName(): string;
}
