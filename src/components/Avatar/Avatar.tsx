/**
 * Avatar – Minimal circular avatar container.
 * Keeps a clean static frame without glow or pulse effects.
 */

import { memo } from "react";
import { AVATAR } from "../../utils/constants";
import { useChatStore } from "../../store/chatStore";
import { RealisticAvatar } from "./RealisticAvatar";
import { PhotoAvatar } from "./PhotoAvatar";
import { GifAvatar } from "./GifAvatar";
import { StaticAvatar } from "./StaticAvatar";

interface AvatarProps {
  isSpeaking: boolean;
  isThinking: boolean;
}

export const Avatar = memo(function Avatar({ isSpeaking, isThinking: _isThinking }: AvatarProps) {
  const avatarType = useChatStore((s) => s.avatarType);

  return (
    <figure
      className="relative flex items-center justify-center"
      role="img"
      aria-label={`Voice avatar – ${avatarType} mode`}
    >
      <div
        className="relative overflow-hidden rounded-full border border-white/15 bg-white/[0.02]"
        style={{
          width: AVATAR.DISPLAY_SIZE,
          height: AVATAR.DISPLAY_SIZE,
        }}
      >
        {/* Avatar renderer */}
        {avatarType === "realistic" && <RealisticAvatar isSpeaking={isSpeaking} />}
        {avatarType === "photo" && <PhotoAvatar isSpeaking={isSpeaking} />}
        {avatarType === "gif" && <GifAvatar isSpeaking={isSpeaking} />}
        {avatarType === "image" && <StaticAvatar isSpeaking={isSpeaking} />}
      </div>
    </figure>
  );
});
