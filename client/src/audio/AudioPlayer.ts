import { audioAnalyser } from "./AudioAnalyser";

export class AudioPlayer {
  private currentAudio: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private isSourceConnected = false;

  async play(dataUri: string): Promise<void> {
    this.stop();

    const ctx = audioAnalyser.getContext();
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }

    return new Promise((resolve) => {
      const audio = new Audio(dataUri);
      this.currentAudio = audio;

      audio.onended = () => {
        this.currentAudio = null;
        resolve();
      };

      audio.onerror = (err) => {
        console.warn("Audio playback error:", err);
        this.currentAudio = null;
        resolve();
      };

      // Connect MediaElementSourceNode to AnalyserNode & Destination
      try {
        if (!this.sourceNode || this.currentAudio !== audio) {
          const source = ctx.createMediaElementSource(audio);
          source.connect(audioAnalyser.getAnalyserNode());
          audioAnalyser.getAnalyserNode().connect(ctx.destination);
          this.sourceNode = source;
          this.isSourceConnected = true;
        }
      } catch (e) {
        // Fallback for browsers with strict CORS/source node reuse restrictions
        if (!this.isSourceConnected) {
          audioAnalyser.getAnalyserNode().connect(ctx.destination);
        }
      }

      audio.play().catch((err) => {
        console.warn("Audio autoplay blocked or failed:", err);
        resolve();
      });
    });
  }

  stop(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
  }
}

export const audioPlayer = new AudioPlayer();
