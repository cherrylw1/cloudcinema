"use client";

import React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

interface BaseMotionProps extends HTMLMotionProps<"div"> {
  children?: React.ReactNode;
}

export function FadeIn({ children, transition, ...props }: BaseMotionProps) {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.3,
        ease: "easeOut",
        ...transition,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function FadeUp({ children, transition, ...props }: BaseMotionProps) {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.4,
        ease: "easeOut",
        ...transition,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function ScaleIn({ children, transition, ...props }: BaseMotionProps) {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.3,
        ease: "easeOut",
        ...transition,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function BlurIn({ children, transition, ...props }: BaseMotionProps) {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      initial={{ opacity: 0, filter: shouldReduceMotion ? "none" : "blur(8px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.4,
        ease: "easeOut",
        ...transition,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function HoverLift({ children, transition, className, ...props }: BaseMotionProps) {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      whileHover={shouldReduceMotion ? {} : { y: -4, scale: 1.01 }}
      transition={{
        duration: 0.2,
        ease: "easeOut",
        ...transition,
      }}
      className={cn("transition-shadow duration-300", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function FocusScale({ children, transition, className, ...props }: BaseMotionProps) {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      whileFocus={shouldReduceMotion ? {} : { scale: 1.02 }}
      transition={{
        duration: 0.2,
        ease: "easeOut",
        ...transition,
      }}
      className={cn("outline-none", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function PageReveal({ children, ...props }: BaseMotionProps) {
  const shouldReduceMotion = useReducedMotion();
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
        delayChildren: shouldReduceMotion ? 0 : 0.05,
      },
    },
  };
  
  const childVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return (
            <motion.div variants={childVariants}>
              {child}
            </motion.div>
          );
        }
        return child;
      })}
    </motion.div>
  );
}
