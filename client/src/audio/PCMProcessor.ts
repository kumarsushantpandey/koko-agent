/**
 * PCMProcessor
 *
 * AudioWorkletProcessor script definition for streaming real-time PCM audio.
 * Runs on the Web Audio rendering thread.
 *
 * Zero memory allocations inside process().
 */

export const WORKLET_PROCESSOR_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 44100 Hz * 60 seconds = 2,646,000 float samples (~10.5 MB RAM)
    // Supports long audio streams without ring buffer wrap-around overwrites.
    this.capacity = 2646000;
    this.buffer = new Float32Array(this.capacity);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.bufferedCount = 0;
    
    // ~150ms prebuffer target (6615 samples @ 44.1kHz)
    this.minPrebuffer = 6615;
    this.isBuffering = true;
    this.underruns = 0;
    this.logCount = 0;
    this.totalSamplesPlayed = 0;
    this.lastReportedSamples = 0;

    this.port.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === "push" && msg.samples) {
        const samples = msg.samples;
        const len = samples.length;

        // Overflow protection: if incoming samples exceed remaining capacity,
        // advance readIndex to avoid reading corrupted/overwritten buffer data.
        if (this.bufferedCount + len > this.capacity) {
          const overflow = (this.bufferedCount + len) - this.capacity;
          this.readIndex = (this.readIndex + overflow) % this.capacity;
          this.bufferedCount = this.capacity - len;
        }

        for (let i = 0; i < len; i++) {
          this.buffer[this.writeIndex] = samples[i];
          this.writeIndex = (this.writeIndex + 1) % this.capacity;
        }
        this.bufferedCount += len;

        if (this.isBuffering && this.bufferedCount >= this.minPrebuffer) {
          this.isBuffering = false;
          this.port.postMessage({
            type: "playback_state",
            isPlaying: true,
            playbackTime: this.totalSamplesPlayed / 44100,
          });
        }

        if (this.logCount < 5) {
          console.log(
            "[AudioWorklet] Pushed " + len + " samples | buffered=" + 
            this.bufferedCount + " (" + (this.bufferedCount / 44100).toFixed(3) + "s) | isBuffering=" + this.isBuffering
          );
          this.logCount++;
        }
      } else if (msg.type === "clear") {
        this.buffer.fill(0);
        this.writeIndex = 0;
        this.readIndex = 0;
        this.bufferedCount = 0;
        this.isBuffering = true;
        this.logCount = 0;
        this.totalSamplesPlayed = 0;
        this.lastReportedSamples = 0;
        this.port.postMessage({ type: "playback_reset" });
        console.log("[AudioWorklet] Cleared buffer.");
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const channel = output[0];
    const frameCount = channel.length; // 128 samples

    if (this.isBuffering || this.bufferedCount < frameCount) {
      if (!this.isBuffering && this.bufferedCount < frameCount) {
        this.underruns++;
        if (this.underruns <= 5) {
          console.warn("[AudioWorklet] Underrun #" + this.underruns + " (buffered: " + this.bufferedCount + ")");
        }
        this.isBuffering = true;
        this.port.postMessage({
          type: "playback_state",
          isPlaying: false,
          playbackTime: this.totalSamplesPlayed / 44100,
        });
      }

      for (let i = 0; i < frameCount; i++) {
        channel[i] = 0;
      }
      return true;
    }

    for (let i = 0; i < frameCount; i++) {
      channel[i] = this.buffer[this.readIndex];
      this.readIndex = (this.readIndex + 1) % this.capacity;
    }
    this.bufferedCount -= frameCount;
    this.totalSamplesPlayed += frameCount;

    // Report playback progress roughly every ~11.6ms (512 samples)
    if (this.totalSamplesPlayed - this.lastReportedSamples >= 512) {
      this.lastReportedSamples = this.totalSamplesPlayed;
      this.port.postMessage({
        type: "playback_progress",
        playedSamples: this.totalSamplesPlayed,
        playbackTime: this.totalSamplesPlayed / 44100,
        bufferedCount: this.bufferedCount,
      });
    }

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
`;

export function createWorkletModuleUrl(): string {
  const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}
