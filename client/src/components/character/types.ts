export const ANIMATIONS = {
  Idle: "/animations/Idle.vrma",
  Blush: "/animations/Blush.vrma",
  Clapping: "/animations/Clapping.vrma",
  Jump: "/animations/Jump.vrma",
  LookAround: "/animations/LookAround.vrma",
  Relax: "/animations/Relax.vrma",
  Sad: "/animations/Sad.vrma",
  Sleepy: "/animations/Sleepy.vrma",
  Surprised: "/animations/Surprised.vrma",
  Thinking: "/animations/Thinking.vrma",
} as const;

export type AnimationName = keyof typeof ANIMATIONS;

export type AnimationControlOption = "None" | AnimationName;

export const EMOTIONS = {
  Neutral: {},
  Happy: { happy: 1 },
  Sad: { sad: 1 },
  Angry: { angry: 1 },
  Relaxed: { relaxed: 1 },
  Surprised: { surprised: 1 },
} as const satisfies Record<
  string,
  Record<string, number>
>;

export type EmotionName = keyof typeof EMOTIONS;

export const VISEME_EXPRESSIONS = [
  "aa",
  "ih",
  "ou",
  "ee",
  "oh",
] as const;

export type VisemeName = (typeof VISEME_EXPRESSIONS)[number];

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
  position?: [number, number, number];
  scale?: number;
}

export const CHARACTERS: Record<string, CharacterDefinition> = {
  koko: {
    id: "koko",
    name: "Koko",
    displayName: "Koko",
    subtitle: "Tsundere · Lively Anime AI",
    categoryTag: "CHARACTERS",
    tagNumber: "01",
    role: "Anime Assistant",
    description: "Your anime companion and AI coding partner. Confident, spirited, and caring with multimodal voice, vision, and tool capabilities.",
    vrmUrl: "/characters/default.vrm",
    avatarUrl: "/koko_avatar.jpg",
    voiceEngine: "fish",
    placeholderText: "Message Koko...",
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
    description: "The Sun Pokémon. Calm, loyal, and perceptive, sensing air currents and thoughts with psychic awareness to protect and assist.",
    vrmUrl: "/characters/Espeon.vrm",
    avatarUrl: "/espeon_avatar.jpg",
    voiceEngine: "fish",
    placeholderText: "Message Espeon...",
    position: [0, 0.07, -0.10],
    scale: 0.9,
  },
};

export const CHARACTER_LIST: CharacterDefinition[] = Object.values(CHARACTERS);
export const DEFAULT_CHARACTER_ID = "koko";
export const DEFAULT_VRM_URL = CHARACTERS.koko.vrmUrl;

export function getCharacterConfig(characterId?: string): CharacterDefinition {
  if (!characterId) return CHARACTERS[DEFAULT_CHARACTER_ID];
  const normalized = characterId.toLowerCase().trim();
  if (normalized === "akari") return CHARACTERS.koko;
  return CHARACTERS[normalized] || CHARACTERS[DEFAULT_CHARACTER_ID];
}
