import React, { useRef, useEffect, useState } from 'react';

/**
 * Simplified 2D Avatar Interviewer with CSS-based lip sync
 * No Three.js dependencies - pure CSS/SVG animation
 */
export function AvatarInterviewerSimple({ 
  isSpeaking, 
  audioLevel = 0,
  currentText 
}) {
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [blinkState, setBlinkState] = useState(false);

  // Simulate audio level if speaking but no level provided
  useEffect(() => {
    if (isSpeaking && audioLevel === 0) {
      const interval = setInterval(() => {
        setLocalAudioLevel(Math.random() * 0.6 + 0.2);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setLocalAudioLevel(audioLevel);
    }
  }, [isSpeaking, audioLevel]);

  // Eye blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinkState(true);
      setTimeout(() => setBlinkState(false), 150);
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, []);

  // Calculate mouth opening based on audio level
  const mouthOpen = isSpeaking ? 10 + (localAudioLevel * 20) : 2;
  const headBob = isSpeaking ? Math.sin(Date.now() / 200) * 2 : 0;

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-b from-purple-50 to-purple-100 dark:from-gray-900 dark:to-gray-800">
      {/* Background circles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-300/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-lime-300/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Avatar SVG */}
      <svg 
        width="300" 
        height="400" 
        viewBox="0 0 300 400" 
        className="relative z-10"
        style={{ 
          transform: `translateY(${headBob}px)`,
          transition: isSpeaking ? 'none' : 'transform 0.3s ease'
        }}
      >
        {/* Shoulders */}
        <ellipse 
          cx="150" 
          cy="380" 
          rx="120" 
          ry="60" 
          fill="url(#shoulderGradient)" 
        />

        {/* Neck */}
        <rect 
          x="130" 
          y="280" 
          width="40" 
          height="100" 
          fill="#f0d5b8" 
          rx="10"
        />

        {/* Head */}
        <ellipse 
          cx="150" 
          cy="150" 
          rx="90" 
          ry="110" 
          fill="#f0d5b8" 
        />

        {/* Hair */}
        <ellipse 
          cx="150" 
          cy="80" 
          rx="95" 
          ry="90" 
          fill="#2d1810" 
        />
        
        {/* Hair front */}
        <path 
          d="M 60 130 Q 80 60, 150 50 Q 220 60, 240 130" 
          fill="#2d1810" 
        />

        {/* Left eyebrow */}
        <ellipse 
          cx="110" 
          cy="125" 
          rx="25" 
          ry="6" 
          fill="#2d1810"
          style={{ 
            transform: isSpeaking ? 'translateY(-2px)' : 'none',
            transition: 'transform 0.3s ease'
          }}
        />

        {/* Right eyebrow */}
        <ellipse 
          cx="190" 
          cy="125" 
          rx="25" 
          ry="6" 
          fill="#2d1810"
          style={{ 
            transform: isSpeaking ? 'translateY(-2px)' : 'none',
            transition: 'transform 0.3s ease'
          }}
        />

        {/* Left eye white */}
        <ellipse 
          cx="110" 
          cy="145" 
          rx="18" 
          ry={blinkState ? "2" : "18"} 
          fill="#ffffff"
          style={{ transition: 'ry 0.1s ease' }}
        />

        {/* Left eye pupil */}
        {!blinkState && (
          <>
            <circle cx="110" cy="145" r="10" fill="#1a1a1a" />
            <circle cx="113" cy="142" r="4" fill="#ffffff" opacity="0.8" />
          </>
        )}

        {/* Right eye white */}
        <ellipse 
          cx="190" 
          cy="145" 
          rx="18" 
          ry={blinkState ? "2" : "18"} 
          fill="#ffffff"
          style={{ transition: 'ry 0.1s ease' }}
        />

        {/* Right eye pupil */}
        {!blinkState && (
          <>
            <circle cx="190" cy="145" r="10" fill="#1a1a1a" />
            <circle cx="193" cy="142" r="4" fill="#ffffff" opacity="0.8" />
          </>
        )}

        {/* Nose */}
        <ellipse 
          cx="150" 
          cy="170" 
          rx="8" 
          ry="15" 
          fill="#e8c5a8" 
        />

        {/* Mouth - animated based on audio level */}
        <ellipse 
          cx="150" 
          cy="200" 
          rx="25" 
          ry={mouthOpen} 
          fill="#8b4f47"
          style={{ 
            transition: isSpeaking ? 'ry 0.05s ease' : 'ry 0.3s ease'
          }}
        />

        {/* Inner mouth */}
        {isSpeaking && mouthOpen > 8 && (
          <ellipse 
            cx="150" 
            cy="200" 
            rx="18" 
            ry={mouthOpen - 4} 
            fill="#4a1f1a"
            style={{ 
              transition: 'ry 0.05s ease'
            }}
          />
        )}

        {/* Gradients */}
        <defs>
          <linearGradient id="shoulderGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6E35E8" />
            <stop offset="100%" stopColor="#9B6DFF" />
          </linearGradient>
        </defs>
      </svg>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-md border border-purple-200 dark:border-purple-700 shadow-lg">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 bg-lime-500 rounded-full"
                style={{
                  height: '16px',
                  animation: 'pulse 0.6s ease-in-out infinite',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
          <span className="text-purple-900 dark:text-white text-xs font-medium">AI đang nói...</span>
        </div>
      )}

      {/* Current text display */}
      {currentText && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 max-w-md px-4 py-3 rounded-xl bg-white/90 dark:bg-black/80 backdrop-blur-md border border-purple-200 dark:border-purple-700 shadow-xl">
          <p className="text-gray-900 dark:text-white text-sm text-center">{currentText}</p>
        </div>
      )}
    </div>
  );
}
