import type { VRM } from "@pixiv/three-vrm";

const BLINK_EXPRESSION = "blink";

export class BlinkController {
  private timer = 0;
  private nextBlink = 2 + Math.random() * 3;
  private value = 0;
  private blinking = false;

  update(delta: number, vrm: VRM) {
    this.timer += delta;

    if (!this.blinking && this.timer >= this.nextBlink) {
      this.blinking = true;
      this.timer = 0;
      this.nextBlink = 2 + Math.random() * 3;
    }

    if (this.blinking) {
      this.value += delta * 12;
      if (this.value >= 1) {
        this.value = 1;
        this.blinking = false;
      }
    } else {
      this.value -= delta * 12;
      if (this.value < 0) {
        this.value = 0;
      }
    }

    vrm.expressionManager?.setValue(
      BLINK_EXPRESSION,
      this.value
    );
  }
}
