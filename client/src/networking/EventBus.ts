import type { AvatarEvent } from "./types";

type EventMap = {
  [K in AvatarEvent["type"]]: Extract<
    AvatarEvent,
    { type: K }
  >;
};

export class EventBus {
  private listeners = new Map<
    keyof EventMap,
    Set<(event: AvatarEvent) => void>
  >();

  subscribe<K extends keyof EventMap>(
    type: K,
    listener: (event: EventMap[K]) => void
  ) {
    let set = this.listeners.get(type);

    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }

    set.add(listener as (event: AvatarEvent) => void);

    return () => {
      set!.delete(
        listener as (event: AvatarEvent) => void
      );
    };
  }

  emit(event: AvatarEvent) {
    const listeners = this.listeners.get(event.type);
    
    console.log("[EventBus]", event);
    
    if (!listeners) return;
    

    listeners.forEach((listener) =>
      listener(event)
    );
  }

  clear() {
    this.listeners.clear();
  }
}

export const avatarEvents = new EventBus();