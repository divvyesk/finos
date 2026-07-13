'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Navbar({ user }) {
  const router = useRouter();

  const handleSignOut = () => {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => router.push('/'));
  };

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem 2rem',
      background: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border-light)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      width: '100%'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            Fin<span style={{ color: 'var(--success)' }}>OS</span>
          </h1>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <Link href="/author" style={{ 
          fontSize: '0.9rem', 
          fontWeight: 600, 
          color: 'var(--text-secondary)',
          textDecoration: 'none'
        }}>
          Author
        </Link>
        
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              {user.name || 'User'}
            </span>
            <button 
              onClick={handleSignOut}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="loading-spinner" style={{ width: 20, height: 20 }} />
        )}
      </div>
    </nav>
  );
}
