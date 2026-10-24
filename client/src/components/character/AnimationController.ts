import * as THREE from "three";

import {
  type GLTF,
  GLTFLoader,
} from "three/examples/jsm/loaders/GLTFLoader.js";

import type { VRM } from "@pixiv/three-vrm";

import {
  VRMAnimation,
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
} from "@pixiv/three-vrm-animation";

import {
  ANIMATIONS,
  type AnimationName,
} from "./types";

import { PoseController } from "./PoseController";

export class AnimationController {
  private readonly loader: GLTFLoader;

  private readonly actions = new Map<
    AnimationName,
    THREE.AnimationAction
  >();

  private readonly loading =
    new Set<AnimationName>();

  private current:
    | THREE.AnimationAction
    | null = null;

  private readonly vrm: VRM;
  private readonly mixer: THREE.AnimationMixer;
  private readonly pose: PoseController;

  constructor(
    vrm: VRM,
    mixer: THREE.AnimationMixer,
    pose: PoseController
  ) {
    this.vrm = vrm;
    this.mixer = mixer;
    this.pose = pose;

    this.loader = new GLTFLoader();

    this.loader.register(
      parser => new VRMAnimationLoaderPlugin(parser)
    );
  }

  private next: THREE.AnimationAction | null = null;
  private readonly fadeDuration = 0.25;

  update(delta: number) {
    this.mixer.update(delta);

    if (this.next) {
      this.current?.stop();

      this.current = this.next;

      this.next = null;
    }
  }

  get currentAction() {
    return this.current;
  }

  hasLoaded(name: AnimationName) {
    return this.actions.has(name);
  }

  async preload(name: AnimationName) {
    await this.load(name);
  }

  async preloadAll() {
    for (const animation of Object.keys(
      ANIMATIONS
    ) as AnimationName[]) {
      await this.load(animation);
    }
  }

  private async load(
    name: AnimationName
  ): Promise<THREE.AnimationAction | null> {
    //
    // Already cached
    //
    const cached =
      this.actions.get(name);

    if (cached) return cached;

    //
    // Already loading
    //
    if (this.loading.has(name))
      return null;

    this.loading.add(name);

    try {
      const gltf = (await this.loader.loadAsync(
        ANIMATIONS[name]
      )) as GLTF;

      const animation =
        gltf.userData.vrmAnimations?.[0] as
        | VRMAnimation
        | undefined;

      if (!animation) {
        console.warn(
          `Animation "${name}" has no VRM animation.`
        );

        return null;
      }

      const clip =
        createVRMAnimationClip(
          animation,
          this.vrm
        );

      const action =
        this.mixer.clipAction(clip);

      action.enabled = true;

      action.loop = THREE.LoopRepeat;

      action.clampWhenFinished =
        false;

      action.setEffectiveWeight(1);

      this.actions.set(name, action);

      console.log(
        "Loaded animation:",
        name
      );

      return action;
    } finally {
      this.loading.delete(name);
    }
  }

  async play(
    name: AnimationName,
    instant = false
  ) {
    const action = await this.load(name);

    if (!action) return;

    if (action === this.current) return;

    this.pose.clear();

    if (instant || !this.current) {
      this.current?.stop();

      action.reset();

      action.enabled = true;
      action.setEffectiveWeight(1);
      action.play();

      this.current = action;

      return;
    }

    this.current.crossFadeTo(
      action,
      this.fadeDuration,
      true
    );

    action.reset();
    action.enabled = true;
    action.play();

    this.next = action;
  }

  stop() {
    if (!this.current) {
      this.pose.relaxed();
      return;
    }

    const current = this.current;

    current.fadeOut(this.fadeDuration);

    this.current = null;

    setTimeout(() => {
      current.stop();

      this.pose.relaxed();
    }, this.fadeDuration * 1000);
  }

  stopImmediately() {
    this.current?.stop();

    this.current = null;

    this.pose.relaxed();
  }

  dispose() {
    this.stopImmediately();

    this.actions.clear();
  }

  isPlaying() {
    return this.current !== null;
  }

  getCurrentAction() {
    return this.current;
  }
}