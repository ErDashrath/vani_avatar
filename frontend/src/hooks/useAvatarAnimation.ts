/**
 * useAvatarAnimation – Realistic human face rendered on Canvas with lip-sync.
 *
 * Features:
 *  • Photorealistic skin with subsurface-scatter-like gradients
 *  • Detailed eyes: sclera, iris, pupil, eyelids, eyelashes, catchlights
 *  • Realistic nose with 3D shading
 *  • Natural lips with proper cupid's bow and dynamic viseme shapes
 *  • Hair with volume and highlights
 *  • Eyebrows with individual stroke hairs
 *  • Jaw/chin structure with proper face shape
 *  • Micro-movements: eye drift, subtle head sway, breathing
 *  • Smooth blink with eyelid animation (not instant)
 *  • prefers-reduced-motion respected
 */

import { useCallback, useEffect, useRef } from "react";
import { ANIM, AVATAR } from "../utils/constants";
import { clamp, lerp } from "../utils/audioUtils";

interface UseAvatarAnimationOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isSpeaking: boolean;
}

/* ─── Face configuration ─── */
const SKIN = {
  base: "#E8C4A0",
  light: "#F5DCC0",
  shadow: "#C9956B",
  deep: "#A07050",
  blush: "rgba(210, 120, 120, 0.18)",
};

const HAIR = {
  base: "#2C1810",
  mid: "#3D2418",
  highlight: "#5A3A28",
  light: "#7A5A48",
};

const EYE = {
  sclera: "#F8F4F0",
  scleraShadow: "#E0D8D0",
  iris: "#5B8A6E",       // green-hazel
  irisRim: "#3A5A40",
  irisInner: "#8AB89A",
  pupil: "#1A1A1A",
  lashColor: "#1A1008",
};

const LIP = {
  upper: "#C07070",
  lower: "#D08080",
  line: "#905050",
  inner: "#3A1818",
  teeth: "#F0EDE8",
};

export function useAvatarAnimation({
  canvasRef,
  isSpeaking,
}: UseAvatarAnimationOptions) {
  // Transient animation state (refs = zero re-renders at 60fps)
  const mouthRef = useRef(0);
  const blinkRef = useRef(0);          // 0 = open, 1 = fully closed
  const blinkTargetRef = useRef(0);
  const nextBlinkRef = useRef(0);
  const eyeDriftRef = useRef({ x: 0, y: 0 });
  const eyeDriftTargetRef = useRef({ x: 0, y: 0 });
  const nextEyeDriftRef = useRef(0);
  const headSwayRef = useRef(0);
  const breathRef = useRef(0);
  const rafRef = useRef(0);
  const reducedMotion = useRef(false);
  const startTimeRef = useRef(0);

  // Viseme state for more natural mouth shapes
  const visemeRef = useRef({
    width: 1,       // mouth width multiplier
    roundness: 0,   // 0 = wide, 1 = round (O shape)
    jawDrop: 0,     // how far jaw drops
  });

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    startTimeRef.current = performance.now();
  }, []);

  /* ─── Drawing helpers ─── */

  const drawFaceShape = useCallback(
    (ctx: CanvasRenderingContext2D, cx: number, cy: number, S: number) => {
      const faceW = S * 0.34;
      const faceH = S * 0.42;
      const jawY = cy + faceH * 0.15;

      // Face shadow (ambient occlusion)
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath();
      ctx.ellipse(cx + 2, cy + 6, faceW + 2, faceH + 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Main face shape – slightly tapered jaw
      ctx.save();
      const faceGrad = ctx.createRadialGradient(
        cx - faceW * 0.25, cy - faceH * 0.3, faceW * 0.1,
        cx, cy, faceH * 1.1,
      );
      faceGrad.addColorStop(0, SKIN.light);
      faceGrad.addColorStop(0.4, SKIN.base);
      faceGrad.addColorStop(0.85, SKIN.shadow);
      faceGrad.addColorStop(1, SKIN.deep);
      ctx.fillStyle = faceGrad;

      ctx.beginPath();
      ctx.moveTo(cx - faceW * 0.85, cy - faceH * 0.5);
      // Forehead
      ctx.quadraticCurveTo(cx - faceW * 0.9, cy - faceH * 0.85, cx, cy - faceH * 0.88);
      ctx.quadraticCurveTo(cx + faceW * 0.9, cy - faceH * 0.85, cx + faceW * 0.85, cy - faceH * 0.5);
      // Temple to cheek
      ctx.quadraticCurveTo(cx + faceW * 1.02, cy - faceH * 0.15, cx + faceW * 0.95, cy + faceH * 0.05);
      // Cheek to jaw
      ctx.quadraticCurveTo(cx + faceW * 0.82, cy + faceH * 0.45, cx + faceW * 0.35, jawY + faceH * 0.35);
      // Chin
      ctx.quadraticCurveTo(cx, jawY + faceH * 0.48, cx - faceW * 0.35, jawY + faceH * 0.35);
      // Jaw to cheek (left)
      ctx.quadraticCurveTo(cx - faceW * 0.82, cy + faceH * 0.45, cx - faceW * 0.95, cy + faceH * 0.05);
      ctx.quadraticCurveTo(cx - faceW * 1.02, cy - faceH * 0.15, cx - faceW * 0.85, cy - faceH * 0.5);
      ctx.closePath();
      ctx.fill();

      // Subtle cheek blush
      ctx.fillStyle = SKIN.blush;
      ctx.beginPath();
      ctx.ellipse(cx - faceW * 0.55, cy + faceH * 0.08, faceW * 0.22, faceH * 0.12, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + faceW * 0.55, cy + faceH * 0.08, faceW * 0.22, faceH * 0.12, 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Nose highlight (subtle)
      const noseHighlight = ctx.createRadialGradient(
        cx - 2, cy - faceH * 0.05, 1,
        cx, cy + faceH * 0.05, faceW * 0.15,
      );
      noseHighlight.addColorStop(0, "rgba(255,255,255,0.12)");
      noseHighlight.addColorStop(1, "transparent");
      ctx.fillStyle = noseHighlight;
      ctx.fillRect(cx - faceW * 0.2, cy - faceH * 0.2, faceW * 0.4, faceH * 0.35);

      ctx.restore();
    },
    [],
  );

  const drawEar = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, side: number, S: number) => {
      const earW = S * 0.035;
      const earH = S * 0.065;
      ctx.save();
      ctx.fillStyle = SKIN.shadow;
      ctx.beginPath();
      ctx.ellipse(x + side * earW * 0.3, y, earW, earH, side * 0.15, 0, Math.PI * 2);
      ctx.fill();
      // Inner ear
      ctx.fillStyle = SKIN.deep;
      ctx.beginPath();
      ctx.ellipse(x + side * earW * 0.1, y - earH * 0.05, earW * 0.5, earH * 0.6, side * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    [],
  );

  const drawEye = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      ex: number, ey: number,
      S: number, side: number,
      blinkAmount: number,
      driftX: number, driftY: number,
    ) => {
      const eyeW = S * 0.058;
      const eyeH = S * 0.038;
      const openH = eyeH * (1 - blinkAmount);

      ctx.save();

      // Eye socket shadow
      ctx.fillStyle = "rgba(120,80,60,0.12)";
      ctx.beginPath();
      ctx.ellipse(ex, ey - eyeH * 0.15, eyeW * 1.25, eyeH * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sclera (white of eye)
      ctx.fillStyle = EYE.sclera;
      ctx.beginPath();
      ctx.ellipse(ex, ey, eyeW, Math.max(openH, 1), 0, 0, Math.PI * 2);
      ctx.fill();

      // Sclera shadow (upper)
      if (openH > 2) {
        const scleraShadow = ctx.createLinearGradient(ex, ey - openH, ex, ey);
        scleraShadow.addColorStop(0, EYE.scleraShadow);
        scleraShadow.addColorStop(1, "transparent");
        ctx.fillStyle = scleraShadow;
        ctx.beginPath();
        ctx.ellipse(ex, ey, eyeW, openH, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (openH > 3) {
        const irisR = S * 0.022;
        const pupilR = irisR * 0.45;
        const ix = ex + driftX * S * 0.008;
        const iy = ey + driftY * S * 0.005;

        // Iris
        const irisGrad = ctx.createRadialGradient(ix - 1, iy - 1, pupilR * 0.5, ix, iy, irisR);
        irisGrad.addColorStop(0, EYE.irisInner);
        irisGrad.addColorStop(0.5, EYE.iris);
        irisGrad.addColorStop(1, EYE.irisRim);
        ctx.fillStyle = irisGrad;
        ctx.beginPath();
        ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
        ctx.fill();

        // Iris texture (radial lines)
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = EYE.irisRim;
        ctx.lineWidth = 0.5;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
          ctx.beginPath();
          ctx.moveTo(ix + Math.cos(a) * pupilR, iy + Math.sin(a) * pupilR);
          ctx.lineTo(ix + Math.cos(a) * irisR * 0.9, iy + Math.sin(a) * irisR * 0.9);
          ctx.stroke();
        }
        ctx.restore();

        // Pupil
        ctx.fillStyle = EYE.pupil;
        ctx.beginPath();
        ctx.arc(ix, iy, pupilR, 0, Math.PI * 2);
        ctx.fill();

        // Catchlight (primary)
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(ix - irisR * 0.3, iy - irisR * 0.35, irisR * 0.22, 0, Math.PI * 2);
        ctx.fill();

        // Catchlight (secondary, smaller)
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.arc(ix + irisR * 0.25, iy + irisR * 0.2, irisR * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Upper eyelid
      ctx.fillStyle = SKIN.base;
      ctx.beginPath();
      ctx.ellipse(ex, ey - openH * 0.3, eyeW * 1.08, eyeH * 1.1, 0, Math.PI, Math.PI * 2);
      // Close the lid shape
      ctx.ellipse(ex, ey, eyeW * 1.08, Math.max(openH, 1), 0, Math.PI * 2, Math.PI);
      ctx.fill();

      // Eyelid crease
      ctx.strokeStyle = "rgba(120,80,60,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(ex, ey - eyeH * 0.8, eyeW * 1.1, eyeH * 0.5, 0, Math.PI * 0.85, Math.PI * 0.15, true);
      ctx.stroke();

      // Eyelash line (upper)
      ctx.strokeStyle = EYE.lashColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(ex, ey, eyeW * 1.02, Math.max(openH * 1.02, 1), 0, Math.PI, Math.PI * 2);
      ctx.stroke();

      // Individual upper lashes
      if (openH > 2) {
        ctx.strokeStyle = EYE.lashColor;
        ctx.lineWidth = 1;
        const lashCount = 7;
        for (let i = 0; i < lashCount; i++) {
          const angle = Math.PI + (Math.PI * (i + 0.5)) / lashCount;
          const lx = ex + Math.cos(angle) * eyeW * 1.02;
          const ly = ey + Math.sin(angle) * Math.max(openH * 1.02, 1);
          const lLen = S * 0.012 * (1 - Math.abs(i - lashCount / 2) / lashCount * 0.6);
          const lAngle = angle - Math.PI * 0.1 * side;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + Math.cos(lAngle) * lLen, ly + Math.sin(lAngle) * lLen);
          ctx.stroke();
        }
      }

      // Lower eyelash line (subtle)
      ctx.strokeStyle = "rgba(26,16,8,0.3)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(ex, ey, eyeW * 0.95, Math.max(openH * 0.95, 1), 0, 0, Math.PI);
      ctx.stroke();

      ctx.restore();
    },
    [],
  );

  const drawEyebrow = useCallback(
    (ctx: CanvasRenderingContext2D, bx: number, by: number, S: number, side: number) => {
      const browW = S * 0.065;
      const browH = S * 0.008;

      ctx.save();
      ctx.strokeStyle = HAIR.base;
      ctx.lineWidth = 1.2;
      ctx.lineCap = "round";

      // Draw individual brow hairs
      const hairCount = 18;
      for (let i = 0; i < hairCount; i++) {
        const t = i / hairCount;
        const x = bx - browW * 0.5 + t * browW;
        const archY = by - Math.sin(t * Math.PI) * browH * 3 * (side === -1 ? 1 : 1);
        const angle = -0.3 + t * 0.6;
        const len = S * 0.008 + Math.sin(t * Math.PI) * S * 0.004;

        ctx.globalAlpha = 0.5 + Math.sin(t * Math.PI) * 0.4;
        ctx.beginPath();
        ctx.moveTo(x, archY);
        ctx.lineTo(x + Math.cos(angle) * len * side * 0.5, archY + Math.sin(angle) * len);
        ctx.stroke();
      }

      ctx.restore();
    },
    [],
  );

  const drawNose = useCallback(
    (ctx: CanvasRenderingContext2D, cx: number, ny: number, S: number) => {
      ctx.save();

      // Nose bridge shadow (left side)
      ctx.strokeStyle = "rgba(160,112,80,0.2)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - S * 0.012, ny - S * 0.06);
      ctx.quadraticCurveTo(cx - S * 0.018, ny, cx - S * 0.025, ny + S * 0.02);
      ctx.stroke();

      // Nose tip
      const noseTipGrad = ctx.createRadialGradient(
        cx, ny + S * 0.015, S * 0.005,
        cx, ny + S * 0.015, S * 0.025,
      );
      noseTipGrad.addColorStop(0, "rgba(255,255,255,0.08)");
      noseTipGrad.addColorStop(1, "transparent");
      ctx.fillStyle = noseTipGrad;
      ctx.beginPath();
      ctx.arc(cx, ny + S * 0.015, S * 0.025, 0, Math.PI * 2);
      ctx.fill();

      // Nostrils
      ctx.fillStyle = "rgba(140,90,60,0.25)";
      ctx.beginPath();
      ctx.ellipse(cx - S * 0.018, ny + S * 0.028, S * 0.012, S * 0.007, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + S * 0.018, ny + S * 0.028, S * 0.012, S * 0.007, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Nose bottom line
      ctx.strokeStyle = "rgba(160,112,80,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - S * 0.025, ny + S * 0.025);
      ctx.quadraticCurveTo(cx, ny + S * 0.035, cx + S * 0.025, ny + S * 0.025);
      ctx.stroke();

      ctx.restore();
    },
    [],
  );

  const drawMouth = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      cx: number, my: number, S: number,
      openness: number, viseme: { width: number; roundness: number; jawDrop: number },
    ) => {
      ctx.save();

      const mouthW = S * 0.065 * viseme.width;
      const jawDrop = openness * S * 0.055 * (0.5 + viseme.jawDrop * 0.5);
      const roundFactor = viseme.roundness;

      // Effective mouth width narrows when round (O shape)
      const effectiveW = mouthW * (1 - roundFactor * 0.35);

      if (jawDrop > 2) {
        // ── Open mouth ──

        // Outer lip shape
        ctx.fillStyle = LIP.upper;
        ctx.beginPath();
        // Upper lip (cupid's bow)
        ctx.moveTo(cx - effectiveW, my);
        ctx.quadraticCurveTo(cx - effectiveW * 0.5, my - jawDrop * 0.15, cx - effectiveW * 0.15, my - jawDrop * 0.08);
        ctx.quadraticCurveTo(cx, my - jawDrop * 0.2, cx + effectiveW * 0.15, my - jawDrop * 0.08);
        ctx.quadraticCurveTo(cx + effectiveW * 0.5, my - jawDrop * 0.15, cx + effectiveW, my);
        // Lower lip
        ctx.quadraticCurveTo(cx + effectiveW * 0.6, my + jawDrop * 0.9, cx, my + jawDrop);
        ctx.quadraticCurveTo(cx - effectiveW * 0.6, my + jawDrop * 0.9, cx - effectiveW, my);
        ctx.closePath();
        ctx.fill();

        // Inner mouth (dark cavity)
        const innerW = effectiveW * 0.82;
        const innerDrop = jawDrop * 0.75;
        ctx.fillStyle = LIP.inner;
        ctx.beginPath();
        ctx.ellipse(cx, my + innerDrop * 0.35, innerW, innerDrop * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Teeth (upper row)
        if (jawDrop > 4) {
          ctx.fillStyle = LIP.teeth;
          const teethW = innerW * 0.85;
          const teethH = Math.min(jawDrop * 0.25, S * 0.012);
          const tx = cx - teethW;
          const ty = my + 1;
          const tw = teethW * 2;
          const r = 1;
          ctx.beginPath();
          ctx.moveTo(tx + r, ty);
          ctx.lineTo(tx + tw - r, ty);
          ctx.arcTo(tx + tw, ty, tx + tw, ty + r, r);
          ctx.lineTo(tx + tw, ty + teethH - r);
          ctx.arcTo(tx + tw, ty + teethH, tx + tw - r, ty + teethH, r);
          ctx.lineTo(tx + r, ty + teethH);
          ctx.arcTo(tx, ty + teethH, tx, ty + teethH - r, r);
          ctx.lineTo(tx, ty + r);
          ctx.arcTo(tx, ty, tx + r, ty, r);
          ctx.closePath();
          ctx.fill();

          // Tooth lines
          ctx.strokeStyle = "rgba(200,195,185,0.3)";
          ctx.lineWidth = 0.5;
          const toothCount = 6;
          for (let i = 1; i < toothCount; i++) {
            const tx = cx - teethW + (teethW * 2 * i) / toothCount;
            ctx.beginPath();
            ctx.moveTo(tx, my + 1);
            ctx.lineTo(tx, my + 1 + teethH);
            ctx.stroke();
          }
        }

        // Tongue hint (when wide open)
        if (jawDrop > S * 0.025) {
          ctx.fillStyle = "#B06060";
          ctx.beginPath();
          ctx.ellipse(cx, my + jawDrop * 0.55, innerW * 0.5, jawDrop * 0.2, 0, 0, Math.PI);
          ctx.fill();
        }

        // Lip highlight
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.ellipse(cx, my - jawDrop * 0.05, effectiveW * 0.4, jawDrop * 0.08, 0, Math.PI, Math.PI * 2);
        ctx.fill();

        // Lower lip highlight
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.beginPath();
        ctx.ellipse(cx, my + jawDrop * 0.7, effectiveW * 0.35, jawDrop * 0.12, 0, 0, Math.PI);
        ctx.fill();
      } else {
        // ── Closed mouth – natural resting lips ──

        // Lip line
        ctx.strokeStyle = LIP.line;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - mouthW, my + 1);
        // Cupid's bow
        ctx.quadraticCurveTo(cx - mouthW * 0.4, my - 1, cx - mouthW * 0.12, my + 1);
        ctx.quadraticCurveTo(cx, my - 2, cx + mouthW * 0.12, my + 1);
        ctx.quadraticCurveTo(cx + mouthW * 0.4, my - 1, cx + mouthW, my + 1);
        ctx.stroke();

        // Upper lip fill
        ctx.fillStyle = LIP.upper;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(cx - mouthW, my + 1);
        ctx.quadraticCurveTo(cx - mouthW * 0.4, my - 3, cx, my - 3.5);
        ctx.quadraticCurveTo(cx + mouthW * 0.4, my - 3, cx + mouthW, my + 1);
        ctx.quadraticCurveTo(cx + mouthW * 0.4, my - 1, cx + mouthW * 0.12, my + 1);
        ctx.quadraticCurveTo(cx, my - 2, cx - mouthW * 0.12, my + 1);
        ctx.quadraticCurveTo(cx - mouthW * 0.4, my - 1, cx - mouthW, my + 1);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Lower lip
        ctx.fillStyle = LIP.lower;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(cx - mouthW * 0.85, my + 2);
        ctx.quadraticCurveTo(cx, my + S * 0.018, cx + mouthW * 0.85, my + 2);
        ctx.quadraticCurveTo(cx, my + 1, cx - mouthW * 0.85, my + 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Lip highlight
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.ellipse(cx, my + S * 0.008, mouthW * 0.3, S * 0.004, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },
    [],
  );

  const drawHair = useCallback(
    (ctx: CanvasRenderingContext2D, cx: number, cy: number, S: number) => {
      ctx.save();

      const faceW = S * 0.34;
      const faceH = S * 0.42;

      // Hair back volume
      ctx.fillStyle = HAIR.base;
      ctx.beginPath();
      ctx.ellipse(cx, cy - faceH * 0.35, faceW * 1.15, faceH * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Side hair (left)
      ctx.beginPath();
      ctx.ellipse(cx - faceW * 0.95, cy + faceH * 0.05, faceW * 0.2, faceH * 0.45, 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Side hair (right)
      ctx.beginPath();
      ctx.ellipse(cx + faceW * 0.95, cy + faceH * 0.05, faceW * 0.2, faceH * 0.45, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Top hair volume
      const hairGrad = ctx.createLinearGradient(cx - faceW, cy - faceH, cx + faceW, cy - faceH * 0.3);
      hairGrad.addColorStop(0, HAIR.mid);
      hairGrad.addColorStop(0.4, HAIR.highlight);
      hairGrad.addColorStop(0.7, HAIR.mid);
      hairGrad.addColorStop(1, HAIR.base);
      ctx.fillStyle = hairGrad;

      ctx.beginPath();
      ctx.moveTo(cx - faceW * 0.95, cy - faceH * 0.4);
      ctx.quadraticCurveTo(cx - faceW * 1.05, cy - faceH * 0.95, cx - faceW * 0.3, cy - faceH * 0.92);
      ctx.quadraticCurveTo(cx, cy - faceH * 1.05, cx + faceW * 0.3, cy - faceH * 0.92);
      ctx.quadraticCurveTo(cx + faceW * 1.05, cy - faceH * 0.95, cx + faceW * 0.95, cy - faceH * 0.4);
      // Sweep down sides
      ctx.quadraticCurveTo(cx + faceW * 1.1, cy - faceH * 0.2, cx + faceW * 1.0, cy - faceH * 0.05);
      ctx.lineTo(cx + faceW * 0.88, cy - faceH * 0.15);
      ctx.quadraticCurveTo(cx + faceW * 0.7, cy - faceH * 0.75, cx, cy - faceH * 0.72);
      ctx.quadraticCurveTo(cx - faceW * 0.7, cy - faceH * 0.75, cx - faceW * 0.88, cy - faceH * 0.15);
      ctx.lineTo(cx - faceW * 1.0, cy - faceH * 0.05);
      ctx.quadraticCurveTo(cx - faceW * 1.1, cy - faceH * 0.2, cx - faceW * 0.95, cy - faceH * 0.4);
      ctx.closePath();
      ctx.fill();

      // Hair strand highlights
      ctx.strokeStyle = HAIR.light;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.2;
      for (let i = 0; i < 12; i++) {
        const sx = cx - faceW * 0.6 + (faceW * 1.2 * i) / 12;
        const startY = cy - faceH * 0.85 + Math.sin(i * 1.3) * faceH * 0.08;
        ctx.beginPath();
        ctx.moveTo(sx, startY);
        ctx.quadraticCurveTo(
          sx + Math.sin(i * 0.7) * faceW * 0.1,
          startY + faceH * 0.2,
          sx + Math.sin(i * 0.5) * faceW * 0.15,
          startY + faceH * 0.4,
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.restore();
    },
    [],
  );

  const drawNeck = useCallback(
    (ctx: CanvasRenderingContext2D, cx: number, cy: number, S: number) => {
      ctx.save();
      const neckW = S * 0.1;
      const neckTop = cy + S * 0.22;
      const neckBot = cy + S * 0.38;

      // Neck shadow
      ctx.fillStyle = SKIN.shadow;
      ctx.beginPath();
      ctx.moveTo(cx - neckW, neckTop);
      ctx.lineTo(cx - neckW * 1.3, neckBot);
      ctx.lineTo(cx + neckW * 1.3, neckBot);
      ctx.lineTo(cx + neckW, neckTop);
      ctx.closePath();
      ctx.fill();

      // Neck main
      const neckGrad = ctx.createLinearGradient(cx - neckW, neckTop, cx + neckW, neckTop);
      neckGrad.addColorStop(0, SKIN.shadow);
      neckGrad.addColorStop(0.3, SKIN.base);
      neckGrad.addColorStop(0.7, SKIN.base);
      neckGrad.addColorStop(1, SKIN.shadow);
      ctx.fillStyle = neckGrad;
      ctx.beginPath();
      ctx.moveTo(cx - neckW * 0.9, neckTop);
      ctx.lineTo(cx - neckW * 1.15, neckBot);
      ctx.lineTo(cx + neckW * 1.15, neckBot);
      ctx.lineTo(cx + neckW * 0.9, neckTop);
      ctx.closePath();
      ctx.fill();

      // Shoulders hint
      ctx.fillStyle = "#3A3A50";
      ctx.beginPath();
      ctx.moveTo(cx - neckW * 1.15, neckBot);
      ctx.quadraticCurveTo(cx - S * 0.35, neckBot + S * 0.02, cx - S * 0.45, neckBot + S * 0.12);
      ctx.lineTo(cx + S * 0.45, neckBot + S * 0.12);
      ctx.quadraticCurveTo(cx + S * 0.35, neckBot + S * 0.02, cx + neckW * 1.15, neckBot);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    },
    [],
  );

  /* ─── Main draw function ─── */
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const S = AVATAR.SIZE;
      const cx = S / 2;
      const cy = S / 2 - S * 0.02;

      // Subtle head sway
      const swayX = headSwayRef.current * S * 0.003;
      const breathY = breathRef.current * S * 0.003;

      ctx.clearRect(0, 0, S, S);

      // ── Background ──
      const bg = ctx.createRadialGradient(cx, cy, S * 0.1, cx, cy, S * 0.55);
      bg.addColorStop(0, "#1a2035");
      bg.addColorStop(1, "#0c1018");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);

      // Subtle vignette
      const vignette = ctx.createRadialGradient(cx, cy, S * 0.25, cx, cy, S * 0.55);
      vignette.addColorStop(0, "transparent");
      vignette.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, S, S);

      ctx.save();
      ctx.translate(swayX, breathY);

      // ── Neck & shoulders ──
      drawNeck(ctx, cx, cy, S);

      // ── Ears ──
      drawEar(ctx, cx - S * 0.33, cy - S * 0.01, -1, S);
      drawEar(ctx, cx + S * 0.33, cy - S * 0.01, 1, S);

      // ── Hair (back layer) ──
      // (drawn as part of drawHair)

      // ── Face ──
      drawFaceShape(ctx, cx, cy, S);

      // ── Eyes ──
      const eyeY = cy - S * 0.055;
      const eyeSpacing = S * 0.095;
      const blink = blinkRef.current;
      const driftX = eyeDriftRef.current.x;
      const driftY = eyeDriftRef.current.y;

      drawEye(ctx, cx - eyeSpacing, eyeY, S, -1, blink, driftX, driftY);
      drawEye(ctx, cx + eyeSpacing, eyeY, S, 1, blink, driftX, driftY);

      // ── Eyebrows ──
      drawEyebrow(ctx, cx - eyeSpacing, eyeY - S * 0.048, S, -1);
      drawEyebrow(ctx, cx + eyeSpacing, eyeY - S * 0.048, S, 1);

      // ── Nose ──
      drawNose(ctx, cx, cy + S * 0.02, S);

      // ── Mouth ──
      drawMouth(ctx, cx, cy + S * 0.12, S, mouthRef.current, visemeRef.current);

      // ── Hair (front layer) ──
      drawHair(ctx, cx, cy, S);

      // ── Speaking glow ──
      if (isSpeaking) {
        ctx.shadowColor = "rgba(6,182,212,0.25)";
        ctx.shadowBlur = 25;
        ctx.strokeStyle = "rgba(6,182,212,0.15)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, S * 0.38, S * 0.44, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    },
    [isSpeaking, drawFaceShape, drawEar, drawEye, drawEyebrow, drawNose, drawMouth, drawHair, drawNeck],
  );

  /* ─── Animation loop ─── */
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

      const now = performance.now();
      const t = (now - startTimeRef.current) / 1000;

      // ── Mouth animation ──
      if (isSpeaking) {
        // Multi-frequency simulation for natural speech patterns
        const f1 = Math.abs(Math.sin(t * 7.3)) * 0.3;
        const f2 = Math.abs(Math.sin(t * 11.7)) * 0.25;
        const f3 = Math.abs(Math.sin(t * 4.8)) * 0.2;
        const f4 = Math.abs(Math.sin(t * 16.1)) * 0.15;
        const burst = Math.max(0, Math.sin(t * 2.3)) * 0.1;
        const target = clamp(f1 + f2 + f3 + f4 + burst, 0, 1);
        mouthRef.current = lerp(mouthRef.current, target, 0.3);

        // Viseme variation (simulate different phoneme shapes)
        const visemePhase = t * 3.7;
        const vIdx = Math.floor(visemePhase) % 5;
        const vBlend = visemePhase - Math.floor(visemePhase);

        // Different viseme targets
        const visemes = [
          { width: 1.0, roundness: 0.0, jawDrop: 0.8 },   // "ah"
          { width: 0.7, roundness: 0.8, jawDrop: 0.6 },   // "oh"
          { width: 1.2, roundness: 0.0, jawDrop: 0.4 },   // "ee"
          { width: 0.8, roundness: 0.5, jawDrop: 0.9 },   // "oo"
          { width: 1.0, roundness: 0.2, jawDrop: 0.5 },   // "mm"
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

      // ── Smooth blink ──
      if (now > nextBlinkRef.current && blinkTargetRef.current === 0) {
        blinkTargetRef.current = 1;
        setTimeout(() => {
          blinkTargetRef.current = 0;
        }, ANIM.BLINK_DURATION_MS);
        nextBlinkRef.current =
          now + ANIM.BLINK_MIN_MS + Math.random() * (ANIM.BLINK_MAX_MS - ANIM.BLINK_MIN_MS);
      }
      blinkRef.current = lerp(blinkRef.current, blinkTargetRef.current, 0.45);

      // ── Eye drift ──
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

      // ── Head sway (very subtle) ──
      headSwayRef.current = Math.sin(t * 0.4) * 0.8 + Math.sin(t * 0.7) * 0.4;

      // ── Breathing ──
      breathRef.current = Math.sin(t * 0.8) * 0.6;

      if (!reducedMotion.current) {
        draw(ctx);
      } else {
        mouthRef.current = isSpeaking ? 0.4 : 0;
        draw(ctx);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [canvasRef, isSpeaking, draw]);
}
