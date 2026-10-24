import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";

export class LookAtController {
  private target = new THREE.Vector3(0, 1.4, 2.0);

  setTarget(pos: THREE.Vector3): void {
    this.target.copy(pos);
  }

  update(vrm: VRM): void {
    if (vrm.lookAt) {
      vrm.lookAt.lookAt(this.target);
    }
  }
}
