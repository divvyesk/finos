'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';

const TOTAL_FRAMES = 270;

export default function MascotScrollytelling({ user }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  
  const imagesRef = useRef([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Framer Motion scroll hooks
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Preload images (Adaptive Interlaced Loading)
  useEffect(() => {
    let loadedOddCount = 0;
    const targetOddCount = Math.floor((TOTAL_FRAMES + 1) / 2); // 135

    const loadEvenFrames = () => {
      for (let i = 2; i <= TOTAL_FRAMES; i += 2) {
        const img = new Image();
        const paddedIndex = i.toString().padStart(5, '0');
        img.onload = () => {
          imagesRef.current[i] = img;
        };
        img.src = `/frames60/frame_${paddedIndex}.jpg`;
      }
    };

    // Phase 1: Load odd frames (30fps baseline)
    for (let i = 1; i <= TOTAL_FRAMES; i += 2) {
      const img = new Image();
      const paddedIndex = i.toString().padStart(5, '0');
      
      img.onload = () => {
        imagesRef.current[i] = img;
        loadedOddCount++;
        if (loadedOddCount === targetOddCount) {
          setIsLoaded(true); // Unlock UI (30fps ready)
          loadEvenFrames();  // Start Phase 2 (60fps upgrade)
        }
      };
      
      img.src = `/frames60/frame_${paddedIndex}.jpg`;
    }
  }, []);

  // Canvas drawing logic
  useEffect(() => {
    if (!isLoaded || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set internal resolution based on device pixel ratio for crisp rendering
    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      // Get logical size of the container
      const rect = canvas.parentElement.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      ctx.scale(dpr, dpr);
      
      // Draw immediately on resize
      drawFrame(smoothProgress.get());
    };

    const drawFrame = (progress) => {
      if (!ctx || !imagesRef.current.length) return;
      
      // Map progress (0 to 1) to frame index (1 to TOTAL_FRAMES)
      const frameIndex = Math.min(
        TOTAL_FRAMES,
        Math.max(1, Math.ceil(progress * TOTAL_FRAMES))
      );
      
      // Fallback: If current frame isn't loaded (Phase 2 still running), use the nearest previous loaded frame
      let img = imagesRef.current[frameIndex];
      if (!img || !img.complete) {
        for (let i = frameIndex - 1; i >= 1; i--) {
          if (imagesRef.current[i] && imagesRef.current[i].complete) {
            img = imagesRef.current[i];
            break;
          }
        }
      }
      
      if (!img || !img.complete) return;

      const rect = canvas.parentElement.getBoundingClientRect();
      const canvasWidth = rect.width;
      const canvasHeight = rect.height;

      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // Implement 'contain' object-fit logic
      const imgRatio = img.width / img.height;
      const canvasRatio = canvasWidth / canvasHeight;
      
      let renderWidth, renderHeight;
      
      if (canvasRatio < imgRatio) {
        renderWidth = canvasWidth;
        renderHeight = canvasWidth / imgRatio;
      } else {
        renderHeight = canvasHeight;
        renderWidth = canvasHeight * imgRatio;
      }
      
      const offsetX = (canvasWidth - renderWidth) / 2;
      const offsetY = (canvasHeight - renderHeight) / 2;

      ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);
    };

    window.addEventListener('resize', updateCanvasSize);
    updateCanvasSize(); // Initial setup

    // Subscribe to scroll changes
    const unsubscribe = smoothProgress.on('change', (latest) => {
      // Use requestAnimationFrame to sync with browser render cycle
      requestAnimationFrame(() => drawFrame(latest));
    });

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      unsubscribe();
    };
  }, [isLoaded, smoothProgress]);

  // -- Text Overlay Animations --
  // Beat A: 0-20% (0.0 to 0.2)
  const opacityA = useTransform(smoothProgress, [0, 0.02, 0.18, 0.2], [0, 1, 1, 0]);
  const translateYA = useTransform(smoothProgress, [0, 0.02, 0.18, 0.2], [20, 0, 0, -20]);

  // Beat B: 25-45% (0.25 to 0.45)
  const opacityB = useTransform(smoothProgress, [0.25, 0.27, 0.43, 0.45], [0, 1, 1, 0]);
  const translateYB = useTransform(smoothProgress, [0.25, 0.27, 0.43, 0.45], [20, 0, 0, -20]);

  // Beat C: 50-70% (0.5 to 0.7)
  const opacityC = useTransform(smoothProgress, [0.5, 0.52, 0.68, 0.7], [0, 1, 1, 0]);
  const translateYC = useTransform(smoothProgress, [0.5, 0.52, 0.68, 0.7], [20, 0, 0, -20]);

  // Beat D: 75-95% (0.75 to 0.95)
  const opacityD = useTransform(smoothProgress, [0.75, 0.77, 0.93, 0.95], [0, 1, 1, 0]);
  const translateYD = useTransform(smoothProgress, [0.75, 0.77, 0.93, 0.95], [20, 0, 0, -20]);
  
  // Indicator opacity
  const opacityIndicator = useTransform(smoothProgress, [0, 0.05], [1, 0]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        height: '400vh', 
        position: 'relative',
        backgroundColor: '#e5e5e5' // Match seamless background
      }}
    >
      <div 
        style={{ 
          position: 'sticky', 
          top: 0, 
          height: '100vh', 
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Loading State */}
        {!isLoaded && (
          <motion.div
            animate={{
              y: [0, -15, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              position: 'absolute',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              color: 'rgba(0,0,0,0.6)'
            }}
          >
            {/* Display the first frame as the bouncing placeholder if we can load it quickly, 
                or just a CSS placeholder if we want to be safe */}
            <div style={{
              width: '120px', 
              height: '120px', 
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span className="loading-spinner" style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: '#000' }}></span>
            </div>
            <p style={{ fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.85rem' }}>
              Waking up FinOS...
            </p>
          </motion.div>
        )}

        {/* Canvas for Scrollytelling */}
        <canvas 
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.5s ease'
          }}
        />

        {/* Scroll Indicator */}
        {isLoaded && (
          <motion.div
            style={{
              position: 'absolute',
              bottom: '40px',
              left: '50%',
              x: '-50%',
              opacity: opacityIndicator,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              color: 'rgba(0,0,0,0.4)',
              pointerEvents: 'none',
              zIndex: 20
            }}
          >
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Scroll to Explore</span>
            <motion.div 
              animate={{ y: [0, 8, 0] }} 
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: '1px', height: '30px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)' }}
            />
          </motion.div>
        )}

        {/* --- Beat A: 0-20% --- */}
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 2rem',
            opacity: opacityA,
            y: translateYA,
            zIndex: 20,
            pointerEvents: 'none'
          }}
        >
          <div style={{ maxWidth: '800px' }}>
            <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 5rem)', lineHeight: 1, marginBottom: '1rem', letterSpacing: '-0.05em' }}>
              DECODE YOUR<br />PAYCHECK
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: 'rgba(0,0,0,0.6)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
              Finance is intimidating. FinOS makes it yours. Welcome to your personalized financial roadmap.
            </p>
          </div>
        </motion.div>

        {/* --- Beat B: 25-45% --- */}
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '0 5%',
            opacity: opacityB,
            y: translateYB,
            zIndex: 20,
            pointerEvents: 'none'
          }}
        >
          <div style={{ maxWidth: '500px' }}>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', lineHeight: 1.1, marginBottom: '1rem', letterSpacing: '-0.04em' }}>
              MASTER YOUR<br />TAXES
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 1.5vw, 1.15rem)', color: 'rgba(0,0,0,0.6)', lineHeight: 1.6 }}>
              We extract the noise from your offer letter and show exactly what you take home. No jargon, just math.
            </p>
          </div>
        </motion.div>

        {/* --- Beat C: 50-70% --- */}
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'center',
            textAlign: 'right',
            padding: '0 5%',
            opacity: opacityC,
            y: translateYC,
            zIndex: 20,
            pointerEvents: 'none'
          }}
        >
          <div style={{ maxWidth: '500px' }}>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', lineHeight: 1.1, marginBottom: '1rem', letterSpacing: '-0.04em' }}>
              SIMULATE YOUR<br />ROADMAP
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 1.5vw, 1.15rem)', color: 'rgba(0,0,0,0.6)', lineHeight: 1.6 }}>
              Watch your goals come to life. Track your runway, allocate your surplus, and unlock your financial future.
            </p>
          </div>
        </motion.div>

        {/* --- Beat D: 75-95% --- */}
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 2rem',
            opacity: opacityD,
            y: translateYD,
            zIndex: 20,
            pointerEvents: 'auto'
          }}
        >
          <div style={{ maxWidth: '800px' }}>
            <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', lineHeight: 1.1, marginBottom: '2rem', letterSpacing: '-0.05em' }}>
              YOUR JOURNEY<br />STARTS HERE
            </h2>
            {user ? (
              <a href="/dashboard" className="btn btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', borderRadius: '50px' }}>
                Go to Dashboard
              </a>
            ) : (
              <a href="/signup" className="btn btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', borderRadius: '50px' }}>
                Start My Financial Journey
              </a>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
