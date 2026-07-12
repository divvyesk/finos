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

      // Map progress (0 to 0.70) to frame index (1 to TOTAL_FRAMES)
      const frameProgress = Math.min(1, Math.max(0, progress / 0.70));
      const frameIndex = Math.min(
        TOTAL_FRAMES,
        Math.max(1, Math.ceil(frameProgress * TOTAL_FRAMES))
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

      // Implement 'cover' object-fit logic to fill screen completely
      const imgRatio = img.width / img.height;
      const canvasRatio = canvasWidth / canvasHeight;

      let renderWidth, renderHeight;

      if (canvasRatio < imgRatio) {
        renderHeight = canvasHeight;
        renderWidth = canvasHeight * imgRatio;
      } else {
        renderWidth = canvasWidth;
        renderHeight = canvasWidth / imgRatio;
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
  // Scaled by 0.70 to align with the new 0-0.70 frame sequence

  // Beat A: (0 to 0.14)
  const opacityA = useTransform(smoothProgress, [0, 0.014, 0.126, 0.14], [0, 1, 1, 0]);
  const translateYA = useTransform(smoothProgress, [0, 0.014, 0.126, 0.14], [40, 0, 0, -40]);
  const scaleA = useTransform(smoothProgress, [0, 0.014, 0.126, 0.14], [1.05, 1, 1, 0.95]);
  const filterA = useTransform(smoothProgress, [0, 0.014, 0.126, 0.14], ["blur(12px)", "blur(0px)", "blur(0px)", "blur(12px)"]);

  // Beat B: (0.175 to 0.315)
  const opacityB = useTransform(smoothProgress, [0.175, 0.189, 0.301, 0.315], [0, 1, 1, 0]);
  const translateYB = useTransform(smoothProgress, [0.175, 0.189, 0.301, 0.315], [40, 0, 0, -40]);
  const scaleB = useTransform(smoothProgress, [0.175, 0.189, 0.301, 0.315], [1.05, 1, 1, 0.95]);
  const filterB = useTransform(smoothProgress, [0.175, 0.189, 0.301, 0.315], ["blur(12px)", "blur(0px)", "blur(0px)", "blur(12px)"]);

  // Beat C: (0.583 to 0.665)
  const opacityC = useTransform(smoothProgress, [0.583, 0.595, 0.651, 0.665], [0, 1, 1, 0]);
  const translateYC = useTransform(smoothProgress, [0.583, 0.595, 0.651, 0.665], [40, 0, 0, -40]);
  const scaleC = useTransform(smoothProgress, [0.583, 0.595, 0.651, 0.665], [1.05, 1, 1, 0.95]);
  const filterC = useTransform(smoothProgress, [0.583, 0.595, 0.651, 0.665], ["blur(12px)", "blur(0px)", "blur(0px)", "blur(12px)"]);

  // Canvas background blur (starts blurring when Penny beat arrives)
  const canvasFilter = useTransform(smoothProgress, [0.70, 0.73], ["blur(0px)", "blur(15px)"]);

  // Beat E: Meet Penny (0.72 to 0.85)
  const opacityE = useTransform(smoothProgress, [0.72, 0.74, 0.83, 0.85], [0, 1, 1, 0]);
  const translateYE = useTransform(smoothProgress, [0.72, 0.74, 0.83, 0.85], [40, 0, 0, -40]);
  const scaleE = useTransform(smoothProgress, [0.72, 0.74, 0.83, 0.85], [1.05, 1, 1, 0.95]);
  const filterE = useTransform(smoothProgress, [0.72, 0.74, 0.83, 0.85], ["blur(12px)", "blur(0px)", "blur(0px)", "blur(12px)"]);

  // Beat F: Final CTA (Appears as background blurs)
  const opacityF = useTransform(smoothProgress, [0.90, 0.95], [0, 1]);
  const translateYF = useTransform(smoothProgress, [0.90, 0.95], [40, 0]);
  const scaleF = useTransform(smoothProgress, [0.90, 0.95], [1.05, 1]);
  const filterF = useTransform(smoothProgress, [0.90, 0.95], ["blur(12px)", "blur(0px)"]);

  // Indicator opacity
  const opacityIndicator = useTransform(smoothProgress, [0, 0.05], [1, 0]);

  return (
    <div
      ref={containerRef}
      style={{
        height: '800vh',
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
        {/* Persistent Logo */}
        <div style={{
          position: 'absolute',
          top: '40px',
          left: '5%',
          zIndex: 50,
          fontWeight: 800,
          fontSize: '1.5rem',
          letterSpacing: '-0.04em',
          color: '#1d1d1f',
          pointerEvents: 'none'
        }}>
          FinOS
        </div>

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
        <motion.canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: isLoaded ? 1 : 0,
            filter: canvasFilter,
            transition: 'opacity 0.5s ease'
          }}
        />

        {/* White Wash Overlay for Beat E & F Readability */}
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.75)',
            opacity: useTransform(smoothProgress, [0.70, 0.73], [0, 1]), // Fade in the white wash for Penny and CTA
            pointerEvents: 'none',
            zIndex: 5
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
            alignItems: 'flex-start',
            justifyContent: 'center',
            textAlign: 'left',
            padding: '0 5%',
            opacity: opacityA,
            y: translateYA,
            scale: scaleA,
            filter: filterA,
            zIndex: 20,
            pointerEvents: 'none'
          }}
        >
          <div style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: 'clamp(3.5rem, 8vw, 8rem)', lineHeight: 0.9, marginBottom: '1.5rem', letterSpacing: '-0.06em' }}>
              <span style={{ color: 'rgba(0,0,0,0.35)' }}>DECODE YOUR</span><br />
              <span style={{ color: '#000' }}>PAYCHECK</span>
            </h2>
            <p style={{ fontSize: 'clamp(1.15rem, 2vw, 1.5rem)', color: 'rgba(0,0,0,0.8)', maxWidth: '500px', lineHeight: 1.5, fontWeight: 500 }}>
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
            scale: scaleB,
            filter: filterB,
            zIndex: 20,
            pointerEvents: 'none'
          }}
        >
          <div style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: 'clamp(3.5rem, 8vw, 8rem)', lineHeight: 0.9, marginBottom: '1.5rem', letterSpacing: '-0.06em' }}>
              <span style={{ color: 'rgba(0,0,0,0.35)' }}>MASTER YOUR</span><br />
              <span style={{ color: '#000' }}>TAXES</span>
            </h2>
            <p style={{ fontSize: 'clamp(1.15rem, 2vw, 1.5rem)', color: 'rgba(0,0,0,0.8)', maxWidth: '500px', lineHeight: 1.5, fontWeight: 500 }}>
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
            scale: scaleC,
            filter: filterC,
            zIndex: 20,
            pointerEvents: 'none'
          }}
        >
          <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <h2 style={{ fontSize: 'clamp(3.5rem, 6.5vw, 7rem)', lineHeight: 0.9, marginBottom: '1.5rem', letterSpacing: '-0.06em', textAlign: 'right' }}>
              <span style={{ color: 'rgba(0,0,0,0.4)', display: 'block' }}>SIMULATE</span>
              <span style={{ color: 'rgba(0,0,0,0.4)', display: 'block' }}>YOUR</span>
              <span style={{ color: '#000', display: 'block' }}>ROADMAP</span>
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 1.5vw, 1.25rem)', color: 'rgba(0,0,0,0.8)', maxWidth: '400px', lineHeight: 1.5, fontWeight: 500, textAlign: 'right' }}>
              Watch your goals come to life. Track your runway, allocate your surplus, and unlock your financial future.
            </p>
          </div>
        </motion.div>

        {/* --- Beat E: Meet Penny (72-85%) --- */}
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 5%',
            opacity: opacityE,
            y: translateYE,
            scale: scaleE,
            filter: filterE,
            zIndex: 20,
            pointerEvents: 'auto'
          }}
        >
          <div style={{
            maxWidth: '1200px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '3rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6)',
            display: 'flex',
            flexDirection: 'row',
            gap: '3rem',
            alignItems: 'center'
          }}>
            {/* Penny Image */}
            <div style={{ flex: '0 0 340px', display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: '340px',
                height: '420px',
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#f0f0f0',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem'
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/headshot-no-bg.png"
                  alt="Penny, the Feline Financial Astronaut"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    // Fallback if user hasn't saved the mascot image yet
                    e.target.src = 'https://placehold.co/300x400/eeeeee/999999?text=Penny';
                  }}
                />
              </div>
            </div>

            {/* Backstory */}
            <div style={{ flex: '5' }}>
              <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: '#575c8d', marginBottom: '0.5rem' }}>
                Before we start...
              </h3>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-0.04em', color: '#1d1d1f' }}>
                Meet Penny. <br />
                <span style={{ color: 'rgba(0,0,0,0.4)' }}>Your Financial Co-Pilot.</span>
              </h2>

              <div style={{ fontSize: '1.1rem', color: 'rgba(0,0,0,0.8)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p>
                  Penny just graduated from Feline University and landed his very first "VP of Midnight Zoomies" corporate job. To celebrate, he bought a fancy three-piece suit and his favorite toy astronaut helmet—because his ultimate dream is to one day afford a trip to space (or at least buy a really, really tall cat tree).
                </p>
                <p>
                  But when Penny got his first paycheck, he was completely overwhelmed. <em>Wait, what are taxes? Why did the government take a bite out of my tuna fund?</em> He didn't know if he should blow it all on a lifetime supply of premium catnip, stash the cash under his favorite napping cushion, or what an "Emergency Shield" even was. (Was it some sort of magical forcefield to keep the dreaded Vacuum Monster at bay?)
                </p>
                <p>
                  <strong>Penny isn't an all-knowing advisor.</strong> He’s right there in the trenches with you, learning how to handle his first real paycheck. Every step you take on your roadmap, Penny takes with you!
                </p>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#575c8d', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  ↓
                </motion.div>
                Keep scrolling to start your journey
              </div>
            </div>
          </div>
        </motion.div>

        {/* --- Beat F: Final CTA (88-100%) --- */}
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
            padding: '0 5%',
            opacity: opacityF,
            y: translateYF,
            scale: scaleF,
            filter: filterF,
            zIndex: 20,
            pointerEvents: 'auto'
          }}
        >
          <style>{`
            @keyframes shimmer-text {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            .apple-gradient-text {
              background: linear-gradient(to right, #FF0080, #FF8C00, #FFCD00, #FF8C00, #FF0080);
              background-size: 200% auto;
              color: transparent;
              -webkit-background-clip: text;
              background-clip: text;
              -webkit-text-fill-color: transparent;
              animation: shimmer-text 5s linear infinite;
              display: inline-block;
            }
          `}</style>
          <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ fontSize: 'clamp(3.5rem, 8vw, 8rem)', lineHeight: 0.95, marginBottom: '2.5rem', letterSpacing: '-0.05em', fontWeight: 800 }}>
              <span style={{ color: '#1d1d1f' }}>YOUR JOURNEY</span><br />
              <span className="apple-gradient-text">STARTS HERE</span>
            </h2>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
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
          </div>
        </motion.div>

      </div>
    </div>
  );
}
