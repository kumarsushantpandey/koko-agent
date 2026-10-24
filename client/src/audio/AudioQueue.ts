/**
 * AudioQueue
 *
 * Exposes the queue interface used by AvatarSocket.
 * Forwards binary WebSocket packets directly to the AudioEngine PCM pipeline.
 */

import { audioPlayer } from "./AudioPlayer";

export class AudioQueue {
  push(chunk: ArrayBuffer): void {
    audioPlayer.push(chunk);
  }

  flush(): void {
    audioPlayer.stop();
  }
}

export const audioQueue = new AudioQueue();
