import OpenAI from 'openai';
import { LLMAdapter, GenerationOptions, PolishedNoteResult } from '../../types/adapters';
import { logger } from '../../utils/logger';
import { ServiceUnavailableError } from '../../utils/errors';

export class OpenAILLMAdapter implements LLMAdapter {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o-mini') {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for LLM generation');
    }
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generatePolishedNote(
    transcript: string,
    options?: GenerationOptions
  ): Promise<PolishedNoteResult> {
    try {
      const formattingType = options?.formattingType || 'paragraphs';
      const tone = options?.tone || 'professional';
      const maxLength = options?.maxLength || 1000;

      logger.info('Starting OpenAI note generation', {
        transcriptLength: transcript.length,
        formattingType,
        tone,
      });

      const systemPrompt = this.buildSystemPrompt(formattingType, tone, maxLength);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Here is the transcript to polish:\n\n${transcript}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content?.trim() || '';

      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      logger.info('OpenAI note generation successful', {
        contentLength: content.length,
        tokensUsed: response.usage?.total_tokens,
        model: response.model,
      });

      return {
        content,
        formattingType,
        metadata: {
          provider: 'openai',
          model: response.model,
          tokensUsed: response.usage?.total_tokens,
          finishReason: response.choices[0]?.finish_reason,
        },
      };
    } catch (error: any) {
      logger.error('OpenAI note generation failed', {
        error: error.message,
        status: error.response?.status,
      });

      if (error.response?.status === 429) {
        throw new ServiceUnavailableError('LLM service rate limit exceeded');
      }

      throw new ServiceUnavailableError(
        `Note generation failed: ${error.message || 'Unknown error'}`
      );
    }
  }

  private buildSystemPrompt(
    formattingType: 'paragraphs' | 'bullets',
    tone: string,
    maxLength: number
  ): string {
    const basePrompt = `You are an expert editor helping to polish voice transcripts into clean, readable notes.

Your task:
1. Fix grammar, spelling, and punctuation errors
2. Remove filler words (um, uh, like, you know, etc.)
3. Organize thoughts into a clear, logical structure
4. Maintain the original meaning and key points
5. Keep the tone ${tone}
6. Target length: approximately ${maxLength} words

`;

    if (formattingType === 'bullets') {
      return (
        basePrompt +
        `Format the output as:
- Use bullet points for main ideas
- Use sub-bullets for supporting details
- Keep bullets concise (1-2 sentences max)
- Start each bullet with a strong action word or key concept

Do not include a title or heading. Just return the polished bullet points.`
      );
    } else {
      return (
        basePrompt +
        `Format the output as:
- 3-5 well-structured paragraphs
- Each paragraph should focus on one main idea
- Use clear topic sentences
- Ensure smooth transitions between paragraphs
- Keep paragraphs concise (3-5 sentences each)

Do not include a title or heading. Just return the polished paragraphs.`
      );
    }
  }

  getProviderName(): string {
    return 'openai';
  }
}
