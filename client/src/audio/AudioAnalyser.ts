/**
 * AudioAnalyser
 *
 * Reads live audio samples from the Web Audio AnalyserNode and
 * computes smoothed RMS and frequency band spectrum values to drive VRM mouth expressions.
 */

import { audioPlayer } from "./AudioPlayer";

export interface AudioSpectrum {
  rms: number;
  low: number;  // 150 - 750 Hz (formant F1, open vowels like "aa")
  mid: number;  // 750 - 2400 Hz (formant F2, front vowels like "ee"/"ih")
  high: number; // 2400 - 6000 Hz (sibilants & high consonants)
}

export class AudioAnalyser {
  private readonly _node: AnalyserNode;
  private readonly _timeBuffer: Float32Array<ArrayBuffer>;
  private readonly _freqBuffer: Uint8Array<ArrayBuffer>;
  private _smoothedRms = 0;

  constructor(node: AnalyserNode) {
    this._node = node;
    this._timeBuffer = new Float32Array(node.fftSize) as Float32Array<ArrayBuffer>;
    this._freqBuffer = new Uint8Array(node.frequencyBinCount) as Uint8Array<ArrayBuffer>;
  }

  /**
   * Sample the analyser, compute RMS, and apply exponential smoothing.
   * Call once per animation frame.
   */
  update(damping = 0.35): number {
    this._node.getFloatTimeDomainData(this._timeBuffer);

    let sumSq = 0;
    const n = this._timeBuffer.length;

    for (let i = 0; i < n; i++) {
      sumSq += this._timeBuffer[i] * this._timeBuffer[i];
    }

    const rms = Math.sqrt(sumSq / n);
    this._smoothedRms += (rms - this._smoothedRms) * damping;

    return this._smoothedRms;
  }

  /**
   * Samples live time-domain and frequency spectrum energy.
   */
  getSpectrum(damping = 0.35): AudioSpectrum {
    const rms = this.update(damping);

    this._node.getByteFrequencyData(this._freqBuffer);
    const sampleRate = this._node.context.sampleRate || 44100;
    const binHz = sampleRate / this._node.fftSize;

    let lowSum = 0, lowCount = 0;
    let midSum = 0, midCount = 0;
    let highSum = 0, highCount = 0;

    const len = this._freqBuffer.length;
    for (let i = 0; i < len; i++) {
      const hz = i * binHz;
      const val = this._freqBuffer[i] / 255.0;

      if (hz >= 150 && hz <= 750) {
        lowSum += val;
        lowCount++;
      } else if (hz > 750 && hz <= 2400) {
        midSum += val;
        midCount++;
      } else if (hz > 2400 && hz <= 6000) {
        highSum += val;
        highCount++;
      }
    }

    return {
      rms,
      low: lowCount > 0 ? lowSum / lowCount : 0,
      mid: midCount > 0 ? midSum / midCount : 0,
      high: highCount > 0 ? highSum / highCount : 0,
    };
  }

  /** The last smoothed RMS value (0.0 – ~0.3 for speech). */
  get smoothed(): number {
    return this._smoothedRms;
  }

  /** Reset to silence (call on speech interrupt). */
  reset() {
    this._smoothedRms = 0;
  }
}

// Singleton — shares the AnalyserNode from the global AudioPlayer.
export const audioAnalyser = new AudioAnalyser(audioPlayer.analyser);

