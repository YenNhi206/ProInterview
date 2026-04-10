import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';

function AvatarHead({ isSpeaking, audioLevel = 0 }) {
  const headRef = useRef(null);
  const leftEyeRef = useRef(null);
  const rightEyeRef = useRef(null);
  const mouthRef = useRef(null);
  const [blinkTime, setBlinkTime] = useState(0);

  // Animate head bob and mouth movement
  useFrame((state) => {
    if (!headRef.current || !mouthRef.current) return;

    const time = state.clock.getElapsedTime();

    // Gentle head bob when speaking
    if (isSpeaking) {
      headRef.current.rotation.y = Math.sin(time * 2) * 0.05;
      headRef.current.position.y = Math.sin(time * 3) * 0.02;
    } else {
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, 0, 0.1);
      headRef.current.position.y = THREE.MathUtils.lerp(headRef.current.position.y, 0, 0.1);
    }

    // Lip sync - mouth opens based on audio level or speaking state
    const targetMouthScale = isSpeaking 
      ? 0.3 + (audioLevel * 0.7) + Math.sin(time * 20) * 0.15 
      : 0.2;
    
    mouthRef.current.scale.y = THREE.MathUtils.lerp(
      mouthRef.current.scale.y,
      targetMouthScale,
      0.3
    );

    // Eye blink animation
    if (leftEyeRef.current && rightEyeRef.current) {
      const blinkCycle = Math.sin(time * 0.5) > 0.98 ? 1 : 0;
      const blinkScale = 1 - blinkCycle * 0.7;
      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, blinkScale, 0.3);
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, blinkScale, 0.3);
    }
  });

  return (
    <group ref={headRef}>
      {/* Head */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color="#f0d5b8" roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[0.35, 0.4, 0.6, 16]} />
        <meshStandardMaterial color="#f0d5b8" roughness={0.6} />
      </mesh>

      {/* Shoulders */}
      <mesh position={[0, -1.7, 0]}>
        <boxGeometry args={[1.8, 0.5, 0.8]} />
        <meshStandardMaterial color="#6E35E8" roughness={0.5} />
      </mesh>

      {/* Hair */}
      <mesh position={[0, 0.6, 0]} rotation={[0, 0, 0]}>
        <sphereGeometry args={[1.1, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#2d1810" roughness={0.8} />
      </mesh>

      {/* Left Eye */}
      <mesh ref={leftEyeRef} position={[-0.25, 0.15, 0.85]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
        {/* Pupil */}
        <mesh position={[0, 0, 0.08]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
          {/* Highlight */}
          <mesh position={[0.02, 0.02, 0.03]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
          </mesh>
        </mesh>
      </mesh>

      {/* Right Eye */}
      <mesh ref={rightEyeRef} position={[0.25, 0.15, 0.85]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
        {/* Pupil */}
        <mesh position={[0, 0, 0.08]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
          {/* Highlight */}
          <mesh position={[0.02, 0.02, 0.03]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
          </mesh>
        </mesh>
      </mesh>

      {/* Nose */}
      <mesh position={[0, -0.05, 0.95]}>
        <coneGeometry args={[0.1, 0.25, 8]} />
        <meshStandardMaterial color="#e8c5a8" roughness={0.7} />
      </mesh>

      {/* Mouth */}
      <mesh ref={mouthRef} position={[0, -0.35, 0.88]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.15, 0.05, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#8b4f47" roughness={0.5} />
      </mesh>

      {/* Eyebrows */}
      <mesh position={[-0.25, 0.35, 0.88]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.3, 0.06, 0.08]} />
        <meshStandardMaterial color="#2d1810" />
      </mesh>
      <mesh position={[0.25, 0.35, 0.88]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.3, 0.06, 0.08]} />
        <meshStandardMaterial color="#2d1810" />
      </mesh>
    </group>
  );
}

function Scene({ isSpeaking, audioLevel }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
      <OrbitControls 
        enableZoom={false} 
        enablePan={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 2}
        minAzimuthAngle={-Math.PI / 6}
        maxAzimuthAngle={Math.PI / 6}
      />
      
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.4} />
      <pointLight position={[0, 2, 3]} intensity={0.5} color="#B4F500" />
      
      {/* Avatar */}
      <AvatarHead isSpeaking={isSpeaking} audioLevel={audioLevel} />
      
      {/* Environment */}
      <Environment preset="city" />
    </>
  );
}

export function AvatarInterviewer({ isSpeaking, audioLevel = 0, currentText }) {
  const [localAudioLevel, setLocalAudioLevel] = useState(0);

  // Simulate audio level if not provided
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

  return (
    <div className="relative w-full h-full">
      <Canvas
        shadows
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <Scene isSpeaking={isSpeaking} audioLevel={localAudioLevel} />
        </Suspense>
      </Canvas>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 bg-lime-400 rounded-full animate-pulse"
                style={{
                  height: '16px',
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '0.6s',
                }}
              />
            ))}
          </div>
          <span className="text-white text-xs font-medium">AI đang nói...</span>
        </div>
      )}

      {/* Current text display */}
      {currentText && (
        <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 max-w-md px-4 py-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
          <p className="text-white text-sm text-center">{currentText}</p>
        </div>
      )}
    </div>
  );
}
