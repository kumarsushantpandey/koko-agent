import type { VRM } from "@pixiv/three-vrm";

export class BreathingController {
  private elapsedTime = 0;

  update(delta: number, vrm: VRM): void {
    this.elapsedTime += delta;
    const spine = vrm.humanoid?.getNormalizedBoneNode("spine");
    if (spine) {
      const breath = Math.sin(this.elapsedTime * 1.5) * 0.015;
      spine.rotation.x = breath;
    }
  }
}
