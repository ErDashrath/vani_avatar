/**
 * AudioWaveform – Animated waveform visualization
 * 
 * Shows audio activity when speaking/listening
 */

import { memo, useEffect, useRef } from "react";

interface AudioWaveformProps {
    isActive: boolean;
    color?: string;
}

export const AudioWaveform = memo(function AudioWaveform({
    isActive,
    color = "#3b82f6"
}: AudioWaveformProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const barsRef = useRef<number[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const barCount = 40;
        const barWidth = 3;
        const gap = 4;

        // Initialize bars
        if (barsRef.current.length === 0) {
            barsRef.current = Array(barCount).fill(0).map(() => Math.random() * 0.3 + 0.1);
        }

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const centerY = canvas.height / 2;
            const totalWidth = barCount * (barWidth + gap);
            const startX = (canvas.width - totalWidth) / 2;

            barsRef.current.forEach((height, i) => {
                // Update bar height
                if (isActive) {
                    const target = Math.random() * 0.8 + 0.2;
                    barsRef.current[i] = height + (target - height) * 0.15;
                } else {
                    barsRef.current[i] = height + (0.1 - height) * 0.1;
                }

                const barHeight = barsRef.current[i] * canvas.height * 0.6;
                const x = startX + i * (barWidth + gap);

                // Create gradient
                const gradient = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
                gradient.addColorStop(0, `${color}40`);
                gradient.addColorStop(0.5, color);
                gradient.addColorStop(1, `${color}40`);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 1.5);
                ctx.fill();
            });

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationRef.current);
        };
    }, [isActive, color]);

    return (
        <canvas
            ref={canvasRef}
            width={288}
            height={40}
            className="opacity-80 block mx-auto"
        />
    );
});
