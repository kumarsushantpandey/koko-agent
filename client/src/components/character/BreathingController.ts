import type { VRM } from "@pixiv/three-vrm";

/** Subtle chest motion when the rig exposes a chest humanoid bone. */
export class BreathingController {
  private phase = 0;

  update(delta: number, vrm: VRM) {
    this.phase += delta;

    const chest = vrm.humanoid?.getNormalizedBoneNode(
      "chest"
    );
    if (!chest) return;

    const breath =
      Math.sin(this.phase * 1.4) * 0.015;

    chest.rotation.x = breath;
  }
}
