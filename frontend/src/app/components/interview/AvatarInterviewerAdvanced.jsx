import React, { useRef, useEffect, useState } from 'react';
import { AvatarInterviewer } from './AvatarInterviewer';

/**
 * Advanced Avatar Interviewer with Text-to-Speech integration
 * Uses Web Speech API for real-time lip sync with actual audio
 */
export function AvatarInterviewerAdvanced({ 
  text, 
  autoSpeak = true,
  onSpeakEnd 
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentText, setCurrentText] = useState();
  
  const synthRef = useRef(null);
  const utteranceRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef();

  // Initialize Speech Synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Analyze audio level for lip sync
  const analyzeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = Math.min(average / 128, 1); // Normalize to 0-1

    setAudioLevel(normalizedLevel);

    if (isSpeaking) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    }
  };

  // Speak text using Web Speech API
  const speak = (textToSpeak) => {
    if (!synthRef.current || !textToSpeak) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utteranceRef.current = utterance;

    // Configure voice (prefer Vietnamese if available)
    const voices = synthRef.current.getVoices();
    const vietnameseVoice = voices.find(voice => 
      voice.lang.includes('vi') || voice.name.includes('Vietnamese')
    );
    if (vietnameseVoice) {
      utterance.voice = vietnameseVoice;
    }

    utterance.lang = 'vi-VN';
    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setCurrentText(textToSpeak);
      
      // Start audio analysis (if Web Audio API available)
      if (typeof AudioContext !== 'undefined') {
        try {
          audioContextRef.current = new AudioContext();
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          
          // Note: We can't directly connect SpeechSynthesis to Web Audio API
          // So we'll simulate audio level based on speech progress
          simulateAudioLevel();
        } catch (err) {
          console.warn('Web Audio API not available:', err);
          simulateAudioLevel();
        }
      } else {
        simulateAudioLevel();
      }
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setAudioLevel(0);
      setCurrentText(undefined);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      onSpeakEnd?.();
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
      setAudioLevel(0);
    };

    synthRef.current.speak(utterance);
  };

  // Simulate audio level when we can't analyze real audio
  const simulateAudioLevel = () => {
    const animate = () => {
      if (!isSpeaking) return;
      
      // Simulate natural speech patterns
      const baseLevel = 0.4;
      const variation = Math.random() * 0.4;
      const pulse = Math.sin(Date.now() / 100) * 0.2;
      
      setAudioLevel(Math.max(0, Math.min(1, baseLevel + variation + pulse)));
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
  };

  // Auto-speak when text changes
  useEffect(() => {
    if (text && autoSpeak) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => speak(text), 300);
      return () => clearTimeout(timer);
    }
  }, [text, autoSpeak]);

  // Stop speaking when component unmounts
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <AvatarInterviewer 
        isSpeaking={isSpeaking}
        audioLevel={audioLevel}
        currentText={currentText}
      />

      {/* Manual controls (optional) */}
      {text && !autoSpeak && !isSpeaking && (
        <button
          onClick={() => speak(text)}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-all hover:scale-105"
        >
          Phát audio
        </button>
      )}
    </div>
  );
}

// Hook for using avatar with custom audio source
export function useAvatarAudio() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef();

  const connectAudioElement = (audioElement) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
    }

    // Connect audio element to analyser
    if (!sourceRef.current) {
      sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }

    audioElement.onplay = () => {
      setIsSpeaking(true);
      startAnalysis();
    };

    audioElement.onpause = () => {
      setIsSpeaking(false);
      stopAnalysis();
    };

    audioElement.onended = () => {
      setIsSpeaking(false);
      stopAnalysis();
    };
  };

  const startAnalysis = () => {
    const analyze = () => {
      if (!analyserRef.current) return;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setAudioLevel(Math.min(average / 128, 1));

      animationFrameRef.current = requestAnimationFrame(analyze);
    };
    analyze();
  };

  const stopAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setAudioLevel(0);
  };

  useEffect(() => {
    return () => {
      stopAnalysis();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    isSpeaking,
    audioLevel,
    connectAudioElement,
  };
}
