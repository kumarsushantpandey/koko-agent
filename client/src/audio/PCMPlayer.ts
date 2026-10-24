/**
 * PCMPlayer
 *
 * Connects AudioWorkletNode to GainNode -> AnalyserNode -> Destination.
 * Handles zero-copy transferring of Float32 sample blocks to the AudioWorklet thread.
 */

import { createWorkletModuleUrl } from "./PCMProcessor";

export class PCMPlayer {
  private readonly context: AudioContext;
  private readonly gainNode: GainNode;

  private workletNode: AudioWorkletNode | null = null;
  private initPromise: Promise<void> | null = null;

  private _playbackTime = 0;
  private _playedSamples = 0;
  private _isPlaying = false;
  private progressListeners = new Set<(time: number) => void>();

  constructor(context: AudioContext, gainNode: GainNode) {
    this.context = context;
    this.gainNode = gainNode;
  }

  async init(): Promise<void> {
    if (this.workletNode) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const url = createWorkletModuleUrl();
        await this.context.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);

        this.workletNode = new AudioWorkletNode(this.context, "pcm-processor", {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });

        this.workletNode.port.onmessage = (event) => {
          const msg = event.data;
          if (msg.type === "playback_progress") {
            this._playbackTime = msg.playbackTime;
            this._playedSamples = msg.playedSamples;
            this._isPlaying = true;
            this.notifyProgress(msg.playbackTime);
          } else if (msg.type === "playback_state") {
            this._isPlaying = msg.isPlaying;
            this._playbackTime = msg.playbackTime;
          } else if (msg.type === "playback_reset") {
            this._playbackTime = 0;
            this._playedSamples = 0;
            this._isPlaying = false;
          }
        };

        // Audio graph: Worklet -> GainNode -> AnalyserNode -> Destination
        this.workletNode.connect(this.gainNode);
        console.log(`[PCMPlayer] Worklet initialized successfully at ${this.context.sampleRate} Hz`);
      } catch (err) {
        console.error("[PCMPlayer] Failed to load AudioWorklet:", err);
      }
    })();

    return this.initPromise;
  }

  postSamples(samples: Float32Array): void {
    if (!this.workletNode) {
      this.init().then(() => {
        if (this.workletNode) {
          this.workletNode.port.postMessage(
            { type: "push", samples: samples },
            [samples.buffer]
          );
        }
      });
      return;
    }

    this.workletNode.port.postMessage(
      { type: "push", samples: samples },
      [samples.buffer]
    );
  }

  clear(): void {
    this._playbackTime = 0;
    this._playedSamples = 0;
    this._isPlaying = false;
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: "clear" });
    }
  }

  get playbackTime(): number {
    return this._playbackTime;
  }

  get playedSamples(): number {
    return this._playedSamples;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  onProgress(listener: (time: number) => void): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  private notifyProgress(time: number): void {
    for (const listener of this.progressListeners) {
      try {
        listener(time);
      } catch (err) {
        console.error("[PCMPlayer] Progress listener error:", err);
      }
    }
  }
}
