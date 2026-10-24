export type ScreenType = "characters" | "chat" | "gallery" | "settings";

export interface NavigationState {
  screen: ScreenType;
  character: string;
  provider: string;
  model: string;
  tools: boolean;
}

export type ThemeMode = "dark" | "light";
