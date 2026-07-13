'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Step3Panel from './Step3Panel';
import Navbar from '../../components/Navbar';
import PennyCompanion from '../../components/PennyCompanion';


// ── Currency symbol helper ─────────────────────────────────────────────────
const CURRENCY_SYMBOLS = { USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$', INR: '₹', SGD: 'S$', JPY: '¥', NZD: 'NZ$' };
const sym = (currency) => CURRENCY_SYMBOLS[currency] || currency + ' ';

// ── Pipeline stage labels ──────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: 'uploading', label: 'Uploading document...' },
  { key: 'ocr', label: 'Stage 1 — OCR / PDF text extraction running...' },
  { key: 'extracting', label: 'Stage 2 — Running structured field extraction...' },
  { key: 'validating', label: 'Stage 3 — Applying validation rules...' },
];

const STAGE_INDEX = { uploading: 0, ocr: 1, extracting: 2, validating: 3 };

const JOURNEY_STEPS = [
  'Understand Income', 'Understand Taxes', 'Define Goals',
];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [step2Done, setStep2Done] = useState(false);
  const [step3Done, setStep3Done] = useState(false);


  // Pipeline state
  const [pipelineStage, setPipelineStage] = useState('idle'); // idle | uploading | ocr | extracting | validating | done | error
  const [result, setResult] = useState(null);
  const [pipelineError, setPipelineError] = useState('');

  const [pennyMode, setPennyMode] = useState('none');
  const [pennyIndex, setPennyIndex] = useState(0);
  
  // Tax state lifted from Step 2
  const [taxData, setTaxData] = useState(null);
  const [hasStartedTax, setHasStartedTax] = useState(false);

  // Penny Encouragement State
  const [checklistEncouragement, setChecklistEncouragement] = useState(false);

  const handleChecklistCompleted = () => {
    setChecklistEncouragement(true);
    setTimeout(() => {
      setChecklistEncouragement(false);
    }, 5000);
  };

  // Manual mode
  const [manualMode, setManualMode] = useState(false);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [statesLoading, setStatesLoading] = useState(false);

  const [form, setForm] = useState({
    country: 'United States', currency: 'USD', state: '', salary: '', signing_bonus: '',
    relocation_bonus: '', rsu_count: '', vesting_period_years: '', stock_options: '',
    pay_frequency: 'biweekly', start_date: '', location: '', employment_type: 'full_time',
    match_rate: '', match_limit: '', health_medical: true, health_dental: true,
    health_vision: true, pto_days: '', probation_period_days: '',
  });

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setUser(d.user))
      .catch(() => router.push('/login'))
      .finally(() => setAuthLoading(false));

    // Fetch dynamic country list from our geo API
    setCountriesLoading(true);
    fetch('/api/geo?action=countries')
      .then(r => r.json())
      .then(d => {
        if (d.countries) setCountries(d.countries);
      })
      .catch(err => console.error('Failed to load countries', err))
      .finally(() => setCountriesLoading(false));
  }, [router]);

  // Restore user progress on mount
  useEffect(() => {
    fetch('/api/goals')
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)).catch(() => Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d => {
        if (d.hasProfile) {
          setPipelineStage('done');
          setResult({
            data: d.profile,
            validation: { isValid: true, errors: [], warnings: [] },
            source: 'Saved Profile'
          });
          setStep2Done(true);
          setActiveStep(1); // Default next step
        }
        if (d.activeGoal) {
          setStep3Done(true);
          setActiveStep(2); // Take them to goals workspace directly
        }
      })
      .catch(err => console.error('Failed to restore progress', err));
  }, []);


  // Handle dynamic states and currency when country changes
  useEffect(() => {
    if (!form.country) {
      setStates([]);
      return;
    }

    const selected = countries.find(c => c.name === form.country);
    if (selected) {
      setForm(prev => ({
        ...prev,
        currency: selected.currencyCode || 'USD'
      }));
    }

    setStatesLoading(true);
    fetch(`/api/geo?action=states&country=${encodeURIComponent(form.country)}`)
      .then(r => r.json())
      .then(d => {
        if (d.states) {
          setStates(d.states);
        } else {
          setStates([]);
        }
      })
      .catch(err => {
        console.error('Failed to load states', err);
        setStates([]);
      })
      .finally(() => setStatesLoading(false));
  }, [form.country, countries]);

  // ── Shared pipeline runner ────────────────────────────────────────────
  async function runPipeline(fetchFn) {
    setPipelineError('');
    setResult(null);

    // Fire the real request immediately so we don't add fake delays to real work.
    // Wrap result in a sentinel object so we can detect errors without try/catch
    // racing against the animation awaits below.
    const fetchPromise = fetchFn().then(
      data => ({ ok: true, data }),
      err => ({ ok: false, error: err.message })
    );

    // Animate uploading → ocr → extracting, then PAUSE here and wait for the
    // server. This means the spinner stays at 'extracting' for as long as
    // Tesseract / pdf-parse actually needs — no more stuck 'Stage 3'.
    setPipelineStage('uploading');
    await sleep(500);
    setPipelineStage('ocr');
    await sleep(1000);
    setPipelineStage('extracting');

    const outcome = await fetchPromise;

    if (!outcome.ok) {
      setPipelineError(outcome.error);
      setPipelineStage('error');
      return;
    }

    // Briefly show validating (the server validator is fast/synchronous)
    setPipelineStage('validating');
    await sleep(500);

    setResult(outcome.data);
    setPipelineStage('done');
  }

  // ── File upload handler ───────────────────────────────────────────────────
  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    runPipeline(async () => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      return json;
    });
  }

  // ── Manual submit handler ─────────────────────────────────────────────────
  async function handleManualSubmit(e) {
    e.preventDefault();
    runPipeline(async () => {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Submission failed');
      return json;
    });
  }

  function reset() {
    fetch('/api/goals', { method: 'DELETE' }).catch(console.error);
    setPipelineStage('idle');
    setResult(null);
    setPipelineError('');
    setManualMode(false);
    setStep2Done(false);
    setStep3Done(false);
    setTaxData(null);
    setHasStartedTax(false);
    setPennyMode('none');
  }

  if (authLoading) return <Spinner full />;

  const step1Done = pipelineStage === 'done';

  return (
    <>
      <Navbar user={user} />

      {/* Top Progress Tracker */}
      <div style={{
        position: 'sticky',
        top: '5rem', /* Increased to avoid overlapping the sticky Navbar */
        zIndex: 100,
        background: 'rgba(248, 248, 248, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-light)',
        padding: '0.75rem 1.5rem',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        width: 'calc(100% - 3rem)',
        maxWidth: '1200px',
        margin: '1rem auto'
      }}>
        <div className="tracker-container">
          {JOURNEY_STEPS.map((step, i) => {
            const isActive = activeStep === i;
            const isCompleted = i === 0 ? step1Done : (i === 1 ? step2Done : (i === 2 ? step3Done : false));
            const isSelectable = i === 0 || (i === 1 && step1Done) || (i === 2 && step2Done) || (i > 2 && step3Done);

            return (
              <div
                key={step}
                className={`tracker-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => {
                  if (isSelectable) {
                    setActiveStep(i);
                  }
                }}
                style={{ cursor: isSelectable ? 'pointer' : 'not-allowed' }}
              >
                <span className="tracker-checkbox">{isCompleted ? '✓' : (i + 1)}</span>
                <span style={{ whiteSpace: 'nowrap' }}>{step}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="container" style={{ padding: '0 1.5rem 2rem' }}>
        <div className="dashboard-grid">

          {/* Left Column: Penny Companion */}
          <aside>
            <PennyCompanion
              user={user}
              activeStep={activeStep}
              pipelineStage={pipelineStage}
              manualMode={manualMode}
              validationPassed={result?.validation?.isValid}
              isReturningUser={!!(step2Done || step3Done)}
              taxWait={activeStep === 1 && !taxData}
              pennyMode={pennyMode}
              pennyIndex={pennyIndex}
              setPennyIndex={setPennyIndex}
              taxExplanation={result?.data?.explanation || taxData?.explanation}
              roadmapConfirmed={false}
              checklistEncouragement={checklistEncouragement}
            />
          </aside>

          {/* Main panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {activeStep === 0 && (
              <>
                {/* Step 1 card */}
                <section className="card" style={{ position: 'relative' }}>
                  <StepBadge label="Step 1 — Income Intake Agent" />
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>Income Intake Agent</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: 600 }}>
                    Upload a PDF offer letter, paystub, or image of your compensation details.
                  </p>

                  {/* ── IDLE state ── */}
                  {pipelineStage === 'idle' && !manualMode && (
                    <div>
                      <label className="dropzone">
                        <span className="dropzone-icon">📄</span>
                        <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>Drag & drop or click to upload</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          PDF, PNG, JPG — offer letter, paystub, or contract
                        </span>
                        <input type="file" style={{ display: 'none' }} accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />
                      </label>
                      <div style={{ textAlign: 'center', marginTop: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        or{' '}
                        <button className="btn btn-text" style={{ color: 'var(--primary)', fontWeight: 600 }} onClick={() => setManualMode(true)}>
                          Enter compensation details manually →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Manual form ── */}
                  {pipelineStage === 'idle' && manualMode && (
                    <form onSubmit={handleManualSubmit}>
                      <SectionLabel>Location & Identity</SectionLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <Field label="Country" id="country">
                          <select
                            id="country"
                            className="form-input"
                            value={form.country}
                            onChange={e => setForm({ ...form, country: e.target.value, state: '' })}
                            disabled={countriesLoading}
                          >
                            {countriesLoading && <option>Loading countries...</option>}
                            {countries.map(c => (
                              <option key={c.name} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Currency" id="currency">
                          <input id="currency" className="form-input" value={form.currency} readOnly style={{ opacity: 0.6 }} />
                        </Field>
                        <Field label="State / Region" id="state">
                          {statesLoading ? (
                            <input className="form-input" value="Loading states..." disabled style={{ opacity: 0.6 }} />
                          ) : states.length > 0 ? (
                            <select
                              id="state"
                              className="form-input"
                              value={form.state}
                              onChange={e => setForm({ ...form, state: e.target.value })}
                            >
                              <option value="">Select state/province...</option>
                              {states.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id="state"
                              className="form-input"
                              placeholder="Enter state/province..."
                              value={form.state}
                              onChange={e => setForm({ ...form, state: e.target.value })}
                            />
                          )}
                        </Field>
                        <Field label="Start Date" id="start_date">
                          <input
                            id="start_date"
                            type="date"
                            className="form-input"
                            value={form.start_date}
                            onChange={e => setForm({ ...form, start_date: e.target.value })}
                          />
                        </Field>
                        <Field label="Work Location (City/Office)" id="location">
                          <input
                            id="location"
                            type="text"
                            className="form-input"
                            placeholder="e.g. San Francisco"
                            value={form.location}
                            onChange={e => setForm({ ...form, location: e.target.value })}
                          />
                        </Field>
                      </div>

                      <SectionLabel>Base Compensation & Role</SectionLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <Field label="Annual Base Salary" id="salary" required>
                          <input id="salary" type="number" className="form-input" placeholder="e.g. 115000" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} />
                        </Field>
                        <Field label="Pay Frequency" id="pay_frequency">
                          <select id="pay_frequency" className="form-input" value={form.pay_frequency} onChange={e => setForm({ ...form, pay_frequency: e.target.value })}>
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Bi-weekly</option>
                            <option value="semimonthly">Semi-monthly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </Field>
                        <Field label="Role Type" id="employment_type">
                          <select id="employment_type" className="form-input" value={form.employment_type} onChange={e => setForm({ ...form, employment_type: e.target.value })}>
                            <option value="full_time">Full Time</option>
                            <option value="part_time">Part Time</option>
                            <option value="contract">Contract</option>
                            <option value="intern">Internship</option>
                          </select>
                        </Field>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                        <Field label="Signing Bonus (One-time)" id="signing_bonus">
                          <input id="signing_bonus" type="number" className="form-input" placeholder="e.g. 10000" value={form.signing_bonus} onChange={e => setForm({ ...form, signing_bonus: e.target.value })} />
                        </Field>
                        <Field label="Relocation Bonus / Stipend" id="relocation_bonus">
                          <input id="relocation_bonus" type="number" className="form-input" placeholder="e.g. 5000" value={form.relocation_bonus} onChange={e => setForm({ ...form, relocation_bonus: e.target.value })} />
                        </Field>
                      </div>

                      <SectionLabel>Equity & Vesting</SectionLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <Field label="RSU Count" id="rsu_count">
                          <input id="rsu_count" type="number" className="form-input" placeholder="e.g. 1000" value={form.rsu_count} onChange={e => setForm({ ...form, rsu_count: e.target.value })} />
                        </Field>
                        <Field label="Vesting Period (Years)" id="vesting_period_years">
                          <input id="vesting_period_years" type="number" className="form-input" placeholder="e.g. 4" value={form.vesting_period_years} onChange={e => setForm({ ...form, vesting_period_years: e.target.value })} />
                        </Field>
                        <Field label="Stock Options Count" id="stock_options">
                          <input id="stock_options" type="number" className="form-input" placeholder="e.g. 500" value={form.stock_options} onChange={e => setForm({ ...form, stock_options: e.target.value })} />
                        </Field>
                      </div>

                      <SectionLabel>Retirement & Benefits</SectionLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <Field label="401(k) Match Rate (e.g. 1.0 = 100%)" id="match_rate">
                          <input id="match_rate" type="number" step="0.1" className="form-input" placeholder="e.g. 0.5" value={form.match_rate} onChange={e => setForm({ ...form, match_rate: e.target.value })} />
                        </Field>
                        <Field label="401(k) Match Limit (%)" id="match_limit">
                          <input id="match_limit" type="number" className="form-input" placeholder="e.g. 6" value={form.match_limit} onChange={e => setForm({ ...form, match_limit: e.target.value })} />
                        </Field>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                        <Field label="PTO (Days / Year)" id="pto_days">
                          <input id="pto_days" type="number" className="form-input" placeholder="e.g. 15" value={form.pto_days} onChange={e => setForm({ ...form, pto_days: e.target.value })} />
                        </Field>
                        <Field label="Probation Period (Days)" id="probation_period_days">
                          <input id="probation_period_days" type="number" className="form-input" placeholder="e.g. 90" value={form.probation_period_days} onChange={e => setForm({ ...form, probation_period_days: e.target.value })} />
                        </Field>
                      </div>

                      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                          <input type="checkbox" checked={form.health_medical} onChange={e => setForm({ ...form, health_medical: e.target.checked })} />
                          Medical Insurance Included
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                          <input type="checkbox" checked={form.health_dental} onChange={e => setForm({ ...form, health_dental: e.target.checked })} />
                          Dental Insurance Included
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                          <input type="checkbox" checked={form.health_vision} onChange={e => setForm({ ...form, health_vision: e.target.checked })} />
                          Vision Insurance Included
                        </label>
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                        <button type="submit" className="btn btn-primary">Submit Details</button>
                        <button type="button" className="btn btn-secondary" onClick={() => setManualMode(false)}>Cancel</button>
                      </div>
                    </form>
                  )}

                  {/* ── Pipeline running ── */}
                  {['uploading', 'ocr', 'extracting', 'validating'].includes(pipelineStage) && (
                    <PipelineLoader stage={pipelineStage} />
                  )}

                  {/* ── Error ── */}
                  {pipelineStage === 'error' && (
                    <div>
                      <div style={{ background: 'var(--error-glow)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '1rem', color: 'var(--error)', marginBottom: '1rem' }}>
                        ⚠ {pipelineError}
                      </div>
                      <button className="btn btn-secondary" onClick={reset}>Try Again</button>
                    </div>
                  )}

                  {/* ── Done ── */}
                  {pipelineStage === 'done' && result && (
                    <ResultPanel result={result} onReset={reset} onProceed={() => setActiveStep(1)} />
                  )}
                </section>

              </>
            )}

            {activeStep === 1 && (
              <Step2Panel
                result={result}
                taxData={taxData}
                setTaxData={setTaxData}
                hasStartedTax={hasStartedTax}
                setHasStartedTax={setHasStartedTax}
                onBack={() => {
                  setActiveStep(0);
                  setPennyMode('none');
                }}
                onProceed={() => {
                  setStep2Done(true);
                  setActiveStep(2);
                  setPennyMode('none');
                }}
                setStep2Done={setStep2Done}
                setPennyMode={setPennyMode}
                setPennyIndex={setPennyIndex}
              />
            )}

            {activeStep === 2 && (
              <Step3Panel
                onBack={() => setActiveStep(1)}
                onProceed={() => {
                  setStep3Done(true);
                  setActiveStep(3);
                }}
                setStep3Done={setStep3Done}
                onChecklistCompleted={handleChecklistCompleted}
                setPennyMode={setPennyMode}
              />
            )}


          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StepBadge({ label }) {
  return (
    <span style={{
      position: 'absolute', top: '1.5rem', right: '1.5rem',
      background: 'var(--primary-glow)', color: 'var(--primary)',
      fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.6rem',
      borderRadius: 20, border: '1px solid rgba(99,102,241,0.2)',
    }}>{label}</span>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '1.5rem 0 0.75rem' }}>
      {children}
    </p>
  );
}

function Field({ label, id, required, children }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label" htmlFor={id}>{label}{required && <span style={{ color: 'var(--error)' }}> *</span>}</label>
      {children}
    </div>
  );
}

function PipelineLoader({ stage }) {
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '4rem 2rem',
      background: 'rgba(255, 255, 255, 0.75)',
      backdropFilter: 'blur(20px)',
      borderRadius: '24px',
      border: '1px solid rgba(0,0,0,0.06)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
      maxWidth: '500px',
      margin: '2rem auto'
    }}>
      <div className="loading-spinner" style={{ width: 44, height: 44, margin: '0 auto 1.75rem' }} />
      <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1d1d1f' }}>
        Analyzing Document & Extracting Profile...
      </h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, lineHeight: 1.5 }}>
        Running structured field extraction and financial validation rules dynamically.
      </p>
    </div>
  );
}

function ResultPanel({ result, onReset, onProceed }) {
  const { data, validation, ocrConfidence, extractionMethod, rawTextPreview, source } = result;
  const currency = data?.currency || 'USD';
  const s = sym(currency);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span>✓</span> Document Processed
          </h3>
        </div>
        <button className="btn btn-secondary" onClick={onReset} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          Re-upload
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* Validation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Errors */}
          {validation.errors.length > 0 && (
            <div>
              <p style={{ color: 'var(--error)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                ✕ Blocking Errors (must fix before continuing)
              </p>
              {validation.errors.map((e, i) => (
                <div key={i} style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '0.8rem 1rem', color: 'var(--error)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  {e}
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div>
              <p style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                ⚠ Warnings (verify before continuing)
              </p>
              {validation.warnings.map((w, i) => (
                <div key={i} style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '0.8rem 1rem', color: 'var(--accent)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* All clear */}
          {validation.errors.length === 0 && validation.warnings.length === 0 && (
            <div style={{ background: 'var(--success-glow)', border: '1px solid rgba(87, 92, 141, 0.2)', borderRadius: 12, padding: '1rem', color: 'var(--success)', fontSize: '0.95rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              All data extracted successfully
            </div>
          )}
        </div>

        <div style={{
          background: 'rgba(248, 248, 248, 0.5)',
          border: '1px solid var(--border-light)',
          borderRadius: '20px',
          padding: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.5rem'
        }}>
          {data.salary && <Stat label="Base Salary" value={`${s}${data.salary.toLocaleString()}/yr`} />}
          {data.signing_bonus && <Stat label="Signing Bonus" value={`${s}${data.signing_bonus.toLocaleString()}`} />}
          {data.relocation_bonus && <Stat label="Relocation" value={`${s}${data.relocation_bonus.toLocaleString()}`} />}
          {data.rsu_count && <Stat label="Equity (RSUs)" value={`${data.rsu_count.toLocaleString()} units`} sub={`over ${data.vesting_period_years} yrs`} />}
          {data.pay_frequency && <Stat label="Pay Schedule" value={data.pay_frequency} />}
          {data.employment_type && <Stat label="Role Type" value={data.employment_type.replace(/_/g, ' ')} />}
          {data.state && <Stat label="Location" value={`${data.state}, ${data.country}`} />}
          {data.pto_days && <Stat label="Time Off" value={`${data.pto_days} days/yr`} />}
          {data.retirement_401k?.match_rate != null && (
            <Stat label="401(k) Match" value={`${(data.retirement_401k.match_rate * 100).toFixed(0)}%`} sub={`up to ${data.retirement_401k.match_limit}%`} />
          )}
        </div>



        {/* Proceed button (only if no blocking errors) */}
        {validation.isValid && (
          <button className="btn btn-primary" style={{ marginTop: '0.5rem', alignSelf: 'flex-start', padding: '1rem 2rem', fontSize: '1rem', borderRadius: '12px' }}
            onClick={onProceed}>
            Proceed to Paycheck Interpreter →
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <span style={{
        color: 'var(--text-secondary)',
        fontSize: '0.85rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.02em'
      }}>
        {label}
      </span>
      <span style={{
        color: 'var(--text-primary)',
        fontSize: '1.4rem',
        fontWeight: 700,
        letterSpacing: '-0.03em',
        textTransform: 'capitalize'
      }}>
        {value}
      </span>
      {sub && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>{sub}</span>}
    </div>
  );
}

function Spinner({ full }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: full ? '80vh' : 'auto' }}>
      <div className="loading-spinner" style={{ width: 40, height: 40 }} />
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function countryToCurrency(country) {
  const map = {
    'US': 'USD', 'USA': 'USD', 'United States': 'USD',
    'UK': 'GBP', 'United Kingdom': 'GBP',
    'CA': 'CAD', 'Canada': 'CAD',
    'AU': 'AUD', 'Australia': 'AUD',
    'DE': 'EUR', 'Germany': 'EUR',
    'FR': 'EUR', 'France': 'EUR',
    'IN': 'INR', 'India': 'INR',
    'SG': 'SGD', 'Singapore': 'SGD',
    'JP': 'JPY', 'Japan': 'JPY',
  };
  return map[country] || 'USD';
}

function Step2Panel({ 
  result, 
  taxData, 
  setTaxData, 
  hasStartedTax, 
  setHasStartedTax, 
  onBack, 
  onProceed, 
  setStep2Done, 
  setPennyMode, 
  setPennyIndex 
}) {
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxError, setTaxError] = useState('');
  const [preTaxRate, setPreTaxRate] = useState(0);


  const fetchTaxes = (rate = 0) => {
    setTaxLoading(true);
    setTaxError('');
    fetch('/api/taxes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        salary: result?.data?.salary || null,
        country: result?.data?.country || null,
        state: result?.data?.state || null,
        currency: result?.data?.currency || null,
        preTaxContributionRate: rate
      })
    })
      .then(r => {
        if (!r.ok) return r.json().then(e => Promise.reject(e));
        return r.json();
      })
      .then(data => {
        if (!taxData) {
          setTaxData(data);
        } else {
          setTaxData(prev => ({
            ...prev,
            taxBreakdown: data.taxBreakdown,
            explanation: data.explanation
          }));
        }
      })
      .catch(err => {
        setTaxError(err.error || 'Failed to calculate taxes');
      })
      .finally(() => setTaxLoading(false));
  };

  if (taxError) {
    return (
      <div className="card">
        <h3 style={{ color: 'var(--error)' }}>Error Loading Taxes</h3>
        <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>{taxError}</p>
        <button className="btn btn-secondary" onClick={onBack}>← Back to Step 1</button>
      </div>
    );
  }

  if (!taxData && !taxLoading && !hasStartedTax) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Ready to check your taxes?</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>We'll run your salary through our tax engine to see your actual take-home pay.</p>
        <button
          className="btn btn-primary"
          style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}
          onClick={() => {
            setHasStartedTax(true);
            fetchTaxes(0);
          }}
        >
          Understand Taxes
        </button>
      </div>
    );
  }

  if (!taxData && taxLoading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="loading-spinner" style={{ width: 40, height: 40, margin: '0 auto 1.5rem' }} />
        <h3>Analyzing Paycheck & Running Tax Engine...</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Calculating federal, state, and payroll contributions dynamically.</p>
      </div>
    );
  }

  const { taxBreakdown, explanation } = taxData || {};
  const profile = result?.data || {};
  const s = sym(profile?.currency);

  const deductions = taxBreakdown?.deductions || {};
  const netPay = taxBreakdown?.netPay || 0;
  const gross = profile?.salary || 0;

  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6'];
  const deductionList = Object.entries(deductions).map(([label, value], index) => ({
    key: `deduction-${index}`,
    label,
    value,
    color: COLORS[index % COLORS.length]
  })).filter(d => d.value > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <section className="card" style={{ position: 'relative', padding: '1.5rem 2rem' }}>
        <StepBadge label="Step 2 — Paycheck Interpreter" />
        <h2 style={{ fontSize: '1.3rem', marginBottom: '0.2rem' }}>Paycheck Interpreter</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Explore the tax breakdown for your salary of <strong>{s}{gross.toLocaleString()}</strong> in <strong>{profile?.state ? `${profile.state}, ` : ''}{profile?.country}</strong>. Adjust pre-tax contribution to see how it affects your take-home pay.
        </p>

        {taxLoading && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10, borderRadius: 12 }}>
            <div className="loading-spinner" style={{ width: 30, height: 30 }} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em', fontWeight: 600 }}>Visual Paycheck Breakdown</p>

              <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', background: 'rgba(0,0,0,0.05)', marginBottom: '1rem', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ width: `${(netPay / gross) * 100}%`, background: 'var(--success)', transition: 'width 0.3s ease' }} title={`Net Take-home: ${(netPay / gross * 100).toFixed(1)}%`} />
                {deductionList.map(d => {
                  const pct = (d.value / gross) * 100;
                  if (pct <= 0) return null;
                  return (
                    <div key={d.key} style={{ width: `${pct}%`, background: d.color, transition: 'width 0.3s ease' }} title={`${d.label}: ${pct.toFixed(1)}%`} />
                  );
                })}
              </div>

              <div style={{ 
                background: 'rgba(248, 248, 248, 0.5)', 
                border: '1px solid var(--border-light)', 
                borderRadius: '16px', 
                padding: '1rem',
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.5rem' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-light)', fontWeight: 600, fontSize: '1rem' }}>
                  <span>Gross annual salary</span>
                  <span>{s}{gross.toLocaleString()}</span>
                </div>

                {deductionList.map(d => (
                  <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: d.color, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
                      <span>{d.label}</span>
                    </div>
                    <span>{s}{d.value.toLocaleString()} ({((d.value / gross) * 100).toFixed(1)}%)</span>
                  </div>
                ))}

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0 0', marginTop: '0.25rem', borderTop: '1px solid var(--border-light)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--success)' }}>
                  <span>Net Take-home Pay</span>
                  <span>{s}{netPay.toLocaleString()} <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>({((netPay / gross) * 100).toFixed(1)}%)</span></span>
                </div>
              </div>
            </div>

            <div style={{ 
              background: 'rgba(248, 248, 248, 0.5)', 
              border: '1px solid var(--border-light)', 
              borderRadius: '16px', 
              padding: '1rem' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <strong style={{ fontSize: '1rem' }}>Pre-tax Contribution Rate</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#fff', borderRadius: '10px', padding: '0.25rem 0.5rem', border: '1px solid var(--border-light)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={preTaxRate}
                    onChange={e => {
                      let val = Math.max(0, Math.min(50, Number(e.target.value)));
                      setPreTaxRate(val);
                    }}
                    style={{
                      width: '50px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '1rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>%</span>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.4, marginBottom: '0.75rem' }}>
                Enter a percentage (0% to 50%) to simulate contributing to a pre-tax retirement or local pension fund. This reduces your taxable income.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => fetchTaxes(preTaxRate)}
                style={{ width: '100%', fontSize: '0.95rem', padding: '0.75rem 1rem', borderRadius: '12px', fontWeight: 600 }}
                disabled={taxLoading}
              >
                Recalculate Taxes
              </button>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em', fontWeight: 600 }}>AI Explanations & Insights</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  className="btn"
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem', 
                    fontWeight: 600, 
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(168,85,247,0.1))',
                    border: '1px solid rgba(168,85,247,0.2)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                  onClick={() => {
                    setPennyMode('insights');
                    setPennyIndex(0);
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>✨</span> Get More Insights from Penny
                </button>
                <button
                  className="btn"
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem', 
                    fontWeight: 600, 
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.05), rgba(59,130,246,0.1))',
                    border: '1px solid rgba(16,185,129,0.2)',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                  onClick={() => {
                    setPennyMode('faqs');
                    setPennyIndex(0);
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>📖</span> Understand all these taxes from Penny
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', marginTop: '2rem', paddingTop: '1.5rem' }}>
          <button className="btn btn-secondary" onClick={onBack}>← Back to Step 1</button>
          <button className="btn btn-primary" onClick={onProceed}>Proceed to Step 3: Define Goals →</button>
        </div>
      </section>
    </div>
  );
}
