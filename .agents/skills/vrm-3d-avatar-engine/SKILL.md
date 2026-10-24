---
name: vrm-3d-avatar-engine
description: Guide and architectural patterns for creating high-performance 3D VRM avatar web applications with Three.js, React Three Fiber, procedural animations, and WebGL resource management.
---

# VRM 3D Avatar Engine Skill

Use this skill when designing, building, or troubleshooting a web-based 3D VRM humanoid avatar application. This skill provides production-grade architectural patterns, lifecycle management, and animation controllers.

---

## 1. Core Technology Stack
- **Three.js**: WebGL rendering engine (`three`).
- **@pixiv/three-vrm**: Official parser and runtime for VRM 0.0 and VRM 1.0 models.
- **@pixiv/three-vrm-animation**: VRMA animation clip retargeting.
- **@react-three/fiber**: React declarative wrapper for Three.js.
- **@react-three/drei**: Useful Three.js helpers (`OrbitControls`, lighting environments).

---

## 2. Dynamic Character Registry Pattern

Define an extensible character schema decoupling avatar metadata from render components:

```typescript
export interface CharacterDefinition {
  id: string;
  name: string;
  displayName: string;
  subtitle: string;
  role: string;
  description: string;
  vrmUrl: string;
  avatarUrl: string;
  position?: [number, number, number];
  scale?: number;
}

export const CHARACTERS: Record<string, CharacterDefinition> = {
  companion1: {
    id: "companion1",
    name: "Akari",
    displayName: "Akari",
    subtitle: "Lively Companion",
    role: "Anime Assistant",
    description: "Expressive 3D anime avatar.",
    vrmUrl: "/characters/default.vrm",
    avatarUrl: "/akari_avatar.jpg",
    position: [0, 0, 0],
    scale: 1,
  },
};
```

---

## 3. WebGL Memory Disposal & Hot-Swapping

When changing avatars, failing to dispose of geometries and textures will crash the WebGL context with `CONTEXT_LOST_WEBGL`.

### The Proper Cleanup Function
```typescript
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
    console.warn("Avatar cleanup warning:", err);
  }
}
```

---

## 4. Skeletal Defense & Bone Optional Chaining

Different VRM models have variations in their humanoid bone hierarchy (e.g., missing toes, extra chest bones). Always guard bone node queries:

```typescript
// ALWAYS use optional chaining on humanoid and getNormalizedBoneNode
const upperArm = vrm.humanoid?.getNormalizedBoneNode("leftUpperArm");
if (upperArm) {
  upperArm.rotation.z = Math.PI / 4;
}
```

---

## 5. Procedural Animation Controllers

### 5.1 Procedural Blinking (`BlinkController`)
Create human-like blinking using randomized intervals:
- Duration: ~150ms per blink.
- Interval: Random between 2.0s and 6.0s.
- Morph target: `vrm.expressionManager.setValue("blink", weight)`.

### 5.2 Sinusoidal Breathing (`BreathingController`)
Animate the chest or spine bone with a gentle sinusoidal wave:
```typescript
const spine = vrm.humanoid?.getNormalizedBoneNode("spine");
if (spine) {
  const breath = Math.sin(clock.getElapsedTime() * 1.5) * 0.02;
  spine.rotation.x = breath;
}
```

### 5.3 Camera Tracking (`LookAtController`)
Set VRM `lookAt.target` to follow the active camera position or mouse cursor with damping.

---

## 6. Build & Bundler Gotchas

### Windows Vite `EBUSY: resource busy or locked`
Node.js file-watchers crash when watching large binary assets (`.vrm`, `.vrma`). Fix in `vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    watch: {
      ignored: ['**/*.vrm', '**/characters/**'],
    },
  },
});
```
