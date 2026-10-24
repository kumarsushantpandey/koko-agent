import { useSyncExternalStore } from "react";
import type {
  AnimationControlOption,
  EmotionName,
} from "./types";

export interface CharacterPose {
  armX: number;
  armY: number;
  armZ: number;
}

export interface CharacterControlsState {
  animation: AnimationControlOption;
  emotion: EmotionName;
  pose: CharacterPose;
}

export const DEFAULT_POSE: CharacterPose = {
  armX: 5,
  armY: 8,
  armZ: 72,
};

const DEFAULT_STATE: CharacterControlsState = {
  animation: "Idle",
  emotion: "Neutral",
  pose: { ...DEFAULT_POSE },
};

type Listener = () => void;

class CharacterControlsStore {
  private state: CharacterControlsState = { ...DEFAULT_STATE };
  private listeners: Set<Listener> = new Set();

  getState = (): CharacterControlsState => {
    return this.state;
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    this.listeners.forEach((l) => l());
  }

  setAnimation(animation: AnimationControlOption) {
    if (this.state.animation === animation) return;
    this.state = { ...this.state, animation };
    this.notify();
  }

  setEmotion(emotion: EmotionName) {
    if (this.state.emotion === emotion) return;
    this.state = { ...this.state, emotion };
    this.notify();
  }

  setPose(poseUpdate: Partial<CharacterPose>) {
    this.state = {
      ...this.state,
      pose: { ...this.state.pose, ...poseUpdate },
    };
    this.notify();
  }

  setArmX(val: number) {
    this.setPose({ armX: val });
  }

  setArmY(val: number) {
    this.setPose({ armY: val });
  }

  setArmZ(val: number) {
    this.setPose({ armZ: val });
  }

  resetPose() {
    this.state = {
      ...this.state,
      pose: { ...DEFAULT_POSE },
    };
    this.notify();
  }

  resetAll() {
    this.state = {
      animation: "Idle",
      emotion: "Neutral",
      pose: { ...DEFAULT_POSE },
    };
    this.notify();
  }
}

export const characterControlsStore = new CharacterControlsStore();

export function useCharacterControls() {
  const state = useSyncExternalStore(
    characterControlsStore.subscribe,
    characterControlsStore.getState,
    characterControlsStore.getState
  );

  return {
    ...state,
    setAnimation: (anim: AnimationControlOption) =>
      characterControlsStore.setAnimation(anim),
    setEmotion: (emo: EmotionName) => characterControlsStore.setEmotion(emo),
    setPose: (pose: Partial<CharacterPose>) =>
      characterControlsStore.setPose(pose),
    setArmX: (val: number) => characterControlsStore.setArmX(val),
    setArmY: (val: number) => characterControlsStore.setArmY(val),
    setArmZ: (val: number) => characterControlsStore.setArmZ(val),
    resetPose: () => characterControlsStore.resetPose(),
    resetAll: () => characterControlsStore.resetAll(),
  };
}
