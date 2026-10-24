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
  placeholderText: string;
  position?: [number, number, number];
  scale?: number;
}

export const CHARACTERS: Record<string, CharacterDefinition> = {
  koko: {
    id: "koko",
    name: "Koko AI",
    displayName: "Koko",
    subtitle: "Anime AI Assistant",
    categoryTag: "ASSISTANT",
    tagNumber: "01",
    role: "Tsundere Gamer & Tech Enthusiast",
    description: "Vibrant 3D VRM companion with an energetic, tsundere personality. Gamer, anime fan, and technology enthusiast!",
    vrmUrl: "/characters/default.vrm",
    avatarUrl: "/koko_avatar.jpg",
    placeholderText: "Chat with Koko AI...",
    position: [0, 0, 0],
    scale: 1.0,
  },
  espeon: {
    id: "espeon",
    name: "Espeon",
    displayName: "Espeon",
    subtitle: "Psychic Companion",
    categoryTag: "POKEMON",
    tagNumber: "02",
    role: "Psychic Guardian",
    description: "Perceptive and elegant psychic companion with heightened awareness and protective devotion.",
    vrmUrl: "/characters/Espeon.vrm",
    avatarUrl: "/espeon_avatar.jpg",
    placeholderText: "Commune with Espeon...",
    position: [0, 0.07, -0.10],
    scale: 0.9,
  },
};
