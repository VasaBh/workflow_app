import { create } from "zustand";

const NOTIFICATIONS_SETTINGS_KEY = "wos_notifications_settings";

interface NotificationSettings {
  enableAnimations: boolean;
  enableSound: boolean;
  soundVolume: number; // 0-1
}

export interface LiveMessage {
  title: string;
  message: string;
  event_type?: string;
}

const defaultSettings: NotificationSettings = {
  enableAnimations: true,
  enableSound: true,
  soundVolume: 0.7,
};

function saveSettings(settings: NotificationSettings) {
  if (typeof window !== "undefined") {
    localStorage.setItem(NOTIFICATIONS_SETTINGS_KEY, JSON.stringify(settings));
  }
}

function loadSettings(): NotificationSettings {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  try {
    const raw = localStorage.getItem(NOTIFICATIONS_SETTINGS_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

interface NotificationStore {
  settings: NotificationSettings;
  isHydrated: boolean;
  liveMessage: LiveMessage | null;
  setSettings: (settings: Partial<NotificationSettings>) => void;
  toggleAnimations: () => void;
  toggleSound: () => void;
  setSoundVolume: (volume: number) => void;
  hydrate: () => void;
  setLiveMessage: (msg: LiveMessage | null) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => {
  return {
    settings: defaultSettings,
    isHydrated: false,
    liveMessage: null,
    setLiveMessage: (msg) => set({ liveMessage: msg }),
    hydrate: () => {
      const loadedSettings = loadSettings();
      set({ settings: loadedSettings, isHydrated: true });
    },
    setSettings: (updated) =>
      set((state) => {
        const newSettings = { ...state.settings, ...updated };
        saveSettings(newSettings);
        return { settings: newSettings };
      }),
    toggleAnimations: () =>
      set((state) => {
        const newSettings = {
          ...state.settings,
          enableAnimations: !state.settings.enableAnimations,
        };
        saveSettings(newSettings);
        return { settings: newSettings };
      }),
    toggleSound: () =>
      set((state) => {
        const newSettings = {
          ...state.settings,
          enableSound: !state.settings.enableSound,
        };
        saveSettings(newSettings);
        return { settings: newSettings };
      }),
    setSoundVolume: (volume) =>
      set((state) => {
        const newSettings = {
          ...state.settings,
          soundVolume: Math.max(0, Math.min(1, volume)),
        };
        saveSettings(newSettings);
        return { settings: newSettings };
      }),
  };
});
