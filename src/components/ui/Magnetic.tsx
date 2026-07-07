"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

interface MagneticProps {
  children: ReactNode;
  range?: number; // Attraction distance radius
  strength?: number; // Pull power multiplier (0 to 1)
  className?: string;
}

export function Magnetic({ children, range = 55, strength = 0.35, className = "inline-block" }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    
    // Find center point of element
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    
    // Find distance from cursor to element center
    const distanceX = clientX - centerX;
    const distanceY = clientY - centerY;
    const distance = Math.hypot(distanceX, distanceY);

    // If within radius, translate coordinates toward cursor
    if (distance < range) {
      setPosition({
        x: distanceX * strength,
        y: distanceY * strength,
      });
    } else {
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 120, damping: 15, mass: 0.1 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
