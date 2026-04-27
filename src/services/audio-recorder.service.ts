import { inject, Injectable, signal } from '@angular/core';
import { AudioProcessorService } from './audio-processor.service';

export interface RecordedAudio {
  blob: Blob;
  base64: string;
  mimeType: string;
}

@Injectable({
  providedIn: 'root'
})
export class AudioRecorderService {
  private audioProcessor = inject(AudioProcessorService);

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private rawStream: MediaStream | null = null;
  private processorCleanup: (() => void) | null = null;
  
  isRecording = signal(false);
  recordingTime = signal(0);
  private timerInterval: any = null;

  /** Expose the calibration state from AudioProcessorService */
  isCalibrating = this.audioProcessor.isCalibrating;

  async startRecording(): Promise<void> {
    try {
      // --- Layer 1: Browser-native noise suppression constraints ---
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,       // Remove echo/feedback loops
          noiseSuppression: true,       // Browser-level noise suppression
          autoGainControl: true,        // Normalize microphone volume
          channelCount: 1,              // Mono audio (optimal for speech)
        }
      });

      this.rawStream = stream;

      // --- Layer 2: Web Audio API processing pipeline ---
      // Pipes audio through: HighPass → LowPass → Compressor → NoiseGate
      const { cleanStream, cleanup } = await this.audioProcessor.processStream(stream);
      this.processorCleanup = cleanup;

      // Prefer standard MIME types that Groq/Whisper supports
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      // Record the CLEANED stream (not the raw microphone stream)
      this.mediaRecorder = new MediaRecorder(cleanStream, { mimeType });
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.startTimer();

    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stopRecording(): Promise<RecordedAudio> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Recorder not initialized'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        this.stopTimer();
        const blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        
        // Stop all tracks on the RAW stream to release microphone
        this.rawStream?.getTracks().forEach(track => track.stop());
        this.rawStream = null;

        // Tear down the audio processing pipeline
        if (this.processorCleanup) {
          this.processorCleanup();
          this.processorCleanup = null;
        }

        this.mediaRecorder = null;
        this.isRecording.set(false);

        try {
          const base64 = await this.blobToBase64(blob);
          resolve({
            blob,
            base64,
            mimeType: blob.type
          });
        } catch (err) {
          reject(err);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  private startTimer() {
    this.recordingTime.set(0);
    this.timerInterval = setInterval(() => {
      this.recordingTime.update(t => t + 1);
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:audio/webm;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}