/**
 * useGifAvatar – Animated GIF that plays during TTS speech.
 *
 * Controls GIF playback synchronized with speech:
 *  • GIF plays only when isSpeaking is true
 *  • Automatically loops if speech is longer than GIF duration
 *  • Pauses/stops when speech ends
 *  • Proper size scaling to fit canvas
 */

import { useCallback, useEffect, useRef } from "react";
import { AVATAR } from "../utils/constants";

interface UseGifAvatarOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isSpeaking: boolean;
}

// Path to your talking GIF in public/assets folder
const DEFAULT_GIF_URL = "/assets/Realistic_Russian_Woman_Passport_Photo-ezgif.com-video-to-gif-converter.gif";

// Estimated GIF duration in milliseconds (adjust based on your actual GIF)
// This GIF is about 5 seconds long based on the video conversion
const GIF_DURATION_MS = 5000; // 5 seconds

export function useGifAvatar({ canvasRef, isSpeaking }: UseGifAvatarOptions) {
  const rafRef = useRef(0);
  const imgElementRef = useRef<HTMLImageElement | null>(null);
  const imageLoadedRef = useRef(false);
  
  // Timing refs for GIF loop control
  const speechStartTimeRef = useRef(0);
  const gifLoopCountRef = useRef(0);
  const lastGifRestartRef = useRef(0);

  // Load the GIF/image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      console.log("✅ GIF Avatar loaded:", DEFAULT_GIF_URL);
      imageLoadedRef.current = true;
      imgElementRef.current = img;
    };

    img.onerror = (err) => {
      console.error("❌ Failed to load GIF avatar:", err);
      imageLoadedRef.current = false;
    };

    img.src = DEFAULT_GIF_URL;

    return () => {
      imageLoadedRef.current = false;
      imgElementRef.current = null;
    };
  }, []);

  // Handle GIF restart when speech starts and looping during speech
  useEffect(() => {
    const isGif = DEFAULT_GIF_URL.toLowerCase().endsWith('.gif');
    
    if (isSpeaking) {
      // Speech just started - restart GIF
      speechStartTimeRef.current = performance.now();
      gifLoopCountRef.current = 0;
      
      if (isGif && imgElementRef.current) {
        // Force GIF restart by adding timestamp query parameter
        const baseUrl = DEFAULT_GIF_URL.split('?')[0];
        imgElementRef.current.src = `${baseUrl}?t=${Date.now()}`;
        lastGifRestartRef.current = performance.now();
        console.log('[GifAvatar] 🎬 GIF started for speech');
      }
    } else {
      // Speech stopped
      if (gifLoopCountRef.current > 0) {
        console.log(`[GifAvatar] 🛑 Speech stopped. GIF looped ${gifLoopCountRef.current} times`);
      } else {
        console.log('[GifAvatar] 🛑 Speech stopped');
      }
      gifLoopCountRef.current = 0;
    }
  }, [isSpeaking]);

  // Drawing and GIF loop management
  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const S = AVATAR.SIZE;
      const cx = S / 2;
      const cy = S / 2;

      ctx.clearRect(0, 0, S, S);

      // Draw background
      const bg = ctx.createLinearGradient(0, 0, 0, S);
      bg.addColorStop(0, "#1a1a2e");
      bg.addColorStop(1, "#0f1419");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);

      // Draw the GIF/image
      if (imgElementRef.current && imageLoadedRef.current) {
        const img = imgElementRef.current;
        
        // Calculate scaling to cover the canvas (like background-size: cover)
        const imgAspect = img.width / img.height;
        const canvasAspect = 1; // Square canvas
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imgAspect > canvasAspect) {
          // Image is wider - fit to height and crop sides
          drawHeight = S;
          drawWidth = S * imgAspect;
          offsetX = (S - drawWidth) / 2;
          offsetY = 0;
        } else {
          // Image is taller - fit to width and crop top/bottom
          drawWidth = S;
          drawHeight = S / imgAspect;
          offsetX = 0;
          offsetY = (S - drawHeight) / 2;
        }
        
        // Draw the image/GIF centered and scaled
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        // Check if we need to loop the GIF during speech
        const isGif = DEFAULT_GIF_URL.toLowerCase().endsWith('.gif');
        if (isSpeaking && isGif && lastGifRestartRef.current > 0) {
          const timeSinceLastRestart = performance.now() - lastGifRestartRef.current;
          
          // If GIF duration has passed, restart it
          if (timeSinceLastRestart > GIF_DURATION_MS) {
            gifLoopCountRef.current++;
            const baseUrl = DEFAULT_GIF_URL.split('?')[0];
            img.src = `${baseUrl}?t=${Date.now()}`;
            lastGifRestartRef.current = performance.now();
            console.log(`[GifAvatar] 🔄 GIF looped #${gifLoopCountRef.current}`);
          }
        }
      } else {
        // Placeholder while loading
        ctx.fillStyle = "#2A3A4A";
        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Loading GIF...", cx, cy);
        
        ctx.fillStyle = "#4A90A4";
        ctx.font = "12px sans-serif";
        ctx.fillText("Please wait", cx, cy + 25);
      }

      // Speaking indicator ring
      if (isSpeaking && imageLoadedRef.current) {
        ctx.save();
        ctx.strokeStyle = "rgba(6,182,212,0.5)";
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(6,182,212,0.8)";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(cx, cy, S * 0.48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    },
    [isSpeaking]
  );

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = AVATAR.SIZE;
    canvas.height = AVATAR.SIZE;

    let running = true;

    const loop = () => {
      if (!running) return;
      drawFrame(ctx);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [canvasRef, drawFrame]);
}
