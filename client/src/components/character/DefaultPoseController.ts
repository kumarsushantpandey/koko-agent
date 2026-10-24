import * as THREE from "three";
import { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";

export class DefaultPoseController {
  apply(vrm: VRM) {
    if (!vrm.humanoid) return;

    const leftUpperArm = vrm.humanoid.getNormalizedBoneNode(
      VRMHumanBoneName.LeftUpperArm
    );

    const rightUpperArm = vrm.humanoid.getNormalizedBoneNode(
      VRMHumanBoneName.RightUpperArm
    );

    const leftLowerArm = vrm.humanoid.getNormalizedBoneNode(
      VRMHumanBoneName.LeftLowerArm
    );

    const rightLowerArm = vrm.humanoid.getNormalizedBoneNode(
      VRMHumanBoneName.RightLowerArm
    );

    //
    // Relax shoulders
    //
    if (leftUpperArm) {
      leftUpperArm.rotation.z = THREE.MathUtils.degToRad(18);
      leftUpperArm.rotation.x = THREE.MathUtils.degToRad(4);
      leftUpperArm.rotation.y = THREE.MathUtils.degToRad(-4);
    }

    if (rightUpperArm) {
      rightUpperArm.rotation.z = THREE.MathUtils.degToRad(-18);
      rightUpperArm.rotation.x = THREE.MathUtils.degToRad(4);
      rightUpperArm.rotation.y = THREE.MathUtils.degToRad(4);
    }

    //
    // Slight elbow bend
    //
    if (leftLowerArm) {
      leftLowerArm.rotation.z = THREE.MathUtils.degToRad(6);
    }

    if (rightLowerArm) {
      rightLowerArm.rotation.z = THREE.MathUtils.degToRad(-6);
    }

    vrm.update(0);
  }
}