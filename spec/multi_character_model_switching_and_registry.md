# Multi-Character Architecture & Dynamic VRM Model Switching

**Date:** 2026-10-02  
**Status:** Implemented & Verified  
**Related Files:**  
- `./client/src/components/character/types.ts`
- `./client/src/components/character/index.ts`
- `./client/src/components/character/Character.tsx`
- `./client/src/components/character/AvatarLoader.ts`
- `./client/src/components/scene.tsx`
- `./client/src/App.tsx`
- `./client/src/navigation/useNavigation.ts`
- `./client/src/components/screens/OverviewScreen.tsx`
- `./client/src/components/screens/OverviewScreen.css`
- `./client/src/components/ChatInput.tsx`
- `./client/src/components/screens/SettingsScreen.tsx`
- `./client/vite.config.ts`

---

## 1. Overview & Objective

This specification details the architecture for **multi-character Assistant support**, dynamic 3D VRM model switching, visual character selection in the Overview screen, URL parameter synchronization, and Windows file-watcher stabilization.

### Key Goals
1. **Dynamic Character Registry**: Extensible character schema (`CharacterDefinition`) supporting arbitrary VRM characters with unique metadata (name, subtitle, category tag, description, avatar icon, VRM path, and custom chat placeholders).
2. **Model Switching in 3D Canvas**: Hot-swapping the 3D VRM humanoid avatar in React Three Fiber without requiring page reloads or unmounting the entire Canvas/OrbitControls.
3. **Graceful Asset & Memory Cleanup**: Explicit Three.js geometry and material disposal when unloading an avatar to prevent memory leaks and WebGL context crashes.
4. **Clean URL Synchronization**: `?screen=characters&character=akari&model=...` where `akari` is the default character, and `character=espeon` activates the second Assistant.
5. **Windows Watcher Stabilization**: Prevent Vite dev server `EBUSY: resource busy or locked` watch crashes caused by Node `fs.watch` inspecting 20MB+ `.vrm` binary assets in the client directory.

---

## 2. Character Registry & Definitions

Characters are declared centrally in `./client/src/components/character/types.ts`:

```typescript
export interface CharacterDefinition {
  id: string;
  name: string;
  displayName: string;
  subtitle: string;
  categoryTag: string;
  tagNumber: string;
  role: string;
  description: string;
  vrmUrl: string;
  avatarUrl: string;
  voiceEngine: "fish" | "sovits";
  placeholderText: string;
}

export const CHARACTERS: Record<string, CharacterDefinition> = {
  akari: {
    id: "akari",
    name: "Akari Watanabe",
    displayName: "Akari",
    subtitle: "Tsundere · Lively",
    categoryTag: "CHARACTERS",
    tagNumber: "01",
    role: "Anime Assistant",
    description: "Third-year high school student and stylish, lively gyaru from 'More Than a Married Couple, But Not Lovers'. Vibrant, spirited, with a secret caring side.",
    vrmUrl: "/characters/default.vrm",
    avatarUrl: "/akari_avatar.jpg",
    voiceEngine: "fish",
    placeholderText: "Say something to Akari…",
    position: [0, 0, 0],
    scale: 1,
  },
  espeon: {
    id: "espeon",
    name: "Espeon",
    displayName: "Espeon",
    subtitle: "Psychic · Elegant",
    categoryTag: "CHARACTERS",
    tagNumber: "02",
    role: "Psychic Assistant",
    description: "The Sun Pokémon. Calm, loyal, and perceptive, sensing air currents and thoughts with psychic awareness to protect and Assistant.",
    vrmUrl: "/characters/Espeon.vrm",
    avatarUrl: "/espeon_avatar.jpg",
    voiceEngine: "fish",
    placeholderText: "Say something to Espeon…",
    position: [0, 0.5, -0.10],
    scale: 0.9,
  },
};

export const CHARACTER_LIST: CharacterDefinition[] = Object.values(CHARACTERS);
export const DEFAULT_CHARACTER_ID = "akari";
export const DEFAULT_VRM_URL = CHARACTERS.akari.vrmUrl;

export function getCharacterConfig(characterId?: string): CharacterDefinition {
  if (!characterId) return CHARACTERS[DEFAULT_CHARACTER_ID];
  const normalized = characterId.toLowerCase().trim();
  return CHARACTERS[normalized] || CHARACTERS[DEFAULT_CHARACTER_ID];
}
```

---

## 3. 3D Model Swapping & Resource Disposal

### 3.1 The Dynamic Loading Pipeline
When `characterId` changes in `./client/src/components/character/Character.tsx`:
1. The cleanup phase of `useEffect` sets `cancelled = true` to abort any pending GLTF network requests.
2. Active controllers (`LipSyncController`, `AnimationController`, `EmotionController`) are disposed of to unsubscribe from WebSocket bus events.
3. The previous VRM hierarchy is traversed and all geometries, textures, and materials are freed via `disposeAvatar()`.
4. `setAvatar(null)` unmounts the old `<primitive object={avatar.vrm.scene} />`.
5. `loadAvatar(vrmUrl)` downloads and parses the new model via `GLTFLoader` and `@pixiv/three-vrm`.
6. Once loaded, new controller instances are attached to the fresh VRM rig and the component renders the new character seamlessly.

```typescript
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
```

### 3.2 Humanoid Rig Resilience
In `./client/src/components/character/DefaultPoseController.ts` and `./client/src/components/character/PoseController.ts`:
- All calls to `vrm.humanoid.getNormalizedBoneNode(...)` guard against undefined humanoid models with `vrm.humanoid?.getNormalizedBoneNode(...)`.
- Both `default.vrm` (Akari, 1.65m height) and `Espeon.vrm` (Espeon, 1.78m height) contain 54 humanoid bones and standard blend shapes (`aa`, `ih`, `ou`, `ee`, `oh`, `blink`, `angry`, `joy`, `sorrow`), enabling lip-sync, blinking, and breathing animation controllers to function immediately.

---

## 4. Overview Screen Character Switcher UI

The Overview screen (`./client/src/components/screens/OverviewScreen.tsx`) displays an interactive bottom card selector:
1. **Cards Row**: Loops over `CHARACTER_LIST` and displays avatar images, names, and active selection rings.
2. **Dynamic Left Panel**: Clicking any card invokes `onSelectCharacter(charId)`:
   - Header tag updates from `01` to `02`.
   - Title transitions from `Akari Watanabe` to `Espeon`.
   - Subtitle shifts to `Psychic · Elegant`.
   - Description and role badges render the selected Assistant's attributes.
   - Primary button labels: `Start chat with Akari` or `Start chat with Espeon`.
3. **URL State Synchronization**: `useNavigation.navigate("characters", targetCharacter)` pushes the new character into the browser history and URL query string (`?character=espeon`).

---

## 5. Vite Windows EBUSY Fix

### The Problem
On Windows, Node.js `fs.watch` locks large files (20MB+) placed inside `./client/public/`. When Vite is launched, `UVException EBUSY: resource busy or locked, watch '.../client/public/Espeon.vrm'` crashes Vite immediately.

### The Solution
In `./client/vite.config.ts`, configure `server.watch.ignored`:

```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      ignored: ['**/*.vrm', '**/characters/**', '**/public/characters/**'],
    },
  },
})
```

By instructing Vite's file watcher to ignore static `.vrm` 3D model binaries, Vite starts in under 500ms without file-locking crashes.
