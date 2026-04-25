import type { Transition } from 'framer-motion'

/** Eased tween for layout/size reflows; zero duration when reduced motion is preferred. */
export function layoutEaseTransition(
  prefersReducedMotion: boolean | null,
): Transition {
  if (prefersReducedMotion) return { duration: 0 }
  return {
    type: 'tween',
    duration: 0.22,
    ease: [0.22, 1, 0.36, 1],
  }
}
