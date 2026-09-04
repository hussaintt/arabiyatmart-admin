"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { fadeUpBlur, staggerContainer, staggerContainerSlow } from "@/lib/motion";

type AnimateInViewProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: boolean;
  slow?: boolean;
  once?: boolean;
};

export function AnimateInView({
  children,
  className,
  delay = 0,
  stagger = false,
  slow = false,
  once = true,
}: AnimateInViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-56px 0px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={stagger ? (slow ? staggerContainerSlow : staggerContainer) : fadeUpBlur}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      transition={stagger ? undefined : { delay }}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={cn("min-w-0", className)} variants={fadeUpBlur}>
      {children}
    </motion.div>
  );
}

export function PageMotion({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={cn("admin-page", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
