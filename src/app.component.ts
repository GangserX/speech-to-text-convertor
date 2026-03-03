import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioRecorderService } from './services/audio-recorder.service';
import { GroqService } from './services/groq.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      
      <header class="mb-8 text-center">
        <h1 class="text-3xl font-bold text-slate-800 mb-2">Voice Scribe</h1>
        <p class="text-slate-500">Record your voice and get an instant transcription.</p>
        
        <!-- Mode Switch -->
        <div class="mt-4 inline-flex rounded-lg bg-slate-200 p-1">
          <button 
            (click)="groqService.setMode('turbo')"
            [class]="groqService.mode() === 'turbo' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
            class="px-4 py-2 text-sm font-semibold rounded-md transition-all duration-200"
            [disabled]="audioRecorder.isRecording() || isProcessing()"
          >
            ⚡ Turbo
          </button>
          <button 
            (click)="groqService.setMode('complex')"
            [class]="groqService.mode() === 'complex' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
            class="px-4 py-2 text-sm font-semibold rounded-md transition-all duration-200"
            [disabled]="audioRecorder.isRecording() || isProcessing()"
          >
            🧠 Complex
          </button>
        </div>
        <p class="mt-2 text-xs text-slate-400">
          @if (groqService.mode() === 'turbo') {
            Fast transcription — best for short clips
          } @else {
            Accurate transcription — best for longer speech
          }
        </p>
      </header>
    
      <main class="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        
        <!-- Recorder Section -->
        <div class="p-8 flex flex-col items-center justify-center border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/50">
          
          <!-- Status Area -->
          <div class="mb-8 h-8 flex items-center justify-center">
            @if (isProcessing()) {
              <span class="text-indigo-600 font-medium animate-pulse flex items-center gap-2">
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Transcribing audio...
              </span>
            } @else if (audioRecorder.isRecording()) {
              <span class="text-red-500 font-medium animate-pulse">Recording in progress...</span>
            } @else {
              <span class="text-slate-400">Ready to record</span>
            }
          </div>
    
          <!-- Record Button Container -->
          <div class="relative">
            <!-- Pulse effect behind button when recording -->
            @if (audioRecorder.isRecording()) {
              <div class="absolute inset-0 rounded-full bg-red-500 opacity-20 recording-pulse"></div>
            }
    
            <!-- Main Button -->
            <button 
              (click)="toggleRecording()"
              [disabled]="isProcessing()"
              [class]="audioRecorder.isRecording() ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'"
              class="relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
              [class.focus:ring-red-500]="audioRecorder.isRecording()"
              [class.focus:ring-indigo-500]="!audioRecorder.isRecording()"
            >
              @if (audioRecorder.isRecording()) {
                <!-- Stop Icon -->
                <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              } @else {
                <!-- Mic Icon -->
                <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              }
            </button>
          </div>
    
          <!-- Timer -->
          <div class="mt-6 font-mono text-2xl text-slate-700 font-medium tracking-wider">
            {{ formattedTime() }}
          </div>
    
          <p class="mt-2 text-sm text-slate-400">
            @if (audioRecorder.isRecording()) {
              Tap to stop and transcribe
            } @else {
              Tap microphone to start
            }
          </p>
        </div>
    
        <!-- Transcript Section -->
        <div class="bg-slate-50 p-6 min-h-[200px] border-t border-slate-100 flex flex-col">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wide">Transcript</h2>
            @if (transcript()) {
              <button (click)="copyToClipboard()" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors">
                @if (copied()) {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  Copied!
                } @else {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Text
                }
              </button>
            }
          </div>
    
          <div class="flex-grow bg-white rounded-lg border border-slate-200 p-4 shadow-sm relative max-h-96 overflow-y-auto">
            @if (error()) {
              <div class="text-red-500 flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                <p>{{ error() }}</p>
              </div>
            } @else if (transcript()) {
              <p class="text-slate-800 whitespace-pre-wrap leading-relaxed">{{ transcript() }}</p>
            } @else {
              <div class="h-full flex items-center justify-center text-slate-400 text-sm italic">
                @if (isProcessing()) {
                  Processing audio...
                } @else {
                  Transcribed text will appear here...
                }
              </div>
            }
          </div>
        </div>
      </main>
    </div>
  `,
  styleUrls: [] // Using inline Tailwind in template
})
export class AppComponent {
  audioRecorder = inject(AudioRecorderService);
  groqService = inject(GroqService);

  transcript = signal<string>('');
  isProcessing = signal(false);
  error = signal<string | null>(null);
  copied = signal(false);

  // Computed signal for formatting timer display (MM:SS)
  formattedTime = computed(() => {
    const totalSeconds = this.audioRecorder.recordingTime();
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });

  async toggleRecording() {
    this.error.set(null);
    this.copied.set(false);

    if (this.audioRecorder.isRecording()) {
      await this.stopAndTranscribe();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording() {
    try {
      this.transcript.set(''); // Clear previous transcript
      await this.audioRecorder.startRecording();
    } catch (err) {
      this.error.set('Could not access microphone. Please ensure permissions are granted.');
      console.error(err);
    }
  }

  private async stopAndTranscribe() {
    try {
      this.isProcessing.set(true);
      const audioData = await this.audioRecorder.stopRecording();
      
      const result = await this.groqService.transcribeAudio(audioData.blob);
      
      this.transcript.set(result);
    } catch (err) {
      this.error.set('Failed to transcribe audio. Please try again.');
      console.error(err);
    } finally {
      this.isProcessing.set(false);
    }
  }

  copyToClipboard() {
    const text = this.transcript();
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      });
    }
  }
}