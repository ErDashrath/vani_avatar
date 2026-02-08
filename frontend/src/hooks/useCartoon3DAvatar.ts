/**
 * useCartoon3DAvatar – Simple 3D talking head using Three.js
 */

import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { ANIM, AVATAR } from "../utils/constants";
import { clamp, lerp } from "../utils/audioUtils";

interface UseCartoon3DAvatarOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isSpeaking: boolean;
}

export function useCartoon3DAvatar({
  containerRef,
  isSpeaking,
}: UseCartoon3DAvatarOptions) {
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef = useRef(0);
  const mouthRef = useRef(0);
  const blinkRef = useRef(0);
  const blinkTargetRef = useRef(0);
  const nextBlinkRef = useRef(0);
  const startTimeRef = useRef(0);

  const headGroupRef = useRef<THREE.Group | null>(null);
  const mouthMeshRef = useRef<THREE.Mesh | null>(null);
  const leftEyeRef = useRef<THREE.Group | null>(null);
  const rightEyeRef = useRef<THREE.Group | null>(null);

  const buildScene = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const size = AVATAR.DISPLAY_SIZE;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.borderRadius = "1rem";
    rendererRef.current = renderer;

    const headGroup = new THREE.Group();
    scene.add(headGroup);
    headGroupRef.current = headGroup;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const skinMaterial = new THREE.MeshPhongMaterial({ color: 0xffdbac });
    const eyeWhiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const irisMaterial = new THREE.MeshBasicMaterial({ color: 0x4a90a4 });
    const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    const lipMaterial = new THREE.MeshPhongMaterial({ color: 0xff8899 });
    const hairMaterial = new THREE.MeshPhongMaterial({ color: 0x2d1810 });

    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), skinMaterial);
    head.scale.set(1, 1.1, 0.9);
    headGroup.add(head);

    const createEye = (x: number) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(x, 0.3, 0.85);

      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), eyeWhiteMaterial);
      eyeWhite.scale.set(1, 0.8, 0.6);
      eyeGroup.add(eyeWhite);

      const iris = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), irisMaterial);
      iris.position.z = 0.12;
      eyeGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), pupilMaterial);
      pupil.position.z = 0.13;
      eyeGroup.add(pupil);

      const catchlight = new THREE.Mesh(new THREE.CircleGeometry(0.03, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      catchlight.position.set(-0.04, 0.04, 0.14);
      eyeGroup.add(catchlight);

      headGroup.add(eyeGroup);
      return eyeGroup;
    };

    leftEyeRef.current = createEye(-0.35);
    rightEyeRef.current = createEye(0.35);

    const createBrow = (x: number) => {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.08), hairMaterial);
      brow.position.set(x, 0.6, 0.82);
      brow.rotation.z = x < 0 ? 0.15 : -0.15;
      headGroup.add(brow);
    };

    createBrow(-0.35);
    createBrow(0.35);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 8), skinMaterial);
    nose.position.set(0, 0, 1);
    nose.rotation.x = Math.PI / 2;
    headGroup.add(nose);

    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 8, 16, Math.PI), lipMaterial);
    mouth.position.set(0, -0.3, 0.85);
    mouth.rotation.z = Math.PI;
    headGroup.add(mouth);
    mouthMeshRef.current = mouth;

    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(1.15, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMaterial);
    hairTop.position.set(0, 0.15, 0);
    hairTop.scale.set(0.95, 1, 0.95);
    headGroup.add(hairTop);

    [-0.9, 0.9].forEach((x) => {
      const sideHair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), hairMaterial);
      sideHair.position.set(x, 0.1, 0.2);
      sideHair.scale.set(0.6, 1.3, 0.8);
      headGroup.add(sideHair);
    });

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.6, 16), skinMaterial);
    neck.position.set(0, -1.2, 0);
    headGroup.add(neck);

    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshPhongMaterial({ color: 0x3a4a5a }));
    body.position.set(0, -1.6, 0);
    body.scale.set(1.5, 0.8, 1);
    headGroup.add(body);

    startTimeRef.current = performance.now();
  }, [containerRef]);

  useEffect(() => {
    buildScene();

    return () => {
      const container = containerRef.current;
      if (rendererRef.current && container && rendererRef.current.domElement.parentNode === container) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      cancelAnimationFrame(rafRef.current);
    };
  }, [buildScene, containerRef]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const headGroup = headGroupRef.current;
    const mouth = mouthMeshRef.current;

    if (!renderer || !scene || !camera || !headGroup) return;

    let running = true;

    const loop = () => {
      if (!running) return;

      const now = performance.now();
      const t = (now - startTimeRef.current) / 1000;

      if (isSpeaking) {
        const f1 = Math.abs(Math.sin(t * 7.3)) * 0.35;
        const f2 = Math.abs(Math.sin(t * 11.7)) * 0.25;
        const f3 = Math.abs(Math.sin(t * 4.8)) * 0.2;
        const target = clamp(f1 + f2 + f3, 0, 1);
        mouthRef.current = lerp(mouthRef.current, target, 0.3);
      } else {
        mouthRef.current = lerp(mouthRef.current, 0, ANIM.MOUTH_SMOOTH);
      }

      if (mouth) {
        const mOpen = mouthRef.current;
        mouth.scale.set(1 + mOpen * 0.3, 1 + mOpen * 0.5, 1);
        mouth.position.y = -0.3 - mOpen * 0.1;
      }

      if (now > nextBlinkRef.current && blinkTargetRef.current === 0) {
        blinkTargetRef.current = 1;
        setTimeout(() => { blinkTargetRef.current = 0; }, ANIM.BLINK_DURATION_MS);
        nextBlinkRef.current = now + ANIM.BLINK_MIN_MS + Math.random() * (ANIM.BLINK_MAX_MS - ANIM.BLINK_MIN_MS);
      }
      blinkRef.current = lerp(blinkRef.current, blinkTargetRef.current, 0.5);

      if (leftEyeRef.current && rightEyeRef.current) {
        const blinkScale = 1 - blinkRef.current * 0.9;
        leftEyeRef.current.scale.y = blinkScale;
        rightEyeRef.current.scale.y = blinkScale;
      }

      headGroup.rotation.y = Math.sin(t * 0.6) * 0.05;
      headGroup.rotation.x = Math.sin(t * 0.4) * 0.02;
      headGroup.position.y = Math.sin(t * 0.9) * 0.02;

      headGroup.scale.set(
        1 + Math.sin(t * 0.8) * 0.01,
        1 + Math.sin(t * 0.8) * 0.015,
        1 + Math.sin(t * 0.8) * 0.01
      );

      if (isSpeaking) {
        const pulse = 0.5 + Math.sin(t * 3) * 0.1;
        scene.background = new THREE.Color().setHSL(0.58, 0.4, 0.08 + pulse * 0.02);
      } else {
        scene.background = new THREE.Color(0x1a1a2e);
      }

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [isSpeaking]);
}
