import confetti from "canvas-confetti";

/**
 * Triggers a "side-burst" fireworks effect from both bottom corners.
 * Lighter version with fewer particles.
 */
export const triggerSideFireworks = () => {
  const defaults = { startVelocity: 25, spread: 40, ticks: 60, zIndex: 10000, particleCount: 30 };

  // Launch once from left side
  confetti({
    ...defaults,
    origin: { x: 0.1, y: 0.9 }
  });

  // Launch once from right side
  confetti({
    ...defaults,
    origin: { x: 0.9, y: 0.9 }
  });
};

export const triggerConfetti = () => {
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    zIndex: 10000
  });
};
