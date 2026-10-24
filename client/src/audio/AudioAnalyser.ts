export class AudioAnalyser {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;

  private ensureContext(): { ctx: AudioContext; analyser: AnalyserNode } {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }
    if (!this.analyser) {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }
    return { ctx: this.audioContext, analyser: this.analyser };
  }

  public getContext(): AudioContext {
    return this.ensureContext().ctx;
  }

  public getAnalyserNode(): AnalyserNode {
    return this.ensureContext().analyser;
  }

  /**
   * Computes the Root Mean Square (RMS) energy from frequency data (0.0 to 1.0)
   * for zero-latency audio-reactive mouth movement.
   */
  public getRMS(): number {
    if (!this.analyser || !this.dataArray) {
      return 0.0;
    }
    this.analyser.getByteFrequencyData(this.dataArray as any);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    return Math.sqrt(sum / this.dataArray.length) / 255.0;
  }
}

export const audioAnalyser = new AudioAnalyser();
