import type { VRM } from "@pixiv/three-vrm";
import { audioAnalyser } from "../../audio/AudioAnalyser";

export class LipSyncController {
  private noiseGate = 0.035;
  private currentWeight = 0;

  update(delta: number, vrm: VRM): void {
    if (!vrm.expressionManager) return;

    const rms = audioAnalyser.getRMS();

    if (rms < this.noiseGate) {
      // Smooth decay to zero
      this.currentWeight = Math.max(0, this.currentWeight - delta * 10.0);
    } else {
      // Dynamic expansion
      const target = Math.min(1.0, Math.pow(rms * 2.4, 1.2));
      this.currentWeight += (target - this.currentWeight) * Math.min(1.0, delta * 25.0);
    }

    try {
      vrm.expressionManager.setValue("aa", this.currentWeight * 0.75);
      vrm.expressionManager.setValue("oh", this.currentWeight * 0.35);
    } catch (e) {
      // Blendshape fallback
    }
  }
}
