export { default } from "./Character";
export { useAvatar } from "./AvatarContext";
export type {
  AnimationName,
  AnimationControlOption,
  EmotionName,
  VisemeName,
  CharacterDefinition,
} from "./types";
export {
  ANIMATIONS,
  EMOTIONS,
  CHARACTERS,
  CHARACTER_LIST,
  DEFAULT_CHARACTER_ID,
  getCharacterConfig,
} from "./types";
export {
  useCharacterControls,
  characterControlsStore,
  DEFAULT_POSE,
  type CharacterPose,
  type CharacterControlsState,
} from "./characterControlsStore";
