import { motion, useReducedMotion } from "motion/react";

const revealElements = { article: motion.article, div: motion.div };
const ease = [0.22, 1, 0.36, 1];

/** Reveal once on entering the viewport, with a capped delay for long lists. */
export function AccountReveal({ as = "div", index = 0, className = "", children, ...props }) {
  const reduceMotion = useReducedMotion();
  const Element = revealElements[as] || motion.div;
  return (
    <Element
      {...props}
      className={`account-reveal ${className}`}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={reduceMotion ? { opacity: 1, y: 0 } : undefined}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: reduceMotion ? 0 : 0.42, delay: reduceMotion ? 0 : Math.min(index, 3) * 0.045, ease }}
    >
      {children}
    </Element>
  );
}

/** Move only the selection surface; labels and keyboard focus stay still. */
export function AccountTabIndicator({ layoutId, underline = false }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.i
      aria-hidden="true"
      className={`account-tab-indicator${underline ? " account-tab-indicator--underline" : ""}`}
      layoutId={layoutId}
      initial={false}
      transition={{ duration: reduceMotion ? 0 : 0.24, ease }}
    />
  );
}
