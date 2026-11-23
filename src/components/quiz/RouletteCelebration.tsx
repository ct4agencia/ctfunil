"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/components/referencias/beui/lib/reduced-motion-seguro";

export async function fireRouletteConfetti(canvas?: HTMLCanvasElement) {
  const { default: confetti } = await import("canvas-confetti");
  if (canvas && !canvas.isConnected) return;
  const fire = canvas ? confetti.create(canvas, { resize: true }) : confetti;
  return fire({ particleCount: 170, spread: 95, origin: { y: 0.4 }, disableForReducedMotion: true });
}

export function RouletteCelebration({ emoji = "🎉" }: { emoji?: string }) {
  const reduzMovimento = useReducedMotion();
  return (
    <motion.div
      className="relative mx-auto grid h-14 w-14 place-items-center"
      initial={reduzMovimento ? false : { scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.1 }}
    >
      {!reduzMovimento && [0, 0.6].map((atraso, i) => (
        <motion.span
          key={i} aria-hidden className="absolute inset-0 rounded-full"
          style={{ background: "rgba(255,255,255,.55)" }}
          animate={{ scale: [1, i ? 1.6 : 1.4, 1], opacity: [i ? 0.3 : 0.45, 0, i ? 0.3 : 0.45] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: atraso }}
        />
      ))}
      <motion.span
        className="relative text-4xl leading-none"
        animate={reduzMovimento ? {} : { scale: [1, 1.12, 1], rotateZ: [0, -5, 5, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
      >{emoji}</motion.span>
    </motion.div>
  );
}
