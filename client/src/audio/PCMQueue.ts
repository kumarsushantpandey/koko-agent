/**
 * PCMQueue
 *
 * Receives raw WebSocket Int16 LE binary PCM chunks from network,
 * converts them to Float32, and posts them to PCMPlayer & AudioWorklet.
 */

import type { PCMPlayer } from "./PCMPlayer";


export class PCMQueue {
  private readonly player: PCMPlayer;
  private queue: ArrayBuffer[] = [];
  private isProcessing = false;

  constructor(player: PCMPlayer) {
    this.player = player;
  }

  push(chunk: ArrayBuffer): void {
    this.queue.push(chunk);
    this.process();
  }

  flush(): void {
    this.queue = [];
    this.isProcessing = false;
    this.player.clear();
  }

  private process(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const chunk = this.queue.shift();
      if (!chunk || chunk.byteLength < 2) continue;

      // Convert Int16 LE -> Float32
      const int16View = new Int16Array(chunk);
      const float32Samples = new Float32Array(int16View.length);

      for (let i = 0; i < int16View.length; i++) {
        float32Samples[i] = int16View[i] / 32768.0;
      }

      this.player.postSamples(float32Samples);
    }

    this.isProcessing = false;
  }
}
