/**
 * GifAvatar – Animated GIF that plays during speech.
 * 
 * Shows first frame of GIF when idle (canvas).
 * Plays animated GIF when speaking (img element).
 */

import { useRef, useEffect, useState } from "react";
import { AVATAR } from "../../utils/constants";

interface GifAvatarProps {
  isSpeaking: boolean;
}

const GIF_URL = "/assets/avatar.gif";
const GIF_DURATION_MS = 5000; // 5 seconds

export function GifAvatar({ isSpeaking }: GifAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const gifLoopCountRef = useRef(0);
  const loopIntervalRef = useRef<number | null>(null);
  const [showAnimated, setShowAnimated] = useState(false);

  // Load first frame of GIF to canvas for idle state
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
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
    };
    img.src = GIF_URL;
  }, []);

  // Handle GIF animation when speaking
  useEffect(() => {
    if (isSpeaking) {
      // Speech started - show animated GIF
      gifLoopCountRef.current = 0;
      setShowAnimated(true);
      
      if (imgRef.current) {
        imgRef.current.src = `${GIF_URL}?t=${Date.now()}`;
      }
      console.log('[GifAvatar] 🎬 GIF started for speech');

      // Set up loop interval to restart GIF if speech continues
      loopIntervalRef.current = window.setInterval(() => {
        if (imgRef.current) {
          gifLoopCountRef.current++;
          imgRef.current.src = `${GIF_URL}?t=${Date.now()}`;
          console.log(`[GifAvatar] 🔄 GIF looped #${gifLoopCountRef.current}`);
        }
      }, GIF_DURATION_MS);

    } else {
      // Speech stopped - show static canvas
      if (loopIntervalRef.current) {
        clearInterval(loopIntervalRef.current);
        loopIntervalRef.current = null;
      }
      
      setShowAnimated(false);
      
      if (gifLoopCountRef.current > 0) {
        console.log(`[GifAvatar] 🛑 Speech stopped. GIF looped ${gifLoopCountRef.current} times`);
      }
      gifLoopCountRef.current = 0;
    }

    return () => {
      if (loopIntervalRef.current) {
        clearInterval(loopIntervalRef.current);
      }
    };
  }, [isSpeaking]);

  return (
    <div
      style={{
        width: `${AVATAR.DISPLAY_SIZE}px`,
        height: `${AVATAR.DISPLAY_SIZE}px`,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        overflow: "hidden",
        background: "linear-gradient(135deg, #1a1a2e 0%, #0f1419 100%)",
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
          display: showAnimated ? "none" : "block",
        }}
      />
      
      {/* Animated GIF when speaking */}
      <img
        ref={imgRef}
        src={GIF_URL}
        alt="Animated Avatar"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: showAnimated ? "block" : "none",
        }}
      />
      
      {/* Speaking indicator ring */}
      {isSpeaking && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: "50%",
            border: "4px solid rgba(6,182,212,0.5)",
            boxShadow: "0 0 20px rgba(6,182,212,0.8)",
            pointerEvents: "none",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
      )}
      
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
          }
        }
      `}</style>
    </div>
  );
}
