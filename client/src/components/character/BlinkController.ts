import type { VRM } from "@pixiv/three-vrm";

export class BlinkController {
  private blinkTimer = 0;
  private nextBlinkInterval = 3.0;
  private isBlinking = false;
  private blinkProgress = 0;

  update(delta: number, vrm: VRM): void {
    if (!vrm.expressionManager) return;

    if (!this.isBlinking) {
      this.blinkTimer += delta;
      if (this.blinkTimer >= this.nextBlinkInterval) {
        this.isBlinking = true;
        this.blinkTimer = 0;
        this.blinkProgress = 0;
        this.nextBlinkInterval = 2.0 + Math.random() * 4.0;
      }
    } else {
      this.blinkProgress += delta * 12.0; // Fast blink (~150ms)
      if (this.blinkProgress >= Math.PI) {
        this.isBlinking = false;
        vrm.expressionManager.setValue("blink", 0);
      } else {
        const weight = Math.sin(this.blinkProgress);
        vrm.expressionManager.setValue("blink", weight);
      }
    }
  }
}
