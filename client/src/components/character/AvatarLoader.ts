import * as THREE from "three";
import {
  type GLTF,
  GLTFLoader,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin } from "@pixiv/three-vrm";
import { DefaultPoseController } from "./DefaultPoseController";

export type LoadedAvatar = {
  vrm: VRM;
  mixer: THREE.AnimationMixer;
};

export async function loadAvatar(
  url: string
): Promise<LoadedAvatar> {
  const vrmLoader = new GLTFLoader();

  vrmLoader.register(
    (parser) => new VRMLoaderPlugin(parser)
  );

  let vrmGltf: GLTF;
  try {
    vrmGltf = (await vrmLoader.loadAsync(url)) as GLTF;
  } catch (err) {
    if (url === "/characters/default.vrm") {
      try {
        vrmGltf = (await vrmLoader.loadAsync("/character.vrm")) as GLTF;
      } catch {
        throw err;
      }
    } else {
      throw err;
    }
  }

  const vrm = vrmGltf.userData.vrm as VRM;
  if (!vrm) {
    throw new Error(`GLTF asset at ${url} does not contain valid VRM data`);
  }

  vrm.scene.rotation.y = Math.PI;
  vrm.scene.position.set(0, 0, 0);

  try {
    new DefaultPoseController().apply(vrm);
  } catch (err) {
    console.warn("Could not apply default pose:", err);
  }

  const mixer = new THREE.AnimationMixer(vrm.scene);

  return { vrm, mixer };
}
