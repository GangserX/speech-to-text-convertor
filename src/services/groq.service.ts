import { Injectable } from '@angular/core';

declare const GROQ_API_KEY_COMPLEX: string;

@Injectable({
  providedIn: 'root'
})
export class GroqService {
  private apiUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
  private modelName = 'whisper-large-v3';
  private apiKey = GROQ_API_KEY_COMPLEX;

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    try {
      console.log(`Using model: ${this.modelName}`);

      const formData = new FormData();
      // Determine file extension from MIME type
      const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
      formData.append('file', audioBlob, `recording.${ext}`);
      formData.append('model', this.modelName);
      formData.append('temperature', '0');
      formData.append('response_format', 'verbose_json');

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
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