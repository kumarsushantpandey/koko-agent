import { avatarEvents } from "../networking/EventBus";
import { audioPlayer } from "./AudioPlayer";

export interface SpeechSegmentItem {
  audio: string;
  text: string;
  emotion?: string;
  segment_index?: number;
}

export class SpeechQueue {
  private queue: SpeechSegmentItem[] = [];
  private isPlaying = false;

  enqueue(item: SpeechSegmentItem): void {
    this.queue.push(item);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      // All queued audio segments finished: lerp facial expression back to Neutral
      avatarEvents.emit("speech_end");
      return;
    }

    const segment = this.queue.shift()!;
    this.isPlaying = true;

    // Shift facial expression the exact millisecond physical audio begins
    if (segment.emotion) {
      avatarEvents.emit("emotion", segment.emotion);
    }

    await audioPlayer.play(segment.audio);
    this.playNext();
  }

  clear(): void {
    this.queue = [];
    this.isPlaying = false;
    audioPlayer.stop();
    avatarEvents.emit("speech_end");
  }

  get length(): number {
    return this.queue.length;
  }
}

export const speechQueue = new SpeechQueue();
