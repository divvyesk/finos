import { cookies } from 'next/headers';
import { getData } from './lib/db';

export default async function Home() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session')?.value;
  
  let user = null;
  if (sessionId) {
    try {
      const data = getData();
      const found = data.users.find(u => u.id === sessionId);
      if (found) {
        user = { id: found.id, name: found.name, email: found.email };
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="container">
      {/* Hero Section */}
      <section className="hero">
        <div style={{ marginBottom: '1rem' }}>
          <span style={{
            background: 'var(--primary-glow)',
            color: '#818cf8',
            fontSize: '0.8rem',
            fontWeight: '700',
            padding: '0.4rem 1rem',
            borderRadius: '20px',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Now Live: Version 1.0
          </span>
        </div>
        
        <h1 className="hero-title">
          You got your first paycheck.<br />
          <span className="text-gradient">Now learn how money actually works.</span>
        </h1>
        
        <p className="hero-subtitle">
          Stop guessing. Build a personalized financial roadmap in 15 minutes. Learn modern AI engineering concepts as you set up your financial operating system.
        </p>
        
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          {user ? (
            <a href="/dashboard" className="btn btn-primary" style={{ padding: '0.9rem 2rem', fontSize: '1rem' }}>
              Go to Dashboard
            </a>
          ) : (
            <a href="/signup" className="btn btn-primary" style={{ padding: '0.9rem 2rem', fontSize: '1rem' }}>
              Start My Financial Journey
            </a>
          )}
          <a href="#how-it-works" className="btn btn-secondary" style={{ padding: '0.9rem 2rem', fontSize: '1rem' }}>
            Learn More
          </a>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" style={{ padding: '4rem 0', borderTop: '1px solid var(--border-light)' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span style={{ color: 'var(--primary)', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Interactive Journey</span>
          <h2 style={{ fontSize: '2.25rem', marginTop: '0.5rem' }}>How It Works</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Four automated steps towards your financial freedom, powered by coordinated AI systems.</p>
        </div>

        <div className="steps-grid">
          <div className="card step-card">
            <span className="step-badge">AI Intake</span>
            <div className="step-title">
              <span className="step-num">01</span>
              <h3>Understand Income</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Upload your offer letter, contract, or paystub. Our intelligent OCR parsing layer extracts tax jurisdictions, salary rates, and employment terms automatically.
            </p>
          </div>

          <div className="card step-card">
            <span className="step-badge">Tax Engine</span>
            <div className="step-title">
              <span className="step-num">02</span>
              <h3>Discover Your Goals</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Tell us what you want your money to do in plain English (e.g. "I want to buy a house in 5 years"). The system calculates the monthly requirements and success probability.
            </p>
          </div>

          <div className="card step-card">
            <span className="step-badge">Decision Logic</span>
            <div className="step-title">
              <span className="step-num">03</span>
              <h3>Build Your Plan</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Get a personalized allocation strategy across needs, savings, and investments. Numbers are driven by strict financial rules, with the AI explaining the rationale.
            </p>
          </div>

          <div className="card step-card">
            <span className="step-badge">Routing Agents</span>
            <div className="step-title">
              <span className="step-num">04</span>
              <h3>Simulate Your Future</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Test "what if" scenarios (e.g. "What if I move to Texas?"). Watch the engine run custom simulation branches, housing estimators, and tax adjustments in real-time.
            </p>
          </div>
        </div>
      </section>

      {/* AI Engineering Concepts Section */}
      <section style={{ padding: '4rem 0 8rem', borderTop: '1px solid var(--border-light)' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span style={{ color: 'var(--accent)', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Curriculum & Architecture</span>
          <h2 style={{ fontSize: '2.25rem', marginTop: '0.5rem' }}>What You Learn By Building This</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Transition from writing simple GPT prompts to building production-grade hybrid AI applications.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%' }}></span>
              AI Foundations
            </h3>
            <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              <li>• Optical Character Recognition (OCR)</li>
              <li>• Structured Data Extraction & Schema Enforcement</li>
              <li>• Input Parsing & Validation Pipelines</li>
              <li>• Confidence Scoring & Clarification Gateways</li>
            </ul>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ color: 'var(--accent)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', background: 'var(--accent)', borderRadius: '50%' }}></span>
              RAG Architecture
            </h3>
            <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              <li>• Custom Text Chunking Strategies</li>
              <li>• Vector Embeddings & Similarity Search</li>
              <li>• IRS & CFPB Educational Knowledge Base</li>
              <li>• Strict Citation & Grounded Answering</li>
            </ul>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ color: 'var(--success)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%' }}></span>
              Coordinated Agents
            </h3>
            <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              <li>• Tool Calling & Dynamic Function Invocation</li>
              <li>• Autonomous Multi-Agent Critique Loops</li>
              <li>• Planning Agents & Constraint Solvers</li>
              <li>• Deterministic Rules + LLM Explanation Hybrid</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-light)', padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        <p>© {new Date().getFullYear()} FinOS Operating System. Crafted for First-Time Earners and AI Engineers.</p>
      </footer>
    </div>
  );
}
