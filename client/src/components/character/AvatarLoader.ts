import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM } from "@pixiv/three-vrm";

export interface LoadedAvatar {
  vrm: VRM;
  mixer: THREE.AnimationMixer;
}

export async function loadAvatar(url: string): Promise<LoadedAvatar> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm as VRM;
  if (!vrm) {
    throw new Error(`VRM payload missing in ${url}`);
  }

  // Rotate VRM model 180 degrees to face the camera
  vrm.scene.rotation.y = Math.PI;

  const mixer = new THREE.AnimationMixer(vrm.scene);
  return { vrm, mixer };
}

export function disposeAvatar(vrm: any, mixer?: THREE.AnimationMixer) {
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
    console.warn("[Avatar] Cleanup warning:", err);
  }
}
