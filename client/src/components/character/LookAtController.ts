import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";

export class LookAtController {
  private target = new THREE.Vector3();
  private enabled = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setTarget(position: THREE.Vector3) {
    this.target.copy(position);
  }

  update(vrm: VRM) {
    if (!this.enabled || !vrm.lookAt) return;

    vrm.lookAt.lookAt(this.target);
  }
}
