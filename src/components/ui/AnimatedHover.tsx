"use client";

import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

interface AnimatedHoverProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
}

export function AnimatedHover({ children, className, ...props }: AnimatedHoverProps) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
