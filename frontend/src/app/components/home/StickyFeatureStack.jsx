import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const StackedCard = ({ children, index, total, targetScale, range }) => {
  const containerRef = useRef(null);
  
  // We track the scroll progress of the WHOLE stack container, not just this card.
  // Actually, standard way is to track the target's wrapper.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'start start']
  });

  return (
    <div 
      ref={containerRef}
      className="sticky w-full flex justify-center"
      style={{ 
        top: `calc(10vh + ${index * 24}px)`, 
        zIndex: index,
        marginBottom: index === total - 1 ? '10vh' : '50vh' // Space between cards
      }}
    >
      <motion.div 
        className="w-full origin-top"
      >
        {children}
      </motion.div>
    </div>
  );
};

export const StickyFeatureStack = ({ children }) => {
  const childrenArray = React.Children.toArray(children);
  const total = childrenArray.length;

  return (
    <div className="relative w-full max-w-[600px] mx-auto">
      {childrenArray.map((child, index) => {
        const targetScale = 1 - (total - 1 - index) * 0.05;
        return (
          <StackedCard 
            key={index} 
            index={index} 
            total={total} 
            targetScale={targetScale}
          >
             {child}
          </StackedCard>
        );
      })}
    </div>
  );
};
