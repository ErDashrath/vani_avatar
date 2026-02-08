/**
 * Cartoon3DAvatar – Three.js 3D cartoon character with lip-sync.
 */

import { useRef } from "react";
import { useCartoon3DAvatar } from "../../hooks/useCartoon3DAvatar";
import { AVATAR } from "../../utils/constants";

interface Props {
  isSpeaking: boolean;
}

export function Cartoon3DAvatar({ isSpeaking }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useCartoon3DAvatar({ containerRef, isSpeaking });

  return (
    <div
      ref={containerRef}
      className="relative z-10 overflow-hidden rounded-2xl shadow-2xl"
      style={{
        width: AVATAR.DISPLAY_SIZE,
        height: AVATAR.DISPLAY_SIZE,
        borderRadius: "1rem",
      }}
    />
  );
}
