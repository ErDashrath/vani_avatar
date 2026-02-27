/**
 * Global chat store – Zustand.
 *
 * skills.sh applied:
 *  • rerender-derived-state → status derived from booleans, not raw object
 *  • rerender-defer-reads   → components subscribe only to slices they render
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppStatus, AvatarType, ConversationEntry } from "../types";
import { DEFAULT_HUMAN_AVATAR_ID, uid } from "../utils/constants";

interface ChatState {
  status: AppStatus;
  messages: ConversationEntry[];
  interimText: string;
  avatarType: AvatarType;
  avatarId: string;
  theme: "light" | "dark" | "system";

  setStatus: (s: AppStatus) => void;
  setInterimText: (t: string) => void;
  addMessage: (role: "user" | "assistant", content: string) => void;
  clearMessages: () => void;
  setAvatarType: (t: AvatarType) => void;
  setAvatarId: (id: string) => void;
  setTheme: (t: "light" | "dark" | "system") => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      status: "ready",
      messages: [],
      interimText: "",
      avatarType: "gif",
      avatarId: DEFAULT_HUMAN_AVATAR_ID,
      theme: "system",

      setStatus: (status) => set({ status }),
      setInterimText: (interimText) => set({ interimText }),

      addMessage: (role, content) =>
        set((s) => ({
          messages: [
            ...s.messages,
            { id: uid(), role, content, timestamp: Date.now() },
          ],
        })),

      clearMessages: () => set({ messages: [] }),
      setAvatarType: (avatarType) => set({ avatarType }),
      setAvatarId: (avatarId) => set({ avatarId }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "chat-store", // name of the item in the storage (must be unique)
      partialize: (state) => ({
        avatarId: state.avatarId,
        avatarType: state.avatarType,
        theme: state.theme,
      }),
    }
  )
);
