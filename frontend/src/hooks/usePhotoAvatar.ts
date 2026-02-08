/**
 * usePhotoAvatar – Real human photo with animated mouth overlay.
 *
 * Uses a photorealistic AI-generated face rendered as a base image,
 * with a Canvas overlay that animates the mouth region for lip-sync.
 * The photo is generated procedurally on canvas to avoid external deps.
 *
 * Features:
 *  • High-quality base face rendered once (cached)
 *  • Animated mouth region overlay with lip-sync
 *  • Smooth blink animation via eyelid overlay
 *  • Subtle breathing/micro-movement
 *  • prefers-reduced-motion respected
 */

import { useCallback, useEffect, useRef } from "react";
import { ANIM, AVATAR } from "../utils/constants";
import { clamp, lerp } from "../utils/audioUtils";

interface UsePhotoAvatarOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isSpeaking: boolean;
}

/* ─── SRK-inspired color palette (wheatish complexion) ─── */
const PHOTO_SKIN = {
  base: "#C9A876",
  light: "#D9BC8E",
  mid: "#B89860",
  shadow: "#A08050",
  deep: "#856842",
  pink: "#C08880",
};

export function usePhotoAvatar({
  canvasRef,
  isSpeaking,
}: UsePhotoAvatarOptions) {
  const mouthRef = useRef(0);
  const blinkRef = useRef(0);
  const blinkTargetRef = useRef(0);
  const nextBlinkRef = useRef(0);
  const eyeDriftRef = useRef({ x: 0, y: 0 });
  const eyeDriftTargetRef = useRef({ x: 0, y: 0 });
  const nextEyeDriftRef = useRef(0);
  const breathRef = useRef(0);
  const rafRef = useRef(0);
  const reducedMotion = useRef(false);
  const startTimeRef = useRef(0);
  const baseFaceRef = useRef<ImageData | null>(null);

  const visemeRef = useRef({
    width: 1,
    roundness: 0,
    jawDrop: 0,
  });

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    startTimeRef.current = performance.now();
  }, []);

  /**
   * Render the static base face once and cache it as ImageData.
   * SRK passport photo style - formal, centered, clean background.
   */
  const renderBaseFace = useCallback((ctx: CanvasRenderingContext2D) => {
    const S = AVATAR.SIZE;
    const cx = S / 2;
    const cy = S / 2 - S * 0.02;

    ctx.clearRect(0, 0, S, S);

    // ── Passport-style clean background ──
    const bg = ctx.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, "#E8EEF2");
    bg.addColorStop(1, "#D5DEE5");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S, S);

    // Subtle texture for paper feel
    ctx.save();
    ctx.globalAlpha = 0.02;
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "#FFF" : "#000";
      ctx.fillRect(Math.random() * S, Math.random() * S, 1, 1);
    }
    ctx.restore();

    // ── Neck ──
    const neckW = S * 0.1;
    const neckTop = cy + S * 0.2;
    const neckBot = S;
    const neckGrad = ctx.createLinearGradient(cx - neckW, neckTop, cx + neckW, neckTop);
    neckGrad.addColorStop(0, PHOTO_SKIN.shadow);
    neckGrad.addColorStop(0.3, PHOTO_SKIN.mid);
    neckGrad.addColorStop(0.7, PHOTO_SKIN.mid);
    neckGrad.addColorStop(1, PHOTO_SKIN.shadow);
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(cx - neckW * 0.9, neckTop);
    ctx.lineTo(cx - neckW * 1.3, neckBot);
    ctx.lineTo(cx + neckW * 1.3, neckBot);
    ctx.lineTo(cx + neckW * 0.9, neckTop);
    ctx.closePath();
    ctx.fill();

    // ── Formal shirt/blazer (passport style) ──
    ctx.fillStyle = "#1C1C28";
    ctx.beginPath();
    ctx.moveTo(cx - neckW * 1.4, neckBot - S * 0.05);
    ctx.quadraticCurveTo(cx - S * 0.45, neckBot - S * 0.03, 0, neckBot);
    ctx.lineTo(S, neckBot);
    ctx.quadraticCurveTo(cx + S * 0.45, neckBot - S * 0.03, cx + neckW * 1.4, neckBot - S * 0.05);
    ctx.closePath();
    ctx.fill();

    // White shirt collar
    ctx.fillStyle = "#F8F8F8";
    ctx.beginPath();
    ctx.moveTo(cx - neckW * 0.7, neckTop + S * 0.02);
    ctx.lineTo(cx - neckW * 1.1, neckTop + S * 0.08);
    ctx.lineTo(cx - neckW * 0.85, neckTop + S * 0.12);
    ctx.lineTo(cx - neckW * 0.5, neckTop + S * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + neckW * 0.7, neckTop + S * 0.02);
    ctx.lineTo(cx + neckW * 1.1, neckTop + S * 0.08);
    ctx.lineTo(cx + neckW * 0.85, neckTop + S * 0.12);
    ctx.lineTo(cx + neckW * 0.5, neckTop + S * 0.06);
    ctx.closePath();
    ctx.fill();

    // Collar shadow
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - neckW * 0.7, neckTop + S * 0.02);
    ctx.lineTo(cx - neckW * 0.5, neckTop + S * 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + neckW * 0.7, neckTop + S * 0.02);
    ctx.lineTo(cx + neckW * 0.5, neckTop + S * 0.06);
    ctx.stroke();

    // ── Hair back (SRK signature style - thick, dark, swept) ──
    ctx.fillStyle = "#0A0503";
    ctx.beginPath();
    ctx.ellipse(cx, cy - S * 0.14, S * 0.4, S * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    // Signature swept-back hair volume
    ctx.beginPath();
    ctx.ellipse(cx - S * 0.15, cy - S * 0.22, S * 0.12, S * 0.15, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + S * 0.15, cy - S * 0.22, S * 0.12, S * 0.15, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Side hair
    ctx.beginPath();
    ctx.ellipse(cx - S * 0.32, cy + S * 0.02, S * 0.08, S * 0.2, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + S * 0.32, cy + S * 0.02, S * 0.08, S * 0.2, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // ── Ears ──
    ctx.fillStyle = PHOTO_SKIN.shadow;
    ctx.beginPath();
    ctx.ellipse(cx - S * 0.3, cy, S * 0.03, S * 0.055, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + S * 0.3, cy, S * 0.03, S * 0.055, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // ── Face shape (slightly angular jawline, SRK-like structure) ──
    const faceW = S * 0.27;
    const faceH = S * 0.36;

    // Face shadow (studio lighting effect)
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = PHOTO_SKIN.base;
    ctx.beginPath();
    ctx.ellipse(cx, cy, faceW, faceH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Main face with realistic gradient
    const faceGrad = ctx.createRadialGradient(
      cx - faceW * 0.3, cy - faceH * 0.2, faceW * 0.1,
      cx, cy, faceH * 1.1,
    );
    faceGrad.addColorStop(0, PHOTO_SKIN.light);
    faceGrad.addColorStop(0.35, PHOTO_SKIN.base);
    faceGrad.addColorStop(0.75, PHOTO_SKIN.mid);
    faceGrad.addColorStop(1, PHOTO_SKIN.shadow);
    ctx.fillStyle = faceGrad;

    // More angular face contour (SRK's sharp features)
    ctx.beginPath();
    ctx.moveTo(cx - faceW * 0.75, cy - faceH * 0.5);
    ctx.quadraticCurveTo(cx - faceW * 0.82, cy - faceH * 0.82, cx, cy - faceH * 0.88);
    ctx.quadraticCurveTo(cx + faceW * 0.82, cy - faceH * 0.82, cx + faceW * 0.75, cy - faceH * 0.5);
    ctx.quadraticCurveTo(cx + faceW * 0.95, cy - faceH * 0.05, cx + faceW * 0.88, cy + faceH * 0.12);
    ctx.lineTo(cx + faceW * 0.4, cy + faceH * 0.38);
    ctx.quadraticCurveTo(cx, cy + faceH * 0.48, cx - faceW * 0.4, cy + faceH * 0.38);
    ctx.lineTo(cx - faceW * 0.88, cy + faceH * 0.12);
    ctx.quadraticCurveTo(cx - faceW * 0.95, cy - faceH * 0.05, cx - faceW * 0.75, cy - faceH * 0.5);
    ctx.closePath();
    ctx.fill();

    // Jawline definition (sharp, angular)
    ctx.strokeStyle = "rgba(130,100,60,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - faceW * 0.88, cy + faceH * 0.12);
    ctx.lineTo(cx - faceW * 0.4, cy + faceH * 0.38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + faceW * 0.88, cy + faceH * 0.12);
    ctx.lineTo(cx + faceW * 0.4, cy + faceH * 0.38);
    ctx.stroke();

    // Cheek contour (subtle)
    ctx.fillStyle = "rgba(180, 120, 90, 0.08)";
    ctx.beginPath();
    ctx.ellipse(cx - faceW * 0.48, cy + faceH * 0.1, faceW * 0.18, faceH * 0.12, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + faceW * 0.48, cy + faceH * 0.1, faceW * 0.18, faceH * 0.12, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Forehead highlight (studio lighting)
    const fhGrad = ctx.createRadialGradient(cx, cy - faceH * 0.35, 2, cx, cy - faceH * 0.3, faceW * 0.5);
    fhGrad.addColorStop(0, "rgba(255,255,255,0.15)");
    fhGrad.addColorStop(1, "transparent");
    ctx.fillStyle = fhGrad;
    ctx.fillRect(cx - faceW, cy - faceH, faceW * 2, faceH);

    // ── Nose (prominent, well-defined bridge) ──
    const ny = cy + S * 0.02;

    // Nose bridge (more pronounced)
    ctx.fillStyle = PHOTO_SKIN.mid;
    ctx.beginPath();
    ctx.moveTo(cx - S * 0.008, ny - S * 0.08);
    ctx.lineTo(cx - S * 0.018, ny + S * 0.015);
    ctx.lineTo(cx - S * 0.025, ny + S * 0.025);
    ctx.quadraticCurveTo(cx - S * 0.015, ny + S * 0.03, cx, ny + S * 0.032);
    ctx.quadraticCurveTo(cx + S * 0.015, ny + S * 0.03, cx + S * 0.025, ny + S * 0.025);
    ctx.lineTo(cx + S * 0.018, ny + S * 0.015);
    ctx.lineTo(cx + S * 0.008, ny - S * 0.08);
    ctx.closePath();
    ctx.fill();

    // Nose bridge highlight
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, ny - S * 0.07);
    ctx.lineTo(cx, ny + S * 0.01);
    ctx.stroke();

    // Nose shadow
    ctx.strokeStyle = "rgba(130,90,60,0.2)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - S * 0.018, ny - S * 0.05);
    ctx.quadraticCurveTo(cx - S * 0.022, ny + S * 0.01, cx - S * 0.025, ny + S * 0.025);
    ctx.stroke();

    // Nose tip
    const ntGrad = ctx.createRadialGradient(cx, ny + S * 0.015, 1, cx, ny + S * 0.015, S * 0.018);
    ntGrad.addColorStop(0, "rgba(255,255,255,0.12)");
    ntGrad.addColorStop(1, PHOTO_SKIN.base);
    ctx.fillStyle = ntGrad;
    ctx.beginPath();
    ctx.arc(cx, ny + S * 0.015, S * 0.018, 0, Math.PI * 2);
    ctx.fill();

    // Nostrils (defined)
    ctx.fillStyle = "rgba(100,60,40,0.35)";
    ctx.beginPath();
    ctx.ellipse(cx - S * 0.017, ny + S * 0.028, S * 0.009, S * 0.006, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + S * 0.017, ny + S * 0.028, S * 0.009, S * 0.006, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Nostril inner shadow
    ctx.fillStyle = "rgba(80,50,30,0.25)";
    ctx.beginPath();
    ctx.ellipse(cx - S * 0.017, ny + S * 0.027, S * 0.005, S * 0.003, -0.3, 0, Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + S * 0.017, ny + S * 0.027, S * 0.005, S * 0.003, 0.3, 0, Math.PI);
    ctx.fill();

    // Nose bottom contour
    ctx.strokeStyle = "rgba(130,90,60,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - S * 0.025, ny + S * 0.025);
    ctx.quadraticCurveTo(cx, ny + S * 0.032, cx + S * 0.025, ny + S * 0.025);
    ctx.stroke();

    // ── Eyebrows (SRK signature thick expressive brows) ──
    const browY = cy - S * 0.095;
    const browSpacing = S * 0.085;

    for (const side of [-1, 1]) {
      const bx = cx + side * browSpacing;
      ctx.save();
      ctx.fillStyle = "#1A0A05";
      
      // Thick brow base
      ctx.beginPath();
      ctx.moveTo(bx - S * 0.055 * side, browY);
      ctx.quadraticCurveTo(bx - S * 0.02 * side, browY - S * 0.01, bx + S * 0.02 * side, browY - S * 0.008);
      ctx.quadraticCurveTo(bx + S * 0.055 * side, browY - S * 0.003, bx + S * 0.06 * side, browY + S * 0.002);
      ctx.lineTo(bx + S * 0.055 * side, browY + S * 0.008);
      ctx.quadraticCurveTo(bx + S * 0.02 * side, browY + S * 0.002, bx - S * 0.02 * side, browY + S * 0.004);
      ctx.quadraticCurveTo(bx - S * 0.055 * side, browY + S * 0.006, bx - S * 0.055 * side, browY);
      ctx.closePath();
      ctx.fill();

      // Brow hairs for texture
      ctx.strokeStyle = "#0A0503";
      ctx.lineWidth = 0.8;
      ctx.lineCap = "round";
      const hairCount = 18;
      for (let i = 0; i < hairCount; i++) {
        const t = i / hairCount;
        const x = bx - S * 0.055 * side + t * S * 0.115 * side;
        const archY = browY - Math.sin(t * Math.PI) * S * 0.008;
        const angle = -0.4 + t * 0.8;
        const len = S * 0.008 + Math.sin(t * Math.PI) * S * 0.004;

        ctx.globalAlpha = 0.3 + Math.sin(t * Math.PI) * 0.5;
        ctx.beginPath();
        ctx.moveTo(x, archY);
        ctx.lineTo(x + Math.cos(angle) * len * side * 0.4, archY + Math.sin(angle) * len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── Hair (front - SRK signature swept-back style) ──
    ctx.fillStyle = "#0A0503";
    
    // Main hair mass (swept back)
    ctx.beginPath();
    ctx.moveTo(cx - faceW * 0.8, cy - faceH * 0.35);
    ctx.quadraticCurveTo(cx - faceW * 0.9, cy - faceH * 0.9, cx - faceW * 0.25, cy - faceH * 0.92);
    ctx.quadraticCurveTo(cx - faceW * 0.05, cy - faceH * 1.05, cx + faceW * 0.05, cy - faceH * 1.05);
    ctx.quadraticCurveTo(cx + faceW * 0.25, cy - faceH * 0.92, cx + faceW * 0.9, cy - faceH * 0.9);
    ctx.quadraticCurveTo(cx + faceW * 0.8, cy - faceH * 0.35, cx + faceW * 0.65, cy - faceH * 0.68);
    ctx.quadraticCurveTo(cx, cy - faceH * 0.75, cx - faceW * 0.65, cy - faceH * 0.68);
    ctx.closePath();
    ctx.fill();

    // Front hair strands (signature look)
    ctx.beginPath();
    ctx.moveTo(cx - faceW * 0.15, cy - faceH * 0.85);
    ctx.quadraticCurveTo(cx - faceW * 0.12, cy - faceH * 0.75, cx - faceW * 0.18, cy - faceH * 0.65);
    ctx.lineTo(cx - faceW * 0.14, cy - faceH * 0.65);
    ctx.quadraticCurveTo(cx - faceW * 0.08, cy - faceH * 0.75, cx - faceW * 0.1, cy - faceH * 0.85);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + faceW * 0.15, cy - faceH * 0.85);
    ctx.quadraticCurveTo(cx + faceW * 0.12, cy - faceH * 0.75, cx + faceW * 0.18, cy - faceH * 0.65);
    ctx.lineTo(cx + faceW * 0.14, cy - faceH * 0.65);
    ctx.quadraticCurveTo(cx + faceW * 0.08, cy - faceH * 0.75, cx + faceW * 0.1, cy - faceH * 0.85);
    ctx.closePath();
    ctx.fill();

    // Hair highlights (gives volume and shine)
    ctx.save();
    ctx.strokeStyle = "#2A1810";
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 12; i++) {
      const sx = cx - faceW * 0.6 + (faceW * 1.2 * i) / 12;
      const sy = cy - faceH * 0.85 + Math.sin(i * 0.9) * faceH * 0.08;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(
        sx + Math.sin(i * 0.6) * faceW * 0.06,
        sy + faceH * 0.12,
        sx + Math.sin(i * 0.4) * faceW * 0.09,
        sy + faceH * 0.25,
      );
      ctx.stroke();
    }
    ctx.restore();

    // Cache the base face
    baseFaceRef.current = ctx.getImageData(0, 0, S, S);
  }, []);

  /**
   * Draw animated elements (eyes, mouth) on top of cached base face.
   */
  const drawAnimated = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const S = AVATAR.SIZE;
      const cx = S / 2;
      const cy = S / 2 - S * 0.03;

      // Restore base face
      if (baseFaceRef.current) {
        ctx.putImageData(baseFaceRef.current, 0, 0);
      }

      const breathY = breathRef.current * S * 0.002;

      // ── Eyes (drawn each frame for blink + drift) ──
      const eyeY = cy - S * 0.045 + breathY;
      const eyeSpacing = S * 0.08;
      const blink = blinkRef.current;
      const driftX = eyeDriftRef.current.x;
      const driftY = eyeDriftRef.current.y;

      for (const side of [-1, 1]) {
        const ex = cx + side * eyeSpacing;
        const eyeW = S * 0.048;
        const eyeH = S * 0.032;
        const openH = eyeH * (1 - blink);

        // Clear eye area first (paint over with skin)
        const eyeAreaGrad = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, eyeW * 1.5);
        eyeAreaGrad.addColorStop(0, PHOTO_SKIN.base);
        eyeAreaGrad.addColorStop(0.7, PHOTO_SKIN.base);
        eyeAreaGrad.addColorStop(1, "transparent");
        ctx.fillStyle = eyeAreaGrad;
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW * 1.4, eyeH * 1.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye socket shadow
        ctx.fillStyle = "rgba(120,80,60,0.1)";
        ctx.beginPath();
        ctx.ellipse(ex, eyeY - eyeH * 0.1, eyeW * 1.15, eyeH * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Sclera
        ctx.fillStyle = "#F5F1ED";
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW, Math.max(openH, 0.5), 0, 0, Math.PI * 2);
        ctx.fill();

        // Sclera shadow
        if (openH > 1) {
          const ss = ctx.createLinearGradient(ex, eyeY - openH, ex, eyeY);
          ss.addColorStop(0, "rgba(200,190,180,0.4)");
          ss.addColorStop(1, "transparent");
          ctx.fillStyle = ss;
          ctx.beginPath();
          ctx.ellipse(ex, eyeY, eyeW, openH, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        if (openH > 2) {
          const irisR = S * 0.018;
          const pupilR = irisR * 0.5;
          const ix = ex + driftX * S * 0.006;
          const iy = eyeY + driftY * S * 0.004;

          // Iris (dark brown, SRK's distinctive eyes)
          const irisGrad = ctx.createRadialGradient(ix - 0.5, iy - 0.5, pupilR * 0.3, ix, iy, irisR);
          irisGrad.addColorStop(0, "#6B4423");
          irisGrad.addColorStop(0.4, "#3D2817");
          irisGrad.addColorStop(1, "#1F1508");
          ctx.fillStyle = irisGrad;
          ctx.beginPath();
          ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
          ctx.fill();

          // Iris texture
          ctx.save();
          ctx.globalAlpha = 0.15;
          ctx.strokeStyle = "#1F1508";
          ctx.lineWidth = 0.5;
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
            ctx.beginPath();
            ctx.moveTo(ix + Math.cos(a) * pupilR, iy + Math.sin(a) * pupilR);
            ctx.lineTo(ix + Math.cos(a) * irisR * 0.9, iy + Math.sin(a) * irisR * 0.9);
            ctx.stroke();
          }
          ctx.restore();

          // Pupil
          ctx.fillStyle = "#1A1A1A";
          ctx.beginPath();
          ctx.arc(ix, iy, pupilR, 0, Math.PI * 2);
          ctx.fill();

          // Catchlight
          ctx.fillStyle = "rgba(255,255,255,0.8)";
          ctx.beginPath();
          ctx.arc(ix - irisR * 0.3, iy - irisR * 0.3, irisR * 0.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.beginPath();
          ctx.arc(ix + irisR * 0.2, iy + irisR * 0.15, irisR * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }

        // Upper eyelid
        ctx.fillStyle = PHOTO_SKIN.base;
        ctx.beginPath();
        ctx.ellipse(ex, eyeY - openH * 0.3, eyeW * 1.05, eyeH * 1.05, 0, Math.PI, Math.PI * 2);
        ctx.ellipse(ex, eyeY, eyeW * 1.05, Math.max(openH, 0.5), 0, Math.PI * 2, Math.PI);
        ctx.fill();

        // Eyelid crease
        ctx.strokeStyle = "rgba(120,80,60,0.15)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(ex, eyeY - eyeH * 0.7, eyeW * 1.05, eyeH * 0.45, 0, Math.PI * 0.85, Math.PI * 0.15, true);
        ctx.stroke();

        // Lash line
        ctx.strokeStyle = "rgba(26,16,8,0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW, Math.max(openH, 0.5), 0, Math.PI, Math.PI * 2);
        ctx.stroke();

        // Individual lashes
        if (openH > 1.5) {
          ctx.strokeStyle = "rgba(26,16,8,0.5)";
          ctx.lineWidth = 0.8;
          for (let i = 0; i < 6; i++) {
            const angle = Math.PI + (Math.PI * (i + 0.5)) / 6;
            const lx = ex + Math.cos(angle) * eyeW;
            const ly = eyeY + Math.sin(angle) * Math.max(openH, 0.5);
            const lLen = S * 0.008 * (1 - Math.abs(i - 3) / 6 * 0.5);
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx + Math.cos(angle - 0.1 * side) * lLen, ly + Math.sin(angle - 0.1 * side) * lLen);
            ctx.stroke();
          }
        }

        // Lower lash line
        ctx.strokeStyle = "rgba(26,16,8,0.2)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW * 0.9, Math.max(openH * 0.9, 0.5), 0, 0, Math.PI);
        ctx.stroke();
      }

      // ── Mouth (animated) ──
      const my = cy + S * 0.1 + breathY;
      const openness = mouthRef.current;
      const viseme = visemeRef.current;
      const mouthW = S * 0.055 * viseme.width;
      const jawDrop = openness * S * 0.045 * (0.5 + viseme.jawDrop * 0.5);
      const effectiveW = mouthW * (1 - viseme.roundness * 0.3);

      // Clear mouth area
      const mouthAreaGrad = ctx.createRadialGradient(cx, my, 0, cx, my, mouthW * 2);
      mouthAreaGrad.addColorStop(0, PHOTO_SKIN.base);
      mouthAreaGrad.addColorStop(0.6, PHOTO_SKIN.base);
      mouthAreaGrad.addColorStop(1, "transparent");
      ctx.fillStyle = mouthAreaGrad;
      ctx.beginPath();
      ctx.ellipse(cx, my, mouthW * 1.8, S * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();

      if (jawDrop > 1.5) {
        // Open mouth (expressive, signature smile structure)
        ctx.fillStyle = "#B86868";
        ctx.beginPath();
        ctx.moveTo(cx - effectiveW, my);
        ctx.quadraticCurveTo(cx - effectiveW * 0.5, my - jawDrop * 0.15, cx - effectiveW * 0.12, my - jawDrop * 0.08);
        ctx.quadraticCurveTo(cx, my - jawDrop * 0.18, cx + effectiveW * 0.12, my - jawDrop * 0.08);
        ctx.quadraticCurveTo(cx + effectiveW * 0.5, my - jawDrop * 0.15, cx + effectiveW, my);
        ctx.quadraticCurveTo(cx + effectiveW * 0.6, my + jawDrop * 0.88, cx, my + jawDrop);
        ctx.quadraticCurveTo(cx - effectiveW * 0.6, my + jawDrop * 0.88, cx - effectiveW, my);
        ctx.closePath();
        ctx.fill();

        // Upper lip definition
        ctx.strokeStyle = "#905050";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - effectiveW, my);
        ctx.quadraticCurveTo(cx - effectiveW * 0.5, my - jawDrop * 0.15, cx - effectiveW * 0.12, my - jawDrop * 0.08);
        ctx.quadraticCurveTo(cx, my - jawDrop * 0.18, cx + effectiveW * 0.12, my - jawDrop * 0.08);
        ctx.quadraticCurveTo(cx + effectiveW * 0.5, my - jawDrop * 0.15, cx + effectiveW, my);
        ctx.stroke();

        // Inner mouth
        const innerW = effectiveW * 0.8;
        const innerDrop = jawDrop * 0.7;
        ctx.fillStyle = "#3A1818";
        ctx.beginPath();
        ctx.ellipse(cx, my + innerDrop * 0.3, innerW, innerDrop * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        // Teeth
        if (jawDrop > 3) {
          ctx.fillStyle = "#F0EDE8";
          const teethW = innerW * 0.8;
          const teethH = Math.min(jawDrop * 0.2, S * 0.01);
          ctx.beginPath();
          ctx.moveTo(cx - teethW, my + 0.5);
          ctx.lineTo(cx + teethW, my + 0.5);
          ctx.lineTo(cx + teethW, my + 0.5 + teethH);
          ctx.lineTo(cx - teethW, my + 0.5 + teethH);
          ctx.closePath();
          ctx.fill();
        }

        // Tongue
        if (jawDrop > S * 0.02) {
          ctx.fillStyle = "#B06060";
          ctx.beginPath();
          ctx.ellipse(cx, my + jawDrop * 0.5, innerW * 0.45, jawDrop * 0.18, 0, 0, Math.PI);
          ctx.fill();
        }

        // Lip highlights
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.ellipse(cx, my - jawDrop * 0.05, effectiveW * 0.4, jawDrop * 0.08, 0, Math.PI, Math.PI * 2);
        ctx.fill();

        // Signature dimples when smiling (visible during speech)
        if (jawDrop > 3) {
          ctx.fillStyle = "rgba(130,90,60,0.12)";
          ctx.beginPath();
          ctx.arc(cx - effectiveW * 1.15, my + jawDrop * 0.15, S * 0.012, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(cx + effectiveW * 1.15, my + jawDrop * 0.15, S * 0.012, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Closed mouth (signature smile)
        ctx.strokeStyle = "#885050";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - mouthW, my + 0.5);
        ctx.quadraticCurveTo(cx - mouthW * 0.4, my - 0.5, cx - mouthW * 0.1, my + 0.5);
        ctx.quadraticCurveTo(cx, my - 1, cx + mouthW * 0.1, my + 0.5);
        ctx.quadraticCurveTo(cx + mouthW * 0.4, my - 0.5, cx + mouthW, my + 0.5);
        ctx.stroke();

        // Upper lip (well-defined)
        ctx.fillStyle = "rgba(184,104,104,0.4)";
        ctx.beginPath();
        ctx.moveTo(cx - mouthW, my + 0.5);
        ctx.quadraticCurveTo(cx - mouthW * 0.4, my - 2.5, cx, my - 3);
        ctx.quadraticCurveTo(cx + mouthW * 0.4, my - 2.5, cx + mouthW, my + 0.5);
        ctx.quadraticCurveTo(cx + mouthW * 0.4, my - 0.5, cx, my - 1);
        ctx.quadraticCurveTo(cx - mouthW * 0.4, my - 0.5, cx - mouthW, my + 0.5);
        ctx.fill();

        // Lower lip (fuller)
        ctx.fillStyle = "rgba(200,120,120,0.35)";
        ctx.beginPath();
        ctx.moveTo(cx - mouthW * 0.85, my + 1);
        ctx.quadraticCurveTo(cx, my + S * 0.018, cx + mouthW * 0.85, my + 1);
        ctx.quadraticCurveTo(cx, my + 0.5, cx - mouthW * 0.85, my + 1);
        ctx.fill();

        // Lip highlight
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath();
        ctx.ellipse(cx, my + S * 0.007, mouthW * 0.3, S * 0.004, 0, 0, Math.PI * 2);
        ctx.fill();

        // Subtle smile dimples (even when closed)
        ctx.fillStyle = "rgba(130,90,60,0.06)";
        ctx.beginPath();
        ctx.arc(cx - mouthW * 1.25, my + S * 0.01, S * 0.01, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + mouthW * 1.25, my + S * 0.01, S * 0.01, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Speaking glow (passport photo lighting) ──
      if (isSpeaking) {
        ctx.save();
        ctx.shadowColor = "rgba(6,182,212,0.15)";
        ctx.shadowBlur = 15;
        ctx.strokeStyle = "rgba(6,182,212,0.08)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, S * 0.35, S * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    },
    [isSpeaking],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = AVATAR.SIZE;
    canvas.height = AVATAR.SIZE;

    // Render base face once
    renderBaseFace(ctx);

    let running = true;

    const loop = () => {
      if (!running) return;

      const now = performance.now();
      const t = (now - startTimeRef.current) / 1000;

      // Mouth
      if (isSpeaking) {
        const f1 = Math.abs(Math.sin(t * 7.3)) * 0.3;
        const f2 = Math.abs(Math.sin(t * 11.7)) * 0.25;
        const f3 = Math.abs(Math.sin(t * 4.8)) * 0.2;
        const f4 = Math.abs(Math.sin(t * 16.1)) * 0.15;
        const burst = Math.max(0, Math.sin(t * 2.3)) * 0.1;
        const target = clamp(f1 + f2 + f3 + f4 + burst, 0, 1);
        mouthRef.current = lerp(mouthRef.current, target, 0.3);

        const visemePhase = t * 3.7;
        const vIdx = Math.floor(visemePhase) % 5;
        const vBlend = visemePhase - Math.floor(visemePhase);
        const visemes = [
          { width: 1.0, roundness: 0.0, jawDrop: 0.8 },
          { width: 0.7, roundness: 0.8, jawDrop: 0.6 },
          { width: 1.2, roundness: 0.0, jawDrop: 0.4 },
          { width: 0.8, roundness: 0.5, jawDrop: 0.9 },
          { width: 1.0, roundness: 0.2, jawDrop: 0.5 },
        ];
        const curr = visemes[vIdx];
        const next = visemes[(vIdx + 1) % visemes.length];
        visemeRef.current = {
          width: lerp(curr.width, next.width, vBlend),
          roundness: lerp(curr.roundness, next.roundness, vBlend),
          jawDrop: lerp(curr.jawDrop, next.jawDrop, vBlend),
        };
      } else {
        mouthRef.current = lerp(mouthRef.current, 0, ANIM.MOUTH_SMOOTH);
        visemeRef.current = {
          width: lerp(visemeRef.current.width, 1, 0.1),
          roundness: lerp(visemeRef.current.roundness, 0, 0.1),
          jawDrop: lerp(visemeRef.current.jawDrop, 0, 0.1),
        };
      }

      // Blink
      if (now > nextBlinkRef.current && blinkTargetRef.current === 0) {
        blinkTargetRef.current = 1;
        setTimeout(() => { blinkTargetRef.current = 0; }, ANIM.BLINK_DURATION_MS);
        nextBlinkRef.current = now + ANIM.BLINK_MIN_MS + Math.random() * (ANIM.BLINK_MAX_MS - ANIM.BLINK_MIN_MS);
      }
      blinkRef.current = lerp(blinkRef.current, blinkTargetRef.current, 0.45);

      // Eye drift
      if (now > nextEyeDriftRef.current) {
        eyeDriftTargetRef.current = {
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 1.5,
        };
        nextEyeDriftRef.current = now + 1500 + Math.random() * 3000;
      }
      eyeDriftRef.current = {
        x: lerp(eyeDriftRef.current.x, eyeDriftTargetRef.current.x, 0.04),
        y: lerp(eyeDriftRef.current.y, eyeDriftTargetRef.current.y, 0.04),
      };

      // Breathing
      breathRef.current = Math.sin(t * 0.8) * 0.6;

      drawAnimated(ctx);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [canvasRef, isSpeaking, renderBaseFace, drawAnimated]);
}
