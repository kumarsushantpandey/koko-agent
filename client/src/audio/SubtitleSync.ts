/**
 * SubtitleSync
 *
 * Tracks audio chunk bytes and stream status for subtitle synchronization.
 * Fish Audio PCM: 44100 Hz, Int16 mono = 88200 bytes per second.
 */

const BYTES_PER_SECOND = 44100 * 2; // Int16 mono @ 44.1kHz

class SubtitleSync {
  private _totalAudioBytes = 0;
  private _audioEnded = false;
  private _listeners = new Set<() => void>();

  /**
   * Called whenever an AUDIO_CHUNK packet arrives.
   */
  addBytes(byteCount: number): void {
    this._totalAudioBytes += byteCount;
    this.notify();
  }

  /**
   * Called when AUDIO_END arrives.
   */
  markAudioEnd(): void {
    this._audioEnded = true;
    this.notify();
  }

  /**
   * Reset on speech session start or interrupt.
   */
  reset(): void {
    this._totalAudioBytes = 0;
    this._audioEnded = false;
    this.notify();
  }

  get totalBytes(): number {
    return this._totalAudioBytes;
  }

  get totalDuration(): number {
    return this._totalAudioBytes / BYTES_PER_SECOND;
  }

  get isAudioEnded(): boolean {
    return this._audioEnded;
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this._listeners) {
      try {
        listener();
      } catch (err) {
        console.error("[SubtitleSync] Listener error:", err);
      }
    }
  }
}

export const subtitleSync = new SubtitleSync();
