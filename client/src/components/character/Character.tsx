import React, { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import { CHARACTERS } from "./types";
import { loadAvatar, disposeAvatar, type LoadedAvatar } from "./AvatarLoader";
import { BlinkController } from "./BlinkController";
import { BreathingController } from "./BreathingController";
import { LookAtController } from "./LookAtController";
import { EmotionController } from "./EmotionController";
import { LipSyncController } from "./LipSyncController";

interface CharacterProps {
  characterId: string;
}

export const Character: React.FC<CharacterProps> = ({ characterId }) => {
  const [avatar, setAvatar] = useState<LoadedAvatar | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const blinkRef = useRef<BlinkController>(new BlinkController());
  const breathingRef = useRef<BreathingController>(new BreathingController());
  const lookAtRef = useRef<LookAtController>(new LookAtController());
  const emotionRef = useRef<EmotionController | null>(null);
  const lipSyncRef = useRef<LipSyncController>(new LipSyncController());

  const character = CHARACTERS[characterId] || CHARACTERS.koko;

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    const emotionCtrl = new EmotionController();
    emotionRef.current = emotionCtrl;

    loadAvatar(character.vrmUrl)
      .then((loaded) => {
        if (isCancelled) {
          disposeAvatar(loaded.vrm, loaded.mixer);
          return;
        }
        setAvatar(loaded);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load character VRM:", err);
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
      if (emotionCtrl) {
        emotionCtrl.destroy();
      }
      setAvatar((prev) => {
        if (prev) {
          disposeAvatar(prev.vrm, prev.mixer);
        }
        return null;
      });
    };
  }, [character.vrmUrl]);

  useFrame((state, delta) => {
    if (!avatar) return;
    const { vrm, mixer } = avatar;

    // Clamp delta to avoid animation jumping after background tab switch
    const clampedDelta = Math.min(delta, 0.1);

    vrm.update(clampedDelta);
    mixer?.update(clampedDelta);

    blinkRef.current.update(clampedDelta, vrm);
    breathingRef.current.update(clampedDelta, vrm);

    lookAtRef.current.setTarget(state.camera.position);
    lookAtRef.current.update(vrm);

    emotionRef.current?.update(clampedDelta, vrm);
    lipSyncRef.current.update(clampedDelta, vrm);
  });

  if (!avatar) return null;

  return (
    <primitive
      object={avatar.vrm.scene}
      position={character.position || [0, 0, 0]}
      scale={character.scale || 1}
    />
  );
};
