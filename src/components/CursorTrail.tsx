"use client";

import { useEffect } from "react";

export default function CursorTrail() {
  useEffect(() => {
    if (
      !window.matchMedia("(pointer:fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const dots = Array.from(
      document.querySelectorAll<HTMLElement>(".cursor-trail-dot"),
    );
    if (dots.length === 0) {
      return;
    }

    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const trail = dots.map(() => ({ ...mouse }));
    let frameId = 0;

    const onMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };

    const animate = () => {
      trail[0].x += (mouse.x - trail[0].x) * 0.28;
      trail[0].y += (mouse.y - trail[0].y) * 0.28;

      for (let index = 1; index < trail.length; index += 1) {
        trail[index].x += (trail[index - 1].x - trail[index].x) * 0.28;
        trail[index].y += (trail[index - 1].y - trail[index].y) * 0.28;
      }

      dots.forEach((dot, index) => {
        const scale = 1 - index * 0.1;
        dot.style.transform = `translate3d(${trail[index].x - 6}px, ${
          trail[index].y - 6
        }px, 0) scale(${Math.max(scale, 0.2)})`;
      });

      frameId = window.requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="cursor-trail" aria-hidden>
      {Array.from({ length: 8 }).map((_, index) => (
        <span key={index} className="cursor-trail-dot" />
      ))}
    </div>
  );
}
