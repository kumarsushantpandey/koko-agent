import type { VRM } from "@pixiv/three-vrm";
import { avatarEvents } from "../../networking/EventBus";

export class EmotionController {
  private currentEmotion: string = "neutral";
  private targetEmotion: string = "neutral";
  private weights: Record<string, number> = {
    happy: 0,
    sad: 0,
    angry: 0,
    surprised: 0,
    relaxed: 0,
  };
  private unsubscribeEmotion: (() => void) | null = null;
  private unsubscribeSpeechEnd: (() => void) | null = null;

  constructor() {
    this.unsubscribeEmotion = avatarEvents.on("emotion", (data: any) => {
      const emo = (data?.emotion || data || "neutral").toString().toLowerCase();
      this.targetEmotion = emo;
    });

    this.unsubscribeSpeechEnd = avatarEvents.on("speech_end", () => {
      this.targetEmotion = "neutral";
    });
  }

  update(delta: number, vrm: VRM): void {
    if (!vrm.expressionManager) return;

    const lerpSpeed = delta * 5.0; // Smooth 200ms emotion transitions

    for (const emo of Object.keys(this.weights)) {
      const targetWeight = emo === this.targetEmotion ? 1.0 : 0.0;
      this.weights[emo] += (targetWeight - this.weights[emo]) * Math.min(1.0, lerpSpeed);

      // Clamp close to 0
      if (this.weights[emo] < 0.01) {
        this.weights[emo] = 0;
      }

      // Apply to VRM expression manager
      try {
        vrm.expressionManager.setValue(emo as any, this.weights[emo]);
      } catch (e) {
        // Model might not have this specific custom expression
      }
    }
  }

  destroy(): void {
    if (this.unsubscribeEmotion) this.unsubscribeEmotion();
    if (this.unsubscribeSpeechEnd) this.unsubscribeSpeechEnd();
  }
}
