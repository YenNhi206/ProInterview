import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

const EASE = [0.22, 1, 0.36, 1];
const EASE_OUT = [0.16, 1, 0.3, 1];
const EASE_BOUNCE = [0.22, 1, 0.36, 1];

/** Preset hiệu ứng theo section, mỗi block landing một “cảm giác” khác */
export const SECTION_MOTION = {
  /** Hero: copy, blur + trượt lên */
  heroCopy: {
    hidden: { opacity: 0, y: 28, scale: 0.98, filter: "blur(10px)" },
    visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
    duration: 0.72,
  },
  /** Hero: video, từ phải + scale nhẹ */
  heroVideo: {
    hidden: { opacity: 0, x: 48, scale: 0.9, rotate: 3 },
    visible: { opacity: 1, x: 0, scale: 1, rotate: 0 },
    duration: 0.68,
    ease: EASE_BOUNCE,
  },
  /** Hero: stats, nổi từ dưới */
  heroStats: {
    hidden: { opacity: 0, y: 36, scale: 0.94 },
    visible: { opacity: 1, y: 0, scale: 1 },
    duration: 0.58,
  },
  /** 4 bước: header, fade + trượt (không clipPath, dễ nuốt mascot) */
  featuresHead: {
    hidden: { opacity: 0, y: 28, scale: 0.97 },
    visible: { opacity: 1, y: 0, scale: 1 },
    duration: 0.6,
    ease: EASE_OUT,
  },
  /** 4 bước: từng card, xen kẽ trái/phải */
  featuresStep: (index) => ({
    hidden: {
      opacity: 0,
      y: 44,
      x: index % 2 === 0 ? -28 : 28,
      rotate: index % 2 === 0 ? -3 : 3,
      scale: 0.92,
    },
    visible: { opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 },
    duration: 0.62,
  }),
  /** CV, skew nhẹ + trượt lên */
  cv: {
    hidden: { opacity: 0, y: 52, skewY: 4, scale: 0.97 },
    visible: { opacity: 1, y: 0, skewY: 0, scale: 1 },
    duration: 0.68,
  },
  /** Mentor, từ phải, perspective */
  mentor: {
    hidden: { opacity: 0, x: 64, rotateY: -8, scale: 0.96 },
    visible: { opacity: 1, x: 0, rotateY: 0, scale: 1 },
    duration: 0.7,
    ease: EASE_OUT,
  },
  /** Khóa học, từ trái + bounce */
  courses: {
    hidden: { opacity: 0, x: -56, scale: 0.94 },
    visible: { opacity: 1, x: 0, scale: 1 },
    duration: 0.65,
    ease: EASE_BOUNCE,
  },
  /** AI Interview: từ dưới + blur nhẹ */
  interview: {
    hidden: { opacity: 0, y: 48, scale: 0.97, filter: "blur(6px)" },
    visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
    duration: 0.68,
    ease: EASE_OUT,
  },
  /** Testimonials: copy */
  testimonialCopy: {
    hidden: { opacity: 0, x: -40, filter: "blur(4px)" },
    visible: { opacity: 1, x: 0, filter: "blur(0px)" },
    duration: 0.6,
  },
  /** Testimonials: marquee */
  testimonialMarquee: {
    hidden: { opacity: 0, scale: 0.9, y: 24 },
    visible: { opacity: 1, scale: 1, y: 0 },
    duration: 0.72,
    ease: EASE_BOUNCE,
  },
};

function useSectionInView(once = true, variant) {
  const ref = useRef(null);
  const inView = useInView(ref, {
    once,
    // Header 4 bước thấp hơn cards, cần threshold thấp để không kẹt opacity:0
    amount: variant === "featuresHead" ? 0.08 : 0.16,
    margin: variant === "featuresHead" ? "0px 0px -12% 0px" : "-8% 0px -5% 0px",
  });
  return { ref, inView };
}

/** Reveal theo preset section, thay cho LandingReveal generic */
export function SectionReveal({
  children,
  className = "",
  variant = "heroCopy",
  stepIndex,
  delay = 0,
  once = true,
  style,
}) {
  const { ref, inView } = useSectionInView(once, variant);
  const reduceMotion = useReducedMotion();

  const preset =
    variant === "featuresStep" && typeof stepIndex === "number"
      ? SECTION_MOTION.featuresStep(stepIndex)
      : SECTION_MOTION[variant] ?? SECTION_MOTION.heroCopy;

  const { hidden, visible, duration, ease = EASE } = preset;

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={reduceMotion ? visible : hidden}
      animate={reduceMotion || inView ? visible : hidden}
      transition={{ duration, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

/** Section 4 bước, hiệu ứng gốc (blur + trượt) */
export function LandingReveal({
  children,
  className = "",
  delay = 0,
  y = 32,
  once = true,
}) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const inView = useInView(ref, {
    once,
    amount: 0.18,
    margin: "-10% 0px -6% 0px",
  });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduceMotion ? { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" } : { opacity: 0, y, scale: 0.98, filter: "blur(8px)" }}
      animate={
        reduceMotion || inView
          ? { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
          : { opacity: 0, y, scale: 0.98, filter: "blur(8px)" }
      }
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function LandingStagger({ children, className = "", stagger = 0.12, once = true }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const inView = useInView(ref, { once, amount: 0.15, margin: "-8% 0px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={reduceMotion || inView ? "show" : "hidden"}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: 0.05 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function LandingItem({ children, className = "" }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={
        reduceMotion
          ? {
              hidden: { opacity: 1, y: 0, scale: 1 },
              show: { opacity: 1, y: 0, scale: 1 },
            }
          : {
              hidden: { opacity: 0, y: 28, scale: 0.94 },
              show: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: 0.6, ease: EASE },
              },
            }
      }
    >
      {children}
    </motion.div>
  );
}

/** Hero stats, pop từng ô */
export function HeroStatItem({ children, className = "" }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={
        reduceMotion
          ? { hidden: { opacity: 1, scale: 1 }, show: { opacity: 1, scale: 1 } }
          : {
              hidden: { opacity: 0, y: 20, scale: 0.82 },
              show: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: 0.5, ease: EASE_BOUNCE },
              },
            }
      }
    >
      {children}
    </motion.div>
  );
}
