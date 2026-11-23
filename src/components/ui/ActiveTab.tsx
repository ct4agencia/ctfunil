"use client";

import { motion, useReducedMotion } from "motion/react";

export default function ActiveTab({ group }: { group: string }) {
  const reduced = useReducedMotion();
  return <motion.span
    aria-hidden="true"
    className="ct-tab-indicator"
    layoutId={reduced ? undefined : group}
    transition={{ type: "spring", stiffness: 390, damping: 35 }}
  />;
}
