import * as THREE from "three";
import {
    VRM,
    VRMHumanBoneName,
} from "@pixiv/three-vrm";

export type PoseName =
    | "relaxed"
    | "attention"
    | "crossedArms"
    | "handsBehindBack";



export class PoseController {
    private readonly vrm: VRM;

    constructor(vrm: VRM) {
        this.vrm = vrm;
    }

    //
    // Helpers
    //
    private bone(name: VRMHumanBoneName) {
        if (!this.vrm.humanoid) return null;
        return this.vrm.humanoid.getNormalizedBoneNode(name);
    }

    private clearArms() {
        const bones = [
            VRMHumanBoneName.LeftUpperArm,
            VRMHumanBoneName.RightUpperArm,
            VRMHumanBoneName.LeftLowerArm,
            VRMHumanBoneName.RightLowerArm,
            VRMHumanBoneName.LeftHand,
            VRMHumanBoneName.RightHand,
        ];

        for (const boneName of bones) {
            const bone = this.bone(boneName);

            if (!bone) continue;

            bone.rotation.set(0, 0, 0);
        }

        this.vrm.update(0);
    }

    //
    // Called before a VRMA starts.
    // Leaves the avatar in a clean state.
    //
    clear() {
        this.clearArms();
    }

    //
    // Natural standing pose.
    //
    relaxed(
        armX = 5,
        armY = 8,
        armZ = 72
      ) {
        this.clearArms();
      
        const leftUpper = this.bone(
          VRMHumanBoneName.LeftUpperArm
        );
      
        const rightUpper = this.bone(
          VRMHumanBoneName.RightUpperArm
        );
      
        if (leftUpper) {
          leftUpper.rotation.set(
            THREE.MathUtils.degToRad(armX),
            THREE.MathUtils.degToRad(-armY),
            THREE.MathUtils.degToRad(armZ)
          );
        }
      
        if (rightUpper) {
          rightUpper.rotation.set(
            THREE.MathUtils.degToRad(armX),
            THREE.MathUtils.degToRad(armY),
            THREE.MathUtils.degToRad(-armZ)
          );
        }
      
        this.vrm.update(0);
      }
    //
    // Standing straight.
    //
    attention() {
        this.clearArms();

        const chest = this.bone(
            VRMHumanBoneName.Chest
        );

        if (chest) {
            chest.rotation.x =
                THREE.MathUtils.degToRad(-4);
        }

        this.vrm.update(0);
    }

    //
    // Placeholder.
    //
    crossedArms() {
        this.clearArms();

        const leftUpper = this.bone(
            VRMHumanBoneName.LeftUpperArm
        );

        const rightUpper = this.bone(
            VRMHumanBoneName.RightUpperArm
        );

        if (leftUpper) {
            leftUpper.rotation.z =
                THREE.MathUtils.degToRad(50);

            leftUpper.rotation.y =
                THREE.MathUtils.degToRad(30);
        }

        if (rightUpper) {
            rightUpper.rotation.z =
                THREE.MathUtils.degToRad(-50);

            rightUpper.rotation.y =
                THREE.MathUtils.degToRad(-30);
        }

        this.vrm.update(0);
    }

    //
    // Placeholder.
    //
    handsBehindBack() {
        this.clearArms();

        const leftUpper = this.bone(
            VRMHumanBoneName.LeftUpperArm
        );

        const rightUpper = this.bone(
            VRMHumanBoneName.RightUpperArm
        );

        if (leftUpper) {
            leftUpper.rotation.x =
                THREE.MathUtils.degToRad(-28);
        }

        if (rightUpper) {
            rightUpper.rotation.x =
                THREE.MathUtils.degToRad(-28);
        }

        this.vrm.update(0);
    }

    //
    // Convenience API
    //
    setPose(name: PoseName) {
        switch (name) {
            case "relaxed":
                this.relaxed();
                break;

            case "attention":
                this.attention();
                break;

            case "crossedArms":
                this.crossedArms();
                break;

            case "handsBehindBack":
                this.handsBehindBack();
                break;
        }
    }
}