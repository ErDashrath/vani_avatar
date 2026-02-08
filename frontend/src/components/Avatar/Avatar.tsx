/**
 * Avatar component – switches between four avatar rendering modes:
 *  1. "realistic" – Canvas 2D photorealistic human face
 *  2. "cartoon3d" – Three.js 3D cartoon character
 *  3. "photo"     – Photorealistic cached face with animated overlay
 *  4. "gif"       – Real photo/GIF with animated talking overlay
 *
 * Accessibility:
 *  • Semantic <figure> with role="img" and aria-label
 *  • prefers-reduced-motion handled inside each hook
 */

import { AVATAR } from "../../utils/constants";
import { useChatStore } from "../../store/chatStore";
import { StatusIndicator } from "../UI/StatusIndicator";
import { RealisticAvatar } from "./RealisticAvatar";
import { Cartoon3DAvatar } from "./Cartoon3DAvatar";
import { PhotoAvatar } from "./PhotoAvatar";
import { GifAvatar } from "./GifAvatar";

interface AvatarProps {
  isSpeaking: boolean;
}

export function Avatar({ isSpeaking }: AvatarProps) {
  const avatarType = useChatStore((s) => s.avatarType);

  return (
    <figure
      className="relative mx-auto mb-8 flex flex-col items-center"
      role="img"
      aria-label={`Animated voice avatar – ${avatarType} mode`}
    >
      {/* Ambient glow ring when speaking */}
      <div
        className={`
          absolute rounded-full transition-all duration-700
          ${isSpeaking ? "opacity-100 scale-105" : "opacity-0 scale-100"}
        `}
        style={{
          width: AVATAR.DISPLAY_SIZE + 24,
          height: AVATAR.DISPLAY_SIZE + 24,
          top: -12,
          left: "50%",
          transform: `translateX(-50%) ${isSpeaking ? "scale(1.05)" : "scale(1)"}`,
          background:
            "radial-gradient(circle, rgba(6,182,212,0.12) 0%, rgba(6,182,212,0.04) 50%, transparent 70%)",
          filter: "blur(4px)",
        }}
      />

      {/* Soft shadow beneath avatar */}
      <div
        className="absolute"
        style={{
          width: AVATAR.DISPLAY_SIZE * 0.7,
          height: 12,
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.3) 0%, transparent 70%)",
          filter: "blur(6px)",
        }}
      />

      {/* Avatar renderer based on selected type */}
      {avatarType === "realistic" && <RealisticAvatar isSpeaking={isSpeaking} />}
      {avatarType === "cartoon3d" && <Cartoon3DAvatar isSpeaking={isSpeaking} />}
      {avatarType === "photo" && <PhotoAvatar isSpeaking={isSpeaking} />}
      {avatarType === "gif" && <GifAvatar isSpeaking={isSpeaking} />}

      <StatusIndicator />
    </figure>
  );
}
