'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../components/Navbar';

export default function AuthorPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) {
          router.push('/login');
          return;
        }
        return res.json();
      })
      .then(data => {
        if (data) {
          setUser(data.user);
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setAuthLoading(false));
  }, [router]);

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f5f7' }}>
        <div style={{ border: '3px solid rgba(0,0,0,0.1)', borderTop: '3px solid #575c8d', borderRadius: '50%', width: 30, height: 30, animation: 'spin 1s linear infinite' }} />
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }` }} />
      </div>
    );
  }

  return (
    <div style={{ background: '#f5f5f7', minHeight: '100vh', paddingBottom: '4rem', color: '#1d1d1f', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <Navbar user={user} />

      <main style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2vh 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 5.5rem)',
        boxSizing: 'border-box'
      }}>

        {/* Hero Section */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: '30% 1fr',
          gap: '5%',
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(20px)',
          borderRadius: '32px',
          padding: '6% 5%',
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
          alignItems: 'center'
        }}>
          {/* Left Column: Picture */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
            <div style={{
              width: '100%',
              aspectRatio: '1',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              border: '4px solid #fff'
            }}>
              <img
                src="/author.jpg"
                alt="Divvye Kansara and Strawberry"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.5rem 0 0.2rem 0', color: '#1d1d1f' }}>Divvye Kansara</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>Computer Engineering Student & Creator</p>
            </div>
          </div>

          {/* Right Column: Bio */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', tracking: '0.1em', color: '#575c8d' }}>Meet the Developer</span>
              <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', margin: '0.2rem 0 0.75rem 0', color: '#1d1d1f', lineHeight: '1.1' }}>
                Divvye Kansara
              </h1>
              <p style={{ fontSize: '1.15rem', lineHeight: '1.6', color: '#424245', margin: 0 }}>
                I'm a Computer Engineering student at Thadomal Shahani Engineering College, Mumbai. I love building clean, fast, and well-designed web applications. I care just as much about writing efficient code as I do about making sure the final interface feels smooth and satisfying to use.
              </p>
            </div>

            {/* Backstory Frame */}
            <div style={{
              background: '#f5f5f7',
              borderRadius: '16px',
              padding: '1.25rem',
              border: '1px solid rgba(0,0,0,0.04)',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start'
            }}>

              <div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 700, fontSize: '1.05rem', color: '#1d1d1f' }}>Strawberry & Penny</h4>
                <p style={{ margin: 0, fontSize: '0.94rem', lineHeight: '1.6', color: '#515154' }}>
                  The picture to the left features me and my pet cat, <strong>Strawberry</strong>. Strawberry's playful, curious, and reassuring demeanor was the entire inspiration behind designing <strong>Penny</strong>, our friendly feline companion helping you navigate your financial roadmap!
                </p>
              </div>
            </div>

            {/* Quick Contacts */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
              <a href="mailto:divvyesk2428@gmail.com" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', color: '#575c8d', fontSize: '0.9rem', fontWeight: 600 }}>
                ✉️ Email
              </a>
              <a href="https://linkedin.com/in/divvye-kansara" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', color: '#575c8d', fontSize: '0.9rem', fontWeight: 600 }}>
                🔗 LinkedIn
              </a>
              <a href="https://github.com/divvyesk" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', color: '#575c8d', fontSize: '0.9rem', fontWeight: 600 }}>
                💻 GitHub
              </a>
              <span style={{ color: '#86868b', fontSize: '0.9rem' }}>
                📞 +91 9987225618
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
