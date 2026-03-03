import { Injectable, signal } from '@angular/core';

declare const GROQ_API_KEY_TURBO: string;
declare const GROQ_API_KEY_COMPLEX: string;

export type TranscriptionMode = 'turbo' | 'complex';

@Injectable({
  providedIn: 'root'
})
export class GroqService {
  private apiUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';

  mode = signal<TranscriptionMode>('turbo');

  private get modelName(): string {
    return this.mode() === 'turbo' ? 'whisper-large-v3-turbo' : 'whisper-large-v3';
  }

  private get apiKey(): string {
    return this.mode() === 'turbo' ? GROQ_API_KEY_TURBO : GROQ_API_KEY_COMPLEX;
  }

  setMode(mode: TranscriptionMode) {
    this.mode.set(mode);
  }

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    try {
      const currentModel = this.modelName;
      const currentKey = this.apiKey;
      console.log(`Using model: ${currentModel}`);

      const formData = new FormData();
      // Determine file extension from MIME type
      const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
      formData.append('file', audioBlob, `recording.${ext}`);
      formData.append('model', currentModel);
      formData.append('temperature', '0');
      formData.append('response_format', 'verbose_json');

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          `Groq API Error: ${response.status} - ${errorData?.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      return data.text || 'No transcript generated.';
    } catch (error) {
      console.error('Groq API Error:', error);
      throw error;
    }
  }
}