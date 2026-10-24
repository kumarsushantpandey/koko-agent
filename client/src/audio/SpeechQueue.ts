/**
 * SpeechQueue
 *
 * Manages sentence-level speech segments received from the server.
 * Plays each audio segment through AudioPlayer, and triggers exact callbacks
 * for subtitle synchronization so that subtitles stay on screen while their
 * audio is playing, and only advance when that segment's audio finishes.
 */

import { audioPlayer } from "./AudioPlayer";
import { avatarEvents } from "../networking/EventBus";
import type { SpeechSegmentEvent } from "../networking/types";

type SegmentStartListener = (segment: SpeechSegmentEvent) => void;
type SegmentProgressListener = (currentTime: number, duration: number) => void;
type SegmentEndListener = (segment: SpeechSegmentEvent) => void;
type AllSegmentsEndListener = () => void;

export class SpeechQueue {
  private queue: SpeechSegmentEvent[] = [];
  private isPlaying = false;
  private currentSegment: SpeechSegmentEvent | null = null;
  private isTurnActive = false;
  private turnEndedByServer = false;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  private onStartListeners = new Set<SegmentStartListener>();
  private onProgressListeners = new Set<SegmentProgressListener>();
  private onEndListeners = new Set<SegmentEndListener>();
  private onAllEndListeners = new Set<AllSegmentsEndListener>();

  constructor() {
    avatarEvents.subscribe("turn_end" as any, () => {
      this.endTurn();
    });
  }

  /**
   * Signal that a dialogue turn has begun (e.g. user clicked send or speech was triggered).
   * Keeps the responding/playing state active while waiting for server generation and audio chunks.
   */
  startTurn(): void {
    this.clearFallbackTimer();
    this.isTurnActive = true;
    this.turnEndedByServer = false;
    // Safety fallback in case server drops connection or generates nothing
    this.armFallbackTimer(60000);
  }

  /**
   * Signal that the server has finished sending all segments for this turn.
   * If audio is already finished playing, concludes the turn immediately;
   * otherwise lets playback finish gracefully.
   */
  endTurn(): void {
    console.log("[SpeechQueue] endTurn received. isPlaying:", this.isPlaying, "queue:", this.queue.length);
    this.turnEndedByServer = true;
    if (!this.isPlaying && this.queue.length === 0) {
      this.finishTurn();
    }
  }

  enqueue(segment: SpeechSegmentEvent): void {
    this.clearFallbackTimer();
    this.isTurnActive = true;
    this.queue.push(segment);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  interrupt(): void {
    this.clearFallbackTimer();
    this.queue = [];
    this.isPlaying = false;
    this.currentSegment = null;
    this.isTurnActive = false;
    this.turnEndedByServer = false;
    audioPlayer.stop();
    this.notifyAllEnd();
  }

  get activeSegment(): SpeechSegmentEvent | null {
    return this.currentSegment;
  }

  get active(): boolean {
    return this.isPlaying || this.isTurnActive || this.queue.length > 0;
  }

  private finishTurn(): void {
    this.clearFallbackTimer();
    this.isTurnActive = false;
    this.turnEndedByServer = false;
    this.isPlaying = false;
    this.currentSegment = null;
    this.notifyAllEnd();
  }

  private playNext(): void {
    if (this.queue.length === 0) {
      if (this.turnEndedByServer || !this.isTurnActive) {
        this.finishTurn();
      } else {
        // Queue is temporarily drained between streaming sentence segments; wait for server
        this.isPlaying = false;
        this.currentSegment = null;
        this.armFallbackTimer(10000);
      }
      return;
    }

    const segment = this.queue.shift()!;
    this.clearFallbackTimer();
    this.isPlaying = true;
    this.currentSegment = segment;

    // Trigger emotion shift for this exact dialogue segment as audio begins
    if (segment.emotion) {
      avatarEvents.emit({ type: "emotion", emotion: segment.emotion });
    }

    this.notifyStart(segment);

    audioPlayer.playAudioUrl(
      segment.audio,
      (curr, dur) => {
        this.notifyProgress(curr, dur);
      },
      () => {
        this.notifyEnd(segment);
        if (this.queue.length > 0) {
          this.playNext();
        } else if (segment.is_last || this.turnEndedByServer || !this.isTurnActive) {
          // Final segment audio playback has physically finished on hardware sound
          this.finishTurn();
        } else {
          // Current segment finished playing, waiting for next segment from server
          this.isPlaying = false;
          this.currentSegment = null;
          this.armFallbackTimer(10000);
        }
      }
    );
  }

  private clearFallbackTimer(): void {
    if (this.fallbackTimer !== null) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  private armFallbackTimer(ms: number): void {
    this.clearFallbackTimer();
    this.fallbackTimer = setTimeout(() => {
      console.warn(`[SpeechQueue] Turn safety timer expired (${ms}ms). Concluding turn.`);
      if (this.isTurnActive) {
        this.finishTurn();
      }
    }, ms);
  }

  onSegmentStart(cb: SegmentStartListener): () => void {
    this.onStartListeners.add(cb);
    return () => {
      this.onStartListeners.delete(cb);
    };
  }

  onSegmentProgress(cb: SegmentProgressListener): () => void {
    this.onProgressListeners.add(cb);
    return () => {
      this.onProgressListeners.delete(cb);
    };
  }

  onSegmentEnd(cb: SegmentEndListener): () => void {
    this.onEndListeners.add(cb);
    return () => {
      this.onEndListeners.delete(cb);
    };
  }

  onAllSegmentsEnd(cb: AllSegmentsEndListener): () => void {
    this.onAllEndListeners.add(cb);
    return () => {
      this.onAllEndListeners.delete(cb);
    };
  }

  private notifyStart(seg: SpeechSegmentEvent) {
    for (const cb of this.onStartListeners) {
      try {
        cb(seg);
      } catch (err) {
        console.error("[SpeechQueue] start listener error:", err);
      }
    }
  }

  private notifyProgress(curr: number, dur: number) {
    for (const cb of this.onProgressListeners) {
      try {
        cb(curr, dur);
      } catch (err) {
        console.error("[SpeechQueue] progress listener error:", err);
      }
    }
  }

  private notifyEnd(seg: SpeechSegmentEvent) {
    for (const cb of this.onEndListeners) {
      try {
        cb(seg);
      } catch (err) {
        console.error("[SpeechQueue] end listener error:", err);
      }
    }
  }

  private notifyAllEnd() {
    for (const cb of this.onAllEndListeners) {
      try {
        cb();
      } catch (err) {
        console.error("[SpeechQueue] allEnd listener error:", err);
      }
    }
    // Signal speech end on the avatar event bus to return facial expressions to Neutral
    avatarEvents.emit({ type: "speech_end" });
  }
}

export const speechQueue = new SpeechQueue();
