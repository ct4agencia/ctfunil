"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";

/**
 * Container Scroll Animation (21st.dev, nativo com motion).
 * Cabeçalho que sobe + "tela" 3D que se endireita e cresce conforme rola.
 * Usado como hero de revelação (ex: preview do funil no topo das métricas).
 */
export default function ContainerScroll({
  titleComponent, children,
}: { titleComponent: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rotate = useTransform(scrollYProgress, [0, 0.5], [22, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.86, 1]);
  const translate = useTransform(scrollYProgress, [0, 0.5], [0, -40]);

  return (
    <div ref={ref} className="relative flex h-[44rem] items-center justify-center p-4 md:h-[52rem]">
      <div className="relative w-full" style={{ perspective: "1000px" }}>
        <Header translate={translate}>{titleComponent}</Header>
        <Card rotate={rotate} scale={scale}>{children}</Card>
      </div>
    </div>
  );
}

function Header({ translate, children }: { translate: MotionValue<number>; children: React.ReactNode }) {
  return (
    <motion.div style={{ translateY: translate }} className="mx-auto max-w-3xl text-center">
      {children}
    </motion.div>
  );
}

function Card({ rotate, scale, children }: { rotate: MotionValue<number>; scale: MotionValue<number>; children: React.ReactNode }) {
  return (
    <motion.div
      style={{ rotateX: rotate, scale, boxShadow: "0 30px 60px -20px rgba(20,20,40,.45), 0 8px 24px -12px rgba(20,20,40,.25)" }}
      className="mx-auto -mt-6 h-[30rem] w-full max-w-4xl rounded-[2rem] border border-neutral-200 bg-white p-3 md:h-[36rem]">
      <div className="h-full w-full overflow-hidden rounded-2xl bg-neutral-50">{children}</div>
    </motion.div>
  );
}
