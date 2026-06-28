"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children?: React.ReactNode;
}

export function GlassCard({ children, className, ...props }: GlassCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "glass glass-hover rounded-2xl p-5 text-card-foreground",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
