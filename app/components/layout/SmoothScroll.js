"use client";

import { ReactLenis, useLenis } from 'lenis/react';
import { useEffect, useRef } from 'react';

function SnapHandler() {
  const lenis = useLenis();
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!lenis) return;

    const handleScroll = (e) => {
      clearTimeout(timeoutRef.current);
      
      // Wait 150ms after scroll stops to trigger snap
      timeoutRef.current = setTimeout(() => {
        const sections = document.querySelectorAll('[data-snap-section]');
        let closestSection = null;
        let minDistance = Infinity;
        
        sections.forEach(section => {
          const rect = section.getBoundingClientRect();
          const distance = Math.abs(rect.top); 
          
          if (distance < minDistance) {
            minDistance = distance;
            closestSection = section;
          }
        });

        // Snap if nearest section is within 400px and not already there
        if (closestSection && minDistance > 5 && minDistance < 400) {
          lenis.scrollTo(closestSection, { duration: 1.2, offset: -80 });
        }
      }, 150);
    };

    lenis.on('scroll', handleScroll);

    return () => {
      lenis.off('scroll', handleScroll);
      clearTimeout(timeoutRef.current);
    };
  }, [lenis]);

  return null;
}

export default function SmoothScroll({ children }) {
  return (
    <ReactLenis root options={{ 
      lerp: 0.05, 
      duration: 1.5,
      smoothWheel: true,
      wheelMultiplier: 1,
    }}>
      <SnapHandler />
      {children}
    </ReactLenis>
  );
}
