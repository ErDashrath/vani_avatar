/**
 * GifAvatar – Animated GIF that plays during speech.
 * 
 * Shows first frame of GIF when idle (canvas).
 * Plays animated GIF when speaking (img element).
 */

import { useRef, useEffect, useState } from "react";
import { AVATAR, DEFAULT_HUMAN_AVATAR_ID, HUMAN_GIF_AVATARS } from "../../utils/constants";
import { useChatStore } from "../../store/chatStore";

interface GifAvatarProps {
  isSpeaking: boolean;
}

export function GifAvatar({ isSpeaking }: GifAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [idleFrameReady, setIdleFrameReady] = useState(false);
  const [animatedReady, setAnimatedReady] = useState(false);
  const [shouldLoadAnimated, setShouldLoadAnimated] = useState(false);

  const avatarId = useChatStore((s) => s.avatarId);

  const getGifUrl = () =>
    HUMAN_GIF_AVATARS[avatarId as keyof typeof HUMAN_GIF_AVATARS]
    ?? HUMAN_GIF_AVATARS[DEFAULT_HUMAN_AVATAR_ID];

  const gifUrl = getGifUrl();
  const showAnimated = isSpeaking && animatedReady;
  const showIdleFrame = idleFrameReady && (!isSpeaking || !animatedReady);
  const showPlaceholder = !showIdleFrame && !showAnimated;

  // Load first frame of GIF to canvas for idle state
  useEffect(() => {
    setIdleFrameReady(false);
    setAnimatedReady(false);
    setShouldLoadAnimated(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      try {
        canvas.width = AVATAR.SIZE;
        canvas.height = AVATAR.SIZE;

        // Calculate scaling to cover canvas
        const imgAspect = img.width / img.height;
        const canvasAspect = 1;

        let drawWidth, drawHeight, offsetX, offsetY;
        if (imgAspect > canvasAspect) {
          drawHeight = AVATAR.SIZE;
          drawWidth = AVATAR.SIZE * imgAspect;
          offsetX = (AVATAR.SIZE - drawWidth) / 2;
          offsetY = 0;
        } else {
          drawWidth = AVATAR.SIZE;
          drawHeight = AVATAR.SIZE / imgAspect;
          offsetX = 0;
          offsetY = (AVATAR.SIZE - drawHeight) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        setIdleFrameReady(true);
      } catch {
        // Mobile canvas/GIF decode can fail for large files. Use img fallback.
        setIdleFrameReady(false);
      }
    };
    img.onerror = () => {
      setIdleFrameReady(false);
    };
    img.src = gifUrl;
  }, [gifUrl]);

  // Load heavy animated GIF only once needed (first speaking event).
  useEffect(() => {
    if (isSpeaking) setShouldLoadAnimated(true);
  }, [isSpeaking]);

  return (
    <div
      className="rounded-full overflow-hidden bg-surface-200 dark:bg-surface-900 relative flex items-center justify-center"
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      {/* Static first frame when idle */}
      <canvas
        ref={canvasRef}
        width={AVATAR.SIZE}
        height={AVATAR.SIZE}
        style={{
          width: "100%",
          height: "100%",
          display: showIdleFrame ? "block" : "none",
        }}
      />

      {/* Stable placeholder while idle frame is preparing */}
      {showPlaceholder && (
        <div
          className="absolute inset-0 bg-surface-200 dark:bg-surface-900"
          aria-hidden="true"
        />
      )}

      {/* Animated GIF when speaking */}
      {shouldLoadAnimated && (
        <img
          src={gifUrl}
          alt="Animated Avatar"
          loading="auto"
          decoding="async"
          draggable={false}
          onLoad={() => setAnimatedReady(true)}
          onError={() => setAnimatedReady(false)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: showAnimated ? "block" : "none",
          }}
        />
      )}
    </div>
  );
}
