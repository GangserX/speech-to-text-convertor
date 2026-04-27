import { Injectable, signal } from '@angular/core';

/**
 * AudioProcessorService
 * 
 * Creates a Web Audio API processing pipeline to filter out background noise
 * before audio reaches the MediaRecorder. The pipeline consists of:
 * 
 * 1. High-pass filter (85Hz)  — removes low-frequency rumble (AC hum, traffic, wind)
 * 2. Low-pass filter (8kHz)   — removes high-frequency hiss (electronics, fans)
 * 3. Dynamics Compressor      — normalizes volume spikes for consistent speech levels
 * 4. Noise Gate               — silences audio below ambient noise threshold
 */
@Injectable({
  providedIn: 'root'
})
export class AudioProcessorService {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;

  private noiseFloor = 0;
  private noiseGateInterval: any = null;

  /** Whether the processor is currently calibrating the noise floor */
  isCalibrating = signal(false);

  /** Current noise floor level (0-255) for debug/UI purposes */
  noiseFloorLevel = signal(0);

  /**
   * Process a raw MediaStream through the noise filtering pipeline.
   * Returns a cleaned MediaStream suitable for MediaRecorder.
   * 
   * @param rawStream - The raw microphone MediaStream from getUserMedia
   * @returns Object containing the cleaned stream and a cleanup function
   */
  async processStream(rawStream: MediaStream): Promise<{
    cleanStream: MediaStream;
    cleanup: () => void;
  }> {
    // Create AudioContext (use standard sample rate — browser handles resampling)
    this.audioContext = new AudioContext();

    // --- Source Node ---
    this.sourceNode = this.audioContext.createMediaStreamSource(rawStream);

    // --- High-Pass Filter (85Hz) ---
    // Removes low-frequency rumble: AC hum (50/60Hz), traffic, wind noise
    this.highPassFilter = this.audioContext.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 85;
    this.highPassFilter.Q.value = 0.7; // Gentle roll-off (Butterworth response)

    // --- Low-Pass Filter (8kHz) ---
    // Removes high-frequency hiss: electronics, fan whine, sibilance artifacts
    // Human speech fundamentals are < 4kHz, harmonics extend to ~8kHz
    this.lowPassFilter = this.audioContext.createBiquadFilter();
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.value = 8000;
    this.lowPassFilter.Q.value = 0.7;

    // --- Dynamics Compressor ---
    // Normalizes volume: boosts quiet speech, tames loud bursts
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -35;  // Start compressing at -35dB
    this.compressor.knee.value = 10;        // Soft knee for natural sound
    this.compressor.ratio.value = 4;        // 4:1 compression ratio
    this.compressor.attack.value = 0.005;   // Fast attack (5ms) to catch transients
    this.compressor.release.value = 0.1;    // 100ms release for smooth recovery

    // --- Analyser Node (for noise gate metering) ---
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // --- Gain Node (acts as the noise gate) ---
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1.0;

    // --- Destination Node (produces a new MediaStream) ---
    this.destinationNode = this.audioContext.createMediaStreamDestination();

    // --- Connect the pipeline ---
    // Microphone → HighPass → LowPass → Compressor → Analyser → Gain (Gate) → Destination
    this.sourceNode.connect(this.highPassFilter);
    this.highPassFilter.connect(this.lowPassFilter);
    this.lowPassFilter.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.destinationNode);

    // --- Calibrate noise floor ---
    await this.calibrateNoiseFloor();

    // --- Start noise gate loop ---
    this.startNoiseGate();

    const cleanStream = this.destinationNode.stream;
    const cleanup = () => this.dispose();

    return { cleanStream, cleanup };
  }

  /**
   * Calibrate the noise gate by measuring ambient noise for ~600ms.
   * The measured noise floor becomes the threshold below which audio is silenced.
   */
  private calibrateNoiseFloor(): Promise<void> {
    return new Promise((resolve) => {
      this.isCalibrating.set(true);

      if (!this.analyser) {
        this.isCalibrating.set(false);
        resolve();
        return;
      }

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const samples: number[] = [];
      let sampleCount = 0;
      const totalSamples = 12; // ~600ms at 50ms intervals

      const measureInterval = setInterval(() => {
        this.analyser!.getByteFrequencyData(dataArray);

        // Calculate RMS (root mean square) of the frequency data
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        samples.push(avg);
        sampleCount++;

        if (sampleCount >= totalSamples) {
          clearInterval(measureInterval);

          // Use the average of samples as noise floor, with a margin
          const avgNoise = samples.reduce((a, b) => a + b, 0) / samples.length;
          // Set threshold 40% above measured noise floor to create a clear gate
          this.noiseFloor = avgNoise * 1.4;
          this.noiseFloorLevel.set(Math.round(this.noiseFloor));

          console.log(`[AudioProcessor] Noise floor calibrated: ${this.noiseFloor.toFixed(1)} (raw avg: ${avgNoise.toFixed(1)})`);

          this.isCalibrating.set(false);
          resolve();
        }
      }, 50);
    });
  }

  /**
   * Runs the noise gate: continuously monitors audio level and mutes
   * the gain node when the level drops below the calibrated noise floor.
   */
  private startNoiseGate(): void {
    if (!this.analyser || !this.gainNode || !this.audioContext) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Check audio level every 30ms
    this.noiseGateInterval = setInterval(() => {
      if (!this.analyser || !this.gainNode || !this.audioContext) return;

      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const currentLevel = sum / bufferLength;

      const now = this.audioContext.currentTime;

      if (currentLevel > this.noiseFloor) {
        // Voice detected — open the gate smoothly
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setTargetAtTime(1.0, now, 0.01); // Fast open (10ms)
      } else {
        // Below noise floor — close the gate smoothly
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setTargetAtTime(0.0, now, 0.05); // Slower close (50ms) to avoid cutting words
      }
    }, 30);
  }

  /**
   * Tear down all audio nodes and stop the noise gate.
   */
  dispose(): void {
    if (this.noiseGateInterval) {
      clearInterval(this.noiseGateInterval);
      this.noiseGateInterval = null;
    }

    // Disconnect all nodes
    try { this.sourceNode?.disconnect(); } catch (_) {}
    try { this.highPassFilter?.disconnect(); } catch (_) {}
    try { this.lowPassFilter?.disconnect(); } catch (_) {}
    try { this.compressor?.disconnect(); } catch (_) {}
    try { this.analyser?.disconnect(); } catch (_) {}
    try { this.gainNode?.disconnect(); } catch (_) {}

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }

    this.sourceNode = null;
    this.highPassFilter = null;
    this.lowPassFilter = null;
    this.compressor = null;
    this.analyser = null;
    this.gainNode = null;
    this.destinationNode = null;
    this.audioContext = null;
    this.noiseFloor = 0;
    this.noiseFloorLevel.set(0);

    console.log('[AudioProcessor] Disposed.');
  }
}
