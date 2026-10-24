import { createContext, useContext } from "react";
import type * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";

import type { AnimationController } from "./AnimationController";
import type { BlinkController } from "./BlinkController";
import type { BreathingController } from "./BreathingController";
import type { LookAtController } from "./LookAtController";
import type { LipSyncController } from "./LipSyncController";
import type { EmotionController } from "./EmotionController";
import type { PoseController } from "./PoseController";

export type AvatarControllers = {
  animation: AnimationController;
  blink: BlinkController;
  breathing: BreathingController;
  lookAt: LookAtController;
  lipSync: LipSyncController;
  emotion: EmotionController;
  pose: PoseController;
};

export type AvatarContextValue = {
  vrm: VRM;
  mixer: THREE.AnimationMixer;
  controllers: AvatarControllers;
};

export const AvatarContext =
  createContext<AvatarContextValue | null>(null);

export function useAvatar(): AvatarContextValue {
  const value = useContext(AvatarContext);

  if (!value) {
    throw new Error(
      "useAvatar must be used within AvatarContext.Provider"
    );
  }

  return value;
}
