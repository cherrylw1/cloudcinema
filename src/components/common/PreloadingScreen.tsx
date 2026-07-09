"use client";

import { useEffect, useState } from "react";
import { motion, Variants } from "framer-motion";

export function PreloadingScreen() {
  const [progress, setProgress] = useState(0);

  // Animate the progress bar from 0 to 100 over 2.2 seconds
  useEffect(() => {
    const duration = 2200; // ms
    const intervalTime = 20; // update every 20ms
    const steps = duration / intervalTime;
    const stepIncrement = 100 / steps;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + stepIncrement;
        if (next >= 100) {
          clearInterval(timer);
          return 100;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, []);

  // Framer Motion variants for stagger animations
  const containerVariants: Variants = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    initial: { opacity: 0, y: 15, filter: "blur(4px)" },
    animate: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
    },
  };

  const words = "Cherry on top".split(" ");

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ 
        opacity: 0, 
        scale: 1.04, 
        filter: "blur(12px)",
        transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } 
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black overflow-hidden select-none"
    >
      {/* ── Ambient Floating Glow Blobs (Cinema Nebula) ── */}
      <motion.div
        animate={{
          x: [-30, 40, -10],
          y: [-20, 30, -30],
          scale: [1, 1.2, 0.9],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
        className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] rounded-full bg-brand-primary/10 blur-[120px] pointer-events-none"
      />
      <motion.div
        animate={{
          x: [40, -30, 20],
          y: [30, -20, 40],
          scale: [1.1, 0.8, 1.2],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
        className="absolute bottom-1/4 right-1/4 w-[35vw] h-[35vw] rounded-full bg-indigo-600/5 blur-[100px] pointer-events-none"
      />

      <div className="relative z-10 flex flex-col items-center max-w-lg px-6 text-center">
        {/* ── Premium Custom Cherry SVG Logo ── */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mb-6"
        >
          {/* Outer glow ring */}
          <div className="absolute inset-0 rounded-full bg-brand-primary/15 blur-2xl animate-pulse" />
          
          <svg
            width="80"
            height="80"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_0_15px_rgba(229,9,20,0.55)]"
          >
            <defs>
              {/* Cherry Red Glossy Gradient */}
              <radialGradient id="cherryGrad" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ff4d5a" />
                <stop offset="50%" stopColor="#e50914" />
                <stop offset="100%" stopColor="#660007" />
              </radialGradient>
              {/* Stems/Leaf Green Gradient */}
              <linearGradient id="stemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#15803d" />
              </linearGradient>
              {/* Soft Drop Shadow for Depth */}
              <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
              </filter>
            </defs>

            {/* Left Stem */}
            <path
              d="M32 64 C32 45, 45 28, 52 18"
              stroke="url(#stemGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
            {/* Right Stem */}
            <path
              d="M66 68 C66 45, 56 30, 52 18"
              stroke="url(#stemGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
            {/* Stem Joint / Node */}
            <circle cx="52" cy="18" r="3.5" fill="url(#stemGrad)" />
            {/* Small Elegant Leaf */}
            <path
              d="M52 18 C58 12, 68 12, 65 22 C59 22, 53 20, 52 18 Z"
              fill="url(#stemGrad)"
              filter="url(#shadow)"
            />

            {/* Left Cherry Body */}
            <circle cx="32" cy="68" r="16" fill="url(#cherryGrad)" filter="url(#shadow)" />
            {/* Left Gloss Highlight */}
            <ellipse cx="27" cy="62" rx="4" ry="2" transform="rotate(-30 27 62)" fill="#ffffff" fillOpacity="0.65" />

            {/* Right Cherry Body */}
            <circle cx="66" cy="72" r="18" fill="url(#cherryGrad)" filter="url(#shadow)" />
            {/* Right Gloss Highlight */}
            <ellipse cx="61" cy="65" rx="4.5" ry="2.2" transform="rotate(-30 61 65)" fill="#ffffff" fillOpacity="0.65" />
          </svg>
        </motion.div>

        {/* ── Heading: Staggered Words ── */}
        <motion.div
          variants={containerVariants}
          initial="initial"
          animate="animate"
          className="flex flex-col items-center space-y-3"
        >
          <div className="flex gap-2 justify-center">
            {words.map((word, idx) => (
              <motion.span
                key={idx}
                variants={itemVariants}
                className="text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.05)]"
              >
                {word}
              </motion.span>
            ))}
          </div>

          {/* ── Subtitle text: Fades in after header ── */}
          <motion.p
            variants={itemVariants}
            className="text-xs md:text-sm text-white/50 tracking-wide font-medium leading-relaxed max-w-sm mt-1"
          >
            curated movies, TV shows, and anime for cinephiles
          </motion.p>
        </motion.div>
      </div>

      {/* ── Sleek Ambient Progress Bar ── */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 h-[2px] bg-white/[0.08] rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-primary rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(229,9,20,0.8)]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}
