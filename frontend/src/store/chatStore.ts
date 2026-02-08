/**
 * Global chat store – Zustand.
 *
 * skills.sh applied:
 *  • rerender-derived-state → status derived from booleans, not raw object
 *  • rerender-defer-reads   → components subscribe only to slices they render
 */

import { create } from "zustand";
import type { AppStatus, AvatarType, ConversationEntry } from "../types";
import { uid } from "../utils/constants";

interface ChatState {
  status: AppStatus;
  messages: ConversationEntry[];
  interimText: string;
  avatarType: AvatarType;

  setStatus: (s: AppStatus) => void;
  setInterimText: (t: string) => void;
  addMessage: (role: "user" | "assistant", content: string) => void;
  clearMessages: () => void;
  setAvatarType: (t: AvatarType) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  status: "ready",
  messages: [],
  interimText: "",
  avatarType: "gif",

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
}));
