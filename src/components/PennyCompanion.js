'use client';

import { useState, useEffect } from 'react';

// Simple Typewriter hook
function useTypewriter(text, speed = 30) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');
    if (!text) return;

    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return displayedText;
}

export default function PennyCompanion({
  user,
  activeStep,
  pipelineStage,
  manualMode,
  validationPassed,
  isReturningUser,
  taxWait,
  pennyMode,
  pennyIndex,
  setPennyIndex,
  taxExplanation,
  roadmapConfirmed,
  checklistEncouragement
}) {
  const [pennyState, setPennyState] = useState({
    image: '/headshot-no-bg.png',
    text: ''
  });

  useEffect(() => {
    // Determine image and text based on props
    let img = '/headshot-no-bg.png';
    let txt = '';

    if (activeStep === 0) {
      if (pipelineStage === 'idle') {
        img = '/headshot-no-bg.png';
        const greeting = isReturningUser ? `Welcome back ${user?.name || ''}, let's start from where we left off?` : `Hello ${user?.name || ''}!`;
        txt = `${greeting} Drop your first offer letter here on the right! Let's sniff out those numbers together.`;
      } else if (['uploading', 'ocr', 'extracting'].includes(pipelineStage)) {
        img = '/investigation.png';
        txt = "Sniff, sniff... hunting for the juicy kibble (aka your salary and benefits) in this document!";
      } else if (pipelineStage === 'validating') {
        img = '/investigation.png';
        txt = "Just making sure the math adds up...";
      } else if (pipelineStage === 'error') {
        img = '/confused.png';
        txt = "Oops! I hit a snag. Something doesn't look right with this document.";
      } else if (pipelineStage === 'done') {
        if (validationPassed) {
          img = '/happy.png';
          txt = "Purr-fect! I found your numbers. Review them on the right to make sure I got it right.";
        } else {
          img = '/confused.png';
          txt = "Oops! I couldn't find some important details. Can you check the warnings and fill them in manually for me?";
        }
      }
    } else if (activeStep === 1) {
      if (taxWait) {
        img = '/smirking.png';
        txt = "Don't get too excited by that big number just yet! Let's check how much you actually get to take home.";
      } else if (pennyMode === 'insights' && taxExplanation?.insights?.length > 0) {
        img = '/headshot-no-bg.png';
        txt = taxExplanation.insights[pennyIndex];
      } else if (pennyMode === 'faqs' && taxExplanation?.faqs?.length > 0) {
        img = '/headshot-no-bg.png';
        txt = taxExplanation.faqs[pennyIndex].question + "\n\n" + taxExplanation.faqs[pennyIndex].answer;
      } else {
        img = '/headshot-no-bg.png';
        txt = "Ouch! Taxes take a bite. Try adjusting your pre-tax contribution rate below to see how it changes your take-home pay!";
      }
    } else if (activeStep === 2) {
      if (checklistEncouragement) {
        img = '/happy.png';
        txt = "Great job! You're making purr-fect progress on your roadmap!";
      } else if (pennyMode === 'workspace') {
        img = '/headshot-no-bg.png';
        txt = "I am ready to help you with this step! Click the 'Chat with Penny' button in your workspace to ask me questions.";
      } else if (roadmapConfirmed) {
        img = '/happy.png';
        txt = "Hooray! Your roadmap is locked in. You are on your way to financial mastery!";
      } else {
        img = '/headshot-no-bg.png';
        txt = "Here is your baseline. Let's define your goals and build a roadmap. I can help answer your questions!";
      }
    }

    setPennyState({ image: img, text: txt });
  }, [user, activeStep, pipelineStage, manualMode, validationPassed, isReturningUser, taxWait, pennyMode, pennyIndex, taxExplanation, roadmapConfirmed, checklistEncouragement]);

  const typedText = useTypewriter(pennyState.text, 25);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'sticky',
      top: '12rem',
      gap: '1.5rem',
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-light)',
        borderRadius: '16px',
        padding: (activeStep === 1 && pennyMode !== 'none') ? '1.0rem 2.5rem' : '1.5rem',
        width: (activeStep === 1 && pennyMode !== 'none') ? 'max-content' : '100%',
        maxWidth: (activeStep === 1 && pennyMode !== 'none') ? '450px' : '300px',
        minWidth: '280px',
        boxShadow: 'var(--card-shadow)',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Speech Bubble Arrow */}
        <div style={{
          position: 'absolute',
          bottom: '-10px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '20px',
          height: '20px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-light)',
          borderRight: '1px solid var(--border-light)',
          transform: 'translateX(-50%) rotate(45deg)',
          zIndex: 0
        }} />

        <p style={{
          fontSize: '0.95rem',
          lineHeight: '1.5',
          color: 'var(--text-primary)',
          fontWeight: 500,
          margin: 0,
          position: 'relative',
          zIndex: 1,
          minHeight: '60px',
          whiteSpace: 'pre-wrap'
        }}>
          {(() => {
            if (activeStep === 1 && pennyMode === 'faqs') {
              const parts = typedText.split('\n\n');
              return (
                <>
                  <span style={{ fontWeight: 800 }}>{parts[0]}</span>
                  {parts.length > 1 ? '\n\n' + parts.slice(1).join('\n\n') : ''}
                </>
              );
            }
            return typedText;
          })()}
          <span className="cursor-blink">|</span>
        </p>

        {activeStep === 1 && pennyMode !== 'none' && !taxWait && taxExplanation && (
          <>
            <button
              onClick={() => setPennyIndex(i => Math.max(0, i - 1))}
              disabled={pennyIndex === 0}
              style={{
                position: 'absolute',
                left: '0.2rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: pennyIndex === 0 ? 'default' : 'pointer',
                opacity: pennyIndex === 0 ? 0.2 : 0.8,
                fontSize: '1.2rem',
                padding: '0.5rem',
                zIndex: 2
              }}
            >
              &lt;
            </button>
            <button
              onClick={() => setPennyIndex(i => Math.min((pennyMode === 'insights' ? taxExplanation.insights?.length : taxExplanation.faqs?.length) - 1, i + 1))}
              disabled={pennyIndex >= (pennyMode === 'insights' ? taxExplanation.insights?.length : taxExplanation.faqs?.length) - 1}
              style={{
                position: 'absolute',
                right: '0.2rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: pennyIndex >= (pennyMode === 'insights' ? taxExplanation.insights?.length : taxExplanation.faqs?.length) - 1 ? 'default' : 'pointer',
                opacity: pennyIndex >= (pennyMode === 'insights' ? taxExplanation.insights?.length : taxExplanation.faqs?.length) - 1 ? 0.2 : 0.8,
                fontSize: '1.2rem',
                padding: '0.5rem',
                zIndex: 2
              }}
            >
              &gt;
            </button>
            <div style={{
              position: 'absolute',
              bottom: '0.2rem',
              right: '1rem',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              zIndex: 2
            }}>
              {pennyIndex + 1} / {pennyMode === 'insights' ? taxExplanation.insights?.length : taxExplanation.faqs?.length}
            </div>
          </>
        )}
      </div>

      <img
        src={pennyState.image}
        alt="Penny"
        style={{
          width: '250%', /* Change this percentage to adjust her relative size */
          //maxWidth: '300px', /* Upper limit for very large screens */
          //minWidth: '150px', /* Lower limit so she doesn't disappear */
          //height: 'auto',
          objectFit: 'cover',
          filter: 'drop-shadow(0px 10px 15px rgba(0,0,0,0.1))'
        }}
        onError={(e) => {
          // Fallback if generated images are missing
          e.target.src = '/headshot-no-bg.png';
        }}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
        .cursor-blink {
          animation: blink 1s step-end infinite;
          color: var(--primary);
          font-weight: bold;
          margin-left: 2px;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}} />
    </div>
  );
}
