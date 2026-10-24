import { useState, useCallback, useEffect } from "react";
import { avatarSocket } from "../networking/AvatarSocket";

export type ScreenType = "chat" | "characters" | "settings";

export interface NavigationState {
  screen: ScreenType;
  character: string;
  provider: string;
  model: string;
  tools: boolean;
}

function parseLocation(): NavigationState {
  const params = new URLSearchParams(window.location.search);
  const rawScreen = params.get("screen") as ScreenType;
  const screen: ScreenType = ["chat", "characters", "settings"].includes(rawScreen)
    ? rawScreen
    : "chat";

  const character = params.get("character") || "koko";
  const model = params.get("model") || "ministral-8b-latest";

  // Infer provider from model name
  let provider = "mistral";
  if (model.toLowerCase().includes("gemma") || model.toLowerCase().includes("llama")) {
    provider = "llama_cpp";
  }

  // Persist tool calling exclusively in localStorage
  const savedTools = localStorage.getItem("koko_tool_calling_enabled");
  const tools = savedTools !== null ? savedTools === "true" : true;

  return { screen, character, provider, model, tools };
}

export function useNavigation() {
  const [navState, setNavState] = useState<NavigationState>(parseLocation);

  const navigate = useCallback(
    (
      targetScreen: ScreenType,
      targetCharacter?: string,
      targetProvider?: string,
      targetModel?: string,
      targetTools?: boolean
    ) => {
      const char = targetCharacter || navState.character || "koko";
      const mod = targetModel || navState.model || "ministral-8b-latest";
      let prov = targetProvider;
      if (!prov) {
        prov = (mod.toLowerCase().includes("gemma") || mod.toLowerCase().includes("llama"))
          ? "llama_cpp"
          : "mistral";
      }
      const tls = targetTools !== undefined ? targetTools : navState.tools;

      // Construct clean URL without cluttering query params
      const params = new URLSearchParams();
      params.set("screen", targetScreen);
      params.set("character", char);
      params.set("model", mod);
      const url = `/?${params.toString()}`;

      if (targetTools !== undefined) {
        localStorage.setItem("koko_tool_calling_enabled", tls ? "true" : "false");
      }

      window.history.pushState(null, "", url);
      setNavState({
        screen: targetScreen,
        character: char,
        provider: prov,
        model: mod,
        tools: tls,
      });

      avatarSocket.setLlmProvider(prov, mod);
      avatarSocket.setToolCalling(tls);
    },
    [navState]
  );

  useEffect(() => {
    const handlePopState = () => {
      const updated = parseLocation();
      setNavState(updated);
      avatarSocket.setLlmProvider(updated.provider, updated.model);
      avatarSocket.setToolCalling(updated.tools);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return { ...navState, navigate };
}
