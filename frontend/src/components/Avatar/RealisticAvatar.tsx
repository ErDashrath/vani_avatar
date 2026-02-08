/**
 * RealisticAvatar – Canvas-based photorealistic human face with lip-sync.
 */

import { useRef } from "react";
import { useAvatarAnimation } from "../../hooks/useAvatarAnimation";
import { AVATAR } from "../../utils/constants";

interface Props {
  isSpeaking: boolean;
}

export function RealisticAvatar({ isSpeaking }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useAvatarAnimation({ canvasRef, isSpeaking });

  return (
    <canvas
      ref={canvasRef}
      width={AVATAR.SIZE}
      height={AVATAR.SIZE}
      className="relative z-10 rounded-2xl shadow-2xl"
      style={{
        width: AVATAR.DISPLAY_SIZE,
        height: AVATAR.DISPLAY_SIZE,
        borderRadius: "1rem",
        imageRendering: "auto",
      }}
    />
  );
}
