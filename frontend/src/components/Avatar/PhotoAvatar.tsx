/**
 * PhotoAvatar – Photorealistic face with animated mouth overlay.
 * Uses a cached base image with real-time mouth/eye animation.
 */

import { useRef } from "react";
import { usePhotoAvatar } from "../../hooks/usePhotoAvatar";
import { AVATAR } from "../../utils/constants";

interface Props {
  isSpeaking: boolean;
}

export function PhotoAvatar({ isSpeaking }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  usePhotoAvatar({ canvasRef, isSpeaking });

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
