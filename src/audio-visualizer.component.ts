import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';

@Component({
  selector: 'app-audio-visualizer',
  standalone: true,
  template: `
    <div class="flex items-end justify-center h-20 w-64 gap-px" aria-hidden="true">
      @if (processedBars()) {
        @for (barHeight of processedBars(); track $index) {
          <div 
            class="bg-indigo-300 w-2 rounded-t-full" 
            [style.height.%]="barHeight"
            style="transition: height 75ms linear;">
          </div>
        }
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioVisualizerComponent {
  data = input<Uint8Array | null>();
  
  processedBars = computed(() => {
    const data = this.data();
    if (!data) return [];
    
    const numBars = 40;
    const bars: number[] = [];
    const step = Math.floor(data.length / numBars);

    for (let i = 0; i < numBars; i++) {
      const sliceStart = i * step;
      const slice = data.subarray(sliceStart, sliceStart + step);
      
      let sum = 0;
      for (let j = 0; j < slice.length; j++) {
        sum += slice[j];
      }
      const avg = slice.length ? sum / slice.length : 0;
      
      // Scale for visual representation (0-100%) and add a floor
      const height = (avg / 255) * 100;
      bars.push(Math.max(2, height)); // min height of 2%
    }
    return bars;
  });
}
