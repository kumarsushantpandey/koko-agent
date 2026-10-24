import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { loadAvatar } from "./AvatarLoader";

import { AnimationController } from "./AnimationController";
import { BlinkController } from "./BlinkController";
import { BreathingController } from "./BreathingController";
import { LookAtController } from "./LookAtController";
import { LipSyncController } from "./LipSyncController";
import { EmotionController } from "./EmotionController";
import { PoseController } from "./PoseController";
import { useCharacterControls } from "./characterControlsStore";

import {
  AvatarContext,
  type AvatarContextValue,
} from "./AvatarContext";

import {
  getCharacterConfig,
  type AnimationName,
  type EmotionName,
} from "./types";

interface CharacterProps {
  characterId?: string;
}

function disposeAvatar(vrm: any, mixer?: THREE.AnimationMixer) {
  try {
    if (mixer) {
      mixer.stopAllAction();
      if (vrm?.scene) {
        mixer.uncacheRoot(vrm.scene);
      }
    }
    const root = vrm?.scene || vrm;
    root?.traverse?.((obj: any) => {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m: any) => m?.dispose?.());
        } else {
          obj.material?.dispose?.();
        }
      }
    });
  } catch (err) {
    console.warn("Avatar cleanup warning:", err);
  }
}

export default function Character({ characterId = "koko" }: CharacterProps) {
  const [avatar, setAvatar] =
    useState<AvatarContextValue | null>(null);

  const { animation, emotion, pose } = useCharacterControls();

  const cameraTarget = useRef(
    new THREE.Vector3()
  );

  const characterConfig = getCharacterConfig(characterId);
  const vrmUrl = characterConfig.vrmUrl;
  const position = characterConfig.position ?? [0, 0, 0];
  const scale = characterConfig.scale ?? 1;

  //
  // Load Avatar when character changes
  //

  useEffect(() => {
    let cancelled = false;
    let loadedAvatar: AvatarContextValue | null = null;

    async function init() {
      try {
        const { vrm, mixer } = await loadAvatar(vrmUrl);

        if (cancelled) {
          disposeAvatar(vrm, mixer);
          return;
        }

        // Keep vrm.scene normalized; outer <group position={position} scale={scale}> handles positioning and scaling
        vrm.scene.position.set(0, 0, 0);
        vrm.scene.scale.set(1, 1, 1);

        //
        // Default Pose
        //
        const poseCtrl = new PoseController(vrm);
        try {
          poseCtrl.relaxed();
        } catch {
          // ignore initial pose issue if model bones vary
        }

        //
        // Controllers
        //
        const controllers = {
          pose: poseCtrl,
          animation: new AnimationController(
            vrm,
            mixer,
            poseCtrl
          ),
          blink: new BlinkController(),
          breathing: new BreathingController(),
          lookAt: new LookAtController(),
          lipSync: new LipSyncController(),
          emotion: new EmotionController(),
        };

        loadedAvatar = {
          vrm,
          mixer,
          controllers,
        };

        setAvatar(loadedAvatar);
      } catch (err) {
        console.error(`Failed to load avatar for ${characterId} from ${vrmUrl}:`, err);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (loadedAvatar) {
        try {
          loadedAvatar.controllers.lipSync.dispose();
          loadedAvatar.controllers.emotion.dispose();
          loadedAvatar.controllers.animation.dispose();
          disposeAvatar(loadedAvatar.vrm, loadedAvatar.mixer);
        } catch (e) {
          console.warn("Error cleaning up previous avatar:", e);
        }
      }
      setAvatar(null);
    };
  }, [vrmUrl, characterId]);

  //
  // Emotion
  //

  useEffect(() => {
    if (!avatar) return;

    avatar.controllers.emotion.setEmotion(
      emotion as EmotionName
    );
  }, [avatar, emotion]);

  //
  // Animation
  //

  useEffect(() => {
    if (!avatar) return;

    if (animation === "None") {
      avatar.controllers.animation.stop();

      return;
    }

    avatar.controllers.animation.play(
      animation as AnimationName
    );
  }, [avatar, animation]);

  //
  // Frame Loop
  //

  useFrame((state, delta) => {
    if (!avatar) return;

    const {
      vrm,
      controllers,
    } = avatar;

    //
    // Body
    //

    controllers.animation.update(delta);

    //
    // Face
    //

    controllers.blink.update(
      delta,
      vrm
    );

    controllers.emotion.update(
      delta,
      vrm
    );

    controllers.lipSync.update(delta, vrm);

    //
    // Idle
    //

    controllers.breathing.update(
      delta,
      vrm
    );

    //
    // LookAt
    //

    cameraTarget.current.setFromMatrixPosition(
      state.camera.matrixWorld
    );

    controllers.lookAt.setTarget(
      cameraTarget.current
    );

    controllers.lookAt.update(vrm);

    //
    // Update VRM
    //

    vrm.update(delta);

    //
    // Pose 
    //
    if (!controllers.animation.isPlaying()) {
      controllers.pose.relaxed(
        pose.armX,
        pose.armY,
        pose.armZ
      );
    }
  });


  if (!avatar) return null;

  return (
    <AvatarContext.Provider
      value={avatar}
    >
      <group position={position} scale={[scale, scale, scale]}>
        <primitive
          object={avatar.vrm.scene}
        />
      </group>
    </AvatarContext.Provider>
  );
}