import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ============================================
// ANIMATION PRESETS
// ============================================

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3 }
};

export const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
  transition: { duration: 0.4, ease: "easeOut" }
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2, ease: "easeOut" }
};

export const popIn = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
  transition: {
    type: "spring",
    stiffness: 500,
    damping: 25
  }
};

// ============================================
// MOTION COMPONENTS
// ============================================

/**
 * FadeIn - Simple fade in animation
 */
export function FadeIn({ children, className, delay = 0, duration = 0.3, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * FadeUp - Fade in from below
 */
export function FadeUp({ children, className, delay = 0, duration = 0.4, distance = 20, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: distance }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * ScaleIn - Scale up animation (great for cards, modals)
 */
export function ScaleIn({ children, className, delay = 0, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, delay, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * PopIn - Spring-based pop animation (great for buttons, icons, badges)
 */
export function PopIn({ children, className, delay = 0, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 25,
        delay
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * SlideIn - Slide in from a direction
 */
export function SlideIn({
  children,
  className,
  direction = "right",
  delay = 0,
  distance = 20,
  ...props
}) {
  const directionMap = {
    left: { x: -distance, y: 0 },
    right: { x: distance, y: 0 },
    up: { x: 0, y: -distance },
    down: { x: 0, y: distance }
  };

  const offset = directionMap[direction];

  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, ...offset }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger - Animate children with staggered delays (great for lists)
 */
export function Stagger({
  children,
  className,
  staggerDelay = 0.1,
  initialDelay = 0,
  ...props
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: initialDelay
          }
        }
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerItem - Use inside Stagger component
 */
export function StaggerItem({ children, className, ...props }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.4, ease: "easeOut" }
        }
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * PressableScale - Scale down on press, scale up on hover
 */
export function PressableScale({
  children,
  className,
  hoverScale = 1.02,
  tapScale = 0.98,
  ...props
}) {
  return (
    <motion.div
      className={className}
      whileHover={{ scale: hoverScale }}
      whileTap={{ scale: tapScale }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Pulse - Continuous pulsing animation
 */
export function Pulse({ children, className, ...props }) {
  return (
    <motion.div
      className={className}
      animate={{
        scale: [1, 1.05, 1],
        opacity: [1, 0.8, 1]
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Glow - Animated glow effect (cyan themed for dark mode)
 */
export function Glow({ children, className, color = "rgba(0, 217, 255, 0.4)", ...props }) {
  return (
    <motion.div
      className={cn("relative", className)}
      animate={{
        boxShadow: [
          `0 0 20px ${color}`,
          `0 0 40px ${color.replace('0.4', '0.6')}`,
          `0 0 20px ${color}`
        ]
      }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Float - Floating/hovering animation
 */
export function Float({ children, className, distance = 10, duration = 3, ...props }) {
  return (
    <motion.div
      className={className}
      animate={{ y: [-distance/2, distance/2, -distance/2] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * PageTransition - Wrap screens/pages for smooth transitions
 */
export function PageTransition({ children, className, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Re-export AnimatePresence for convenience
export { AnimatePresence, motion };
