"use client";

import React, { useCallback } from "react";

interface GradientSpotlightProps {
  className?: string;
  children?: React.ReactNode;
}

const GradientSpotlight: React.FC<GradientSpotlightProps> = ({ className = "", children }) => {
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty("--spot-x", `${x}%`);
    e.currentTarget.style.setProperty("--spot-y", `${y}%`);
  }, []);

  return (
    <div onMouseMove={onMove} className={`relative bg-hero transition-[background] duration-300 ${className}`}>
      {children}
    </div>
  );
};

export default GradientSpotlight;
