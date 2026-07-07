'use client';

import { useState, useEffect } from 'react';

const CURRENCY_SYMBOLS = { USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$', INR: '₹', SGD: 'S$', JPY: '¥', NZD: 'NZ$' };
const sym = (currency) => CURRENCY_SYMBOLS[currency] || currency + ' ';

export default function Step3Panel({ onBack, onProceed, setStep3Done }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Paycheck info
  const [profile, setProfile] = useState(null);

  // Baseline details
  const [baselineSubmitted, setBaselineSubmitted] = useState(false);
  const [savings, setSavings] = useState(0);
  const [debt, setDebt] = useState([{ type: 'Credit Card', amount: 2500, rate: 18 }]);
  const [monthlyExpenses, setMonthlyExpenses] = useState([
    { category: 'Rent / Mortgage', amount: 1500 },
    { category: 'Groceries & Dining', amount: 400 },
    { category: 'Utilities', amount: 200 },
    { category: 'Transport', amount: 150 }
  ]);

  // Custom expense input
  const [customExpCategory, setCustomExpCategory] = useState('');
  const [customExpAmount, setCustomExpAmount] = useState('');

  // Chat interface state
  const [goalInput, setGoalInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [needsClarification, setNeedsClarification] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [extractedParams, setExtractedParams] = useState(null);

  // Active roadmap
  const [roadmap, setRoadmap] = useState(null);
  const [useAlternative, setUseAlternative] = useState(false);
  const [goalConfirmed, setGoalConfirmed] = useState(false);
  const [activeLevelWorkspace, setActiveLevelWorkspace] = useState(null);


  // Roadmap active tabs & subchat
  const [expandedLevel, setExpandedLevel] = useState(1);
  const [levelTab, setLevelTab] = useState('what'); // what | why | where | how | ask
  const [subChatText, setSubChatText] = useState('');
  const [subChatLoading, setSubChatLoading] = useState(false);

  // Fetch baseline and active goal on load
  useEffect(() => {
    setLoading(true);
    fetch('/api/goals')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        if (d.profile) setProfile(d.profile);
        if (d.activeGoal) {
          setSavings(d.activeGoal.savings || 0);
          setDebt(d.activeGoal.debt || []);
          setMonthlyExpenses(d.activeGoal.monthlyExpenses || []);
          setRoadmap(d.activeGoal.roadmap);
          setExtractedParams(d.activeGoal.extractedParameters);
          setBaselineSubmitted(true);
          setGoalConfirmed(true);
          setStep3Done(true);
        }
      })
      .catch(err => {
        console.error("Failed to load goals info:", err);
        setError("Could not load your financial context. Make sure you completed Step 1.");
      })
      .finally(() => setLoading(false));
  }, [setStep3Done]);

  // Handle custom expense add
  const addCustomExpense = () => {
    if (!customExpCategory || !customExpAmount) return;
    setMonthlyExpenses([
      ...monthlyExpenses,
      { category: customExpCategory.trim(), amount: Number(customExpAmount) }
    ]);
    setCustomExpCategory('');
    setCustomExpAmount('');
  };

  // Remove expense
  const removeExpense = (index) => {
    setMonthlyExpenses(monthlyExpenses.filter((_, i) => i !== index));
  };

  // Add debt item
  const addDebtItem = () => {
    setDebt([...debt, { type: 'Personal Loan', amount: 1000, rate: 10 }]);
  };

  // Update debt fields
  const updateDebtItem = (index, field, value) => {
    const updated = [...debt];
    updated[index][field] = field === 'type' ? value : Number(value);
    setDebt(updated);
  };

  // Remove debt item
  const removeDebtItem = (index) => {
    setDebt(debt.filter((_, i) => i !== index));
  };

  // Submit Baseline
  const submitBaseline = (e) => {
    e.preventDefault();
    setBaselineSubmitted(true);
  };

  // Submit main goal chat
  const handleGoalSubmit = async (textToSend) => {
    const text = textToSend || goalInput;
    if (!text.trim()) return;

    setLoading(true);
    setError('');

    const newHistory = [...chatHistory, { role: 'user', text }];
    setChatHistory(newHistory);
    setGoalInput('');

    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          savings,
          debt,
          monthlyExpenses,
          history: chatHistory
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze goal');

      if (data.needsClarification) {
        setNeedsClarification(true);
        setFollowUpQuestions(data.followUpQuestions);
        setCurrentQuestionIndex(0);
        setExtractedParams(data.extractedParams);

        // Add assistant reply to chat history
        setChatHistory([
          ...newHistory,
          { role: 'model', text: `Got it. I need a bit more detail to calculate a precise plan. ${data.followUpQuestions[0]}` }
        ]);
      } else {
        setNeedsClarification(false);
        setRoadmap(data.roadmap);
        setExtractedParams(data.extractedParams);
        setChatHistory([
          ...newHistory,
          { role: 'model', text: `Analysis complete! I've build your customized roadmap. Review the step levels below.` }
        ]);
      }
    } catch (err) {
      setError(err.message || 'Error occurred while connecting to the engine.');
    } finally {
      setLoading(false);
    }
  };

  // Handle clarification questions
  const handleClarificationAnswer = async (answerText) => {
    if (!answerText.trim()) return;

    const currentQuestion = followUpQuestions[currentQuestionIndex];
    const newAnswers = { ...answers, [currentQuestion]: answerText };
    setAnswers(newAnswers);

    const newHistory = [...chatHistory, { role: 'user', text: answerText }];
    setChatHistory(newHistory);

    const isLast = currentQuestionIndex === followUpQuestions.length - 1;

    if (!isLast) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      setChatHistory([
        ...newHistory,
        { role: 'model', text: followUpQuestions[nextIdx] }
      ]);
    } else {
      // Re-run parsing with compiled answers injected
      setLoading(true);
      const compositeInput = `Goal: I want to buy a ${extractedParams.category || 'asset'}. Details: ` +
        Object.entries(newAnswers).map(([q, a]) => `${q} Answer: ${a}`).join(', ');

      try {
        const res = await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: compositeInput,
            savings,
            debt,
            monthlyExpenses,
            history: newHistory
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to resolve roadmap');

        setNeedsClarification(false);
        setRoadmap(data.roadmap);
        setExtractedParams(data.extractedParams);
        setChatHistory([
          ...newHistory,
          { role: 'model', text: `Excellent. I have all details needed. I've designed your step-by-step roadmap!` }
        ]);
      } catch (err) {
        setError(err.message || 'Failed to complete analysis.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Confirm and Save Goal
  const confirmAndSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmGoal: true,
          savings,
          debt,
          monthlyExpenses,
          goalData: {
            title: extractedParams.title || 'My Personal Goal',
            extractedParameters: extractedParams,
            roadmap: useAlternative ? roadmap.alternativePlan : roadmap
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save roadmap');

      setGoalConfirmed(true);
      setStep3Done(true);
      alert('Goal roadmap confirmed & saved successfully!');
    } catch (err) {
      setError(err.message || 'Error occurred saving your goal.');
    } finally {
      setLoading(false);
    }
  };

  // Sub-chatbot query inside level
  const submitSubChat = async (e, lvlNum) => {
    e.preventDefault();
    if (!subChatText.trim()) return;

    setSubChatLoading(true);
    const userMsg = subChatText;
    setSubChatText('');

    // Append to UI immediately
    const targetLvl = roadmap.levels.find(l => l.levelNumber === lvlNum);
    if (!targetLvl.chatHistory) targetLvl.chatHistory = [];
    targetLvl.chatHistory.push({ role: 'user', text: userMsg });

    try {
      const res = await fetch('/api/goals/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          levelNumber: lvlNum,
          message: userMsg
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat response failed');

      targetLvl.chatHistory.push({ role: 'model', text: data.reply });
      setRoadmap({ ...roadmap }); // trigger re-render
    } catch (err) {
      alert("Chat error: " + err.message);
    } finally {
      setSubChatLoading(false);
    }
  };

  const s = sym(profile?.currency || 'USD');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* ── BASELINE WIZARD ── */}
      {!baselineSubmitted && (
        <section className="card" style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', top: '1.5rem', right: '1.5rem',
            background: 'var(--primary-glow)', color: 'var(--primary)',
            fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.6rem',
            borderRadius: 20, border: '1px solid rgba(99,102,241,0.2)'
          }}>Step 3 — Baseline Wizard</span>

          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>Setup Financial Baseline</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: 650 }}>
            Before launching the goal roadmap builder, we need to understand your current savings, liabilities, and monthly core expenses.
          </p>

          <form onSubmit={submitBaseline}>
            {/* Savings input */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                Existing Savings & Cash ({profile?.currency || 'USD'})
              </label>
              <input
                type="number"
                className="form-input"
                value={savings}
                onChange={e => setSavings(Number(e.target.value))}
                placeholder="e.g. 5000"
                style={{ maxWidth: 300 }}
                required
              />
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                How much liquid savings do you currently have across your accounts?
              </span>
            </div>

            {/* Debt inputs */}
            <div style={{ marginBottom: '1.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>
                  Existing Debt & Liabilities
                </label>
                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }} onClick={addDebtItem}>
                  + Add Debt
                </button>
              </div>

              {debt.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No debt registered. Click Add Debt if you have credit cards or student loans.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {debt.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <input
                        className="form-input"
                        placeholder="Debt Type (e.g. Credit Card)"
                        value={item.type}
                        onChange={e => updateDebtItem(i, 'type', e.target.value)}
                        style={{ flex: 2 }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1.5 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{s}</span>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Amount"
                          value={item.amount}
                          onChange={e => updateDebtItem(i, 'amount', e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1.2 }}>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Rate %"
                          value={item.rate}
                          onChange={e => updateDebtItem(i, 'rate', e.target.value)}
                        />
                        <span style={{ color: 'var(--text-muted)' }}>%</span>
                      </div>
                      <button type="button" className="btn btn-text" style={{ color: 'var(--error)' }} onClick={() => removeDebtItem(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expenses inputs */}
            <div style={{ marginBottom: '2rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.75rem', display: 'block' }}>
                Core Monthly Living Expenses
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {monthlyExpenses.map((exp, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{exp.category}</span>
                      <strong style={{ fontSize: '0.95rem' }}>{s}{exp.amount.toLocaleString()}</strong>
                    </div>
                    <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => removeExpense(i)}>✕</button>
                  </div>
                ))}
              </div>

              {/* Dynamic expense adder */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-light)', padding: '1rem', borderRadius: 8 }}>
                <input
                  className="form-input"
                  placeholder="Custom Expense Category (e.g. Pet Care)"
                  value={customExpCategory}
                  onChange={e => setCustomExpCategory(e.target.value)}
                  style={{ flex: 2 }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1.5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{s}</span>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Monthly Amount"
                    value={customExpAmount}
                    onChange={e => setCustomExpAmount(e.target.value)}
                  />
                </div>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem 1.25rem' }} onClick={addCustomExpense}>
                  + Add Expense
                </button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-secondary" onClick={onBack}>← Back to Step 2</button>
              <button type="submit" className="btn btn-primary">Proceed to Goal Discovery →</button>
            </div>
          </form>
        </section>
      )}

      {/* ── GOAL DISCOVERY ENGINE CHAT & ROADMAP ── */}
      {baselineSubmitted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* Intake Chat Panel */}
          {!goalConfirmed && (
            <section className="card" style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', top: '1.5rem', right: '1.5rem',
                background: 'var(--success-glow)', color: 'var(--success)',
                fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.6rem',
                borderRadius: 20, border: '1px solid rgba(16,185,129,0.2)'
              }}>Goal Discovery Chat</span>

              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>Define Your Goal</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Tell ourpersonal finance AI what you are saving for. Be as descriptive as you like, or use one of the quick start options.
              </p>

              {/* Quick start chips */}
              {chatHistory.length === 0 && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  {[
                    ['🏡 First Home', 'I want to buy a house in 5 years costing 350000'],
                    ['🚗 Buy a Car', 'I want to buy a used sedan in 2 years costing 20000'],
                    ['🛡 Emergency Reserve', 'I want to secure a buffer of 15000 in 12 months'],
                    ['✈ Travel Trip', 'I want to travel to Europe next summer costing 8000']
                  ].map(([label, prompt]) => (
                    <button
                      key={label}
                      className="btn btn-secondary"
                      style={{ borderRadius: '20px', fontSize: '0.85rem', padding: '0.4rem 1rem' }}
                      onClick={() => handleGoalSubmit(prompt)}
                      disabled={loading}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Chat Log */}
              {chatHistory.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#07090e', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: 8, maxHeight: 300, overflowY: 'auto', marginBottom: '1.5rem' }}>
                  {chatHistory.map((chat, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignSelf: chat.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.15rem', alignSelf: chat.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        {chat.role === 'user' ? 'You' : 'FinOS Personal Finance Advisor'}
                      </span>
                      <div style={{
                        background: chat.role === 'user' ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                        color: 'var(--text-primary)',
                        padding: '0.75rem 1rem',
                        borderRadius: 12,
                        border: chat.role === 'user' ? 'none' : '1px solid var(--border-light)',
                        fontSize: '0.9rem',
                        lineHeight: 1.5
                      }}>
                        {chat.role === 'user' ? chat.text : renderFormattedText(chat.text)}
                      </div>

                    </div>
                  ))}
                  {loading && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <div className="loading-spinner" style={{ width: 14, height: 14 }} />
                      Analyzing goal targets...
                    </div>
                  )}
                </div>
              )}

              {/* Question follow-up input */}
              {needsClarification && !loading && (
                <div style={{ background: 'var(--primary-glow)', border: '1px solid rgba(99,102,241,0.2)', padding: '1rem', borderRadius: 8, marginBottom: '1.5rem' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>
                    Clarification Required ({currentQuestionIndex + 1} of {followUpQuestions.length})
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input
                      className="form-input"
                      placeholder="Type your answer here..."
                      id="clarification-input"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleClarificationAnswer(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      autoFocus
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        const input = document.getElementById('clarification-input');
                        if (input) {
                          handleClarificationAnswer(input.value);
                          input.value = '';
                        }
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Normal prompt input */}
              {!needsClarification && (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    className="form-input"
                    placeholder="e.g. I want to buy a house in 5 years costing 350000"
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGoalSubmit()}
                    disabled={loading}
                  />
                  <button className="btn btn-primary" onClick={() => handleGoalSubmit()} disabled={loading}>
                    Send
                  </button>
                </div>
              )}
            </section>
          )}


          {/* Roadmap level visualizer */}
          {roadmap && (
            activeLevelWorkspace !== null ? (
              <LevelWorkspace
                level={roadmap.levels.find(l => l.levelNumber === activeLevelWorkspace)}
                onBack={() => setActiveLevelWorkspace(null)}
                s={s}
                levelTab={levelTab}
                setLevelTab={setLevelTab}
                subChatText={subChatText}
                setSubChatText={setSubChatText}
                submitSubChat={submitSubChat}
                subChatLoading={subChatLoading}
                renderFormattedText={renderFormattedText}
              />
            ) : (
              <section className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
                      {goalConfirmed ? 'Your Active Roadmap' : 'Preview Roadmap'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                      Target: <strong>{s}{(useAlternative ? roadmap.alternativePlan?.targetCost || roadmap.targetCost : roadmap.targetCost).toLocaleString()}</strong> in <strong>{useAlternative ? roadmap.alternativePlan?.timelineYears || roadmap.timelineYears : roadmap.timelineYears} years</strong>
                    </p>
                  </div>

                  {/* Reset button if not confirmed */}
                  {!goalConfirmed && (
                    <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => { setRoadmap(null); setChatHistory([]); }}>
                      Modify Goal
                    </button>
                  )}
                </div>

                {/* Alternative plan toggle banner */}
                {(roadmap.stressLevel === 'high' || roadmap.stressLevel === 'impossible') && (
                  <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', padding: '1rem', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1, paddingRight: '1rem' }}>
                      <strong style={{ color: 'var(--accent)', fontSize: '0.95rem', display: 'block', marginBottom: '0.25rem' }}>
                        ⚠ Financial Stress Index: {roadmap.stressLevel.toUpperCase()}
                      </strong>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                        Saving {s}{roadmap.monthlyRequired}/month takes {((roadmap.monthlyRequired / (profile?.salary / 12 || 10000)) * 100).toFixed(0)}% of your income. We recommend a stress-free alternative.
                      </p>
                    </div>
                    <button
                      className={`btn ${useAlternative ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.85rem' }}
                      onClick={() => setUseAlternative(!useAlternative)}
                    >
                      {useAlternative ? '✓ Using Alternative Plan' : 'Switch to Alternative Plan'}
                    </button>
                  </div>
                )}

                {/* Stress / metrics summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: 8 }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monthly Target</span>
                    <strong style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>
                      {s}{(useAlternative ? roadmap.alternativePlan?.monthlyRequired || roadmap.monthlyRequired : roadmap.monthlyRequired).toLocaleString()}
                    </strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: 8 }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Timeline</span>
                    <strong style={{ fontSize: '1.4rem' }}>
                      {useAlternative ? roadmap.alternativePlan?.timelineYears || roadmap.timelineYears : roadmap.timelineYears} Years
                    </strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: 8 }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Feasibility</span>
                    <strong style={{ fontSize: '1.4rem', color: useAlternative || roadmap.stressLevel === 'low' ? 'var(--success)' : 'var(--accent)' }}>
                      {useAlternative ? 'Stress-Free' : roadmap.stressLevel.toUpperCase()}
                    </strong>
                  </div>
                </div>

                {/* Simplified levels list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
                  {(roadmap.levels || []).map((level) => {
                    const pct = level.targetAmount > 0 ? (level.currentAmount / level.targetAmount) * 100 : 100;

                    return (
                      <div
                        key={level.levelNumber}
                        style={{
                          border: '1px solid var(--border-light)',
                          borderRadius: 12,
                          padding: '1.25rem',
                          background: 'rgba(255,255,255,0.01)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                          transition: 'all 0.3s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <span style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: level.isCompleted ? 'var(--success-glow)' : 'var(--primary-glow)',
                              color: level.isCompleted ? 'var(--success)' : 'var(--primary)',
                              display: 'flex', justifyContent: 'center', alignItems: 'center',
                              fontSize: '0.85rem', fontWeight: 700,
                              border: `1px solid ${level.isCompleted ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`
                            }}>
                              {level.isCompleted ? '✓' : level.levelNumber}
                            </span>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Level {level.levelNumber} · {level.allocation}
                              </span>
                              <h3 style={{ fontSize: '1.05rem', margin: '0.15rem 0 0' }}>{level.title}</h3>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{
                              fontSize: '0.9rem', fontWeight: 700,
                              color: level.isCompleted ? 'var(--success)' : 'var(--text-primary)'
                            }}>
                              {pct.toFixed(0)}% Completed
                            </span>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
                              onClick={() => {
                                setActiveLevelWorkspace(level.levelNumber);
                                setLevelTab('what');
                              }}
                            >
                              Open Workspace →
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {level.targetAmount > 0 && (
                          <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: level.isCompleted ? 'var(--success)' : 'var(--primary)', transition: 'width 0.3s' }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Confirm / Continue Actions */}
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (goalConfirmed) {
                        setGoalConfirmed(false);
                        setStep3Done(false);
                      } else {
                        setBaselineSubmitted(false);
                      }
                    }}
                  >
                    ← Modify Baseline / Goal
                  </button>

                  {!goalConfirmed ? (
                    <button className="btn btn-primary" onClick={confirmAndSave} disabled={loading}>
                      Confirm and Save Roadmap →
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={onProceed}>
                      Proceed to Step 4: Build Safety Net →
                    </button>
                  )}
                </div>
              </section>
            )
          )}

        </div>
      )}

    </div>
  );
}

// ── Level Workspace Sub-page Component ──────────────────────────────────────
function LevelWorkspace({
  level,
  onBack,
  s,
  levelTab,
  setLevelTab,
  subChatText,
  setSubChatText,
  submitSubChat,
  subChatLoading,
  renderFormattedText
}) {
  const pct = level.targetAmount > 0 ? (level.currentAmount / level.targetAmount) * 100 : 100;

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '600px', background: 'rgba(10, 15, 30, 0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Workspace Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={onBack}>
            <span>←</span> Back to Dashboard
          </button>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Level {level.levelNumber} Workspace · {level.allocation}
            </span>
            <h2 style={{ fontSize: '1.4rem', margin: '0.15rem 0 0' }}>{level.title}</h2>
          </div>
        </div>
        <span style={{
          background: level.isCompleted ? 'var(--success-glow)' : 'var(--primary-glow)',
          color: level.isCompleted ? 'var(--success)' : 'var(--primary)',
          fontSize: '0.8rem', fontWeight: 700, padding: '0.35rem 0.75rem',
          borderRadius: 20, border: `1px solid ${level.isCompleted ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`
        }}>
          {level.isCompleted ? '✓ Objective Met' : 'Active Stage'}
        </span>
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem', flex: 1 }}>

        {/* Left Column: Metrics & Guides */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderRight: '1px solid var(--border-light)', paddingRight: '2rem' }}>

          {/* Progress Section */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: 8 }}>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Level Objective & Progress
            </span>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.75rem', fontWeight: 600 }}>{level.action}</p>
            {level.targetAmount > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>
                  <span>Completed</span>
                  <span>{s}{level.currentAmount.toLocaleString()} / {s}{level.targetAmount.toLocaleString()} ({pct.toFixed(0)}%)</span>
                </div>
                <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: level.isCompleted ? 'var(--success)' : 'var(--primary)', transition: 'width 0.3s' }} />
                </div>
              </div>
            )}
          </div>

          {/* Sub-tabs switch */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              ['what', '📖 What is this step?'],
              ['why', '🧠 Financial Rationale (Why?)'],
              ['where', '🏦 Storage & Asset Allocation'],
              ['how', '⚡ How to configure & execute']
            ].map(([tKey, label]) => (
              <button
                key={tKey}
                style={{
                  background: levelTab === tKey ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.01)',
                  border: '1px solid ' + (levelTab === tKey ? 'var(--primary)' : 'var(--border-light)'),
                  color: levelTab === tKey ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: levelTab === tKey ? 700 : 500,
                  fontSize: '0.9rem', cursor: 'pointer', outline: 'none',
                  padding: '0.65rem 0.85rem', borderRadius: 8,
                  textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'all 0.2s'
                }}
                onClick={() => setLevelTab(tKey)}
              >
                <span>{label}</span>
                {levelTab === tKey && <span style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>●</span>}
              </button>
            ))}
          </div>

          {/* Tab Explanation Details Area */}
          <div style={{
            flex: 1, minHeight: '180px', maxHeight: '280px', background: '#04060b', border: '1px solid var(--border-light)',
            padding: '1rem', borderRadius: 8, fontSize: '0.9rem', lineHeight: 1.6, overflowY: 'auto'
          }}>
            {levelTab === 'what' && renderFormattedText(level.what)}
            {levelTab === 'why' && renderFormattedText(level.why)}
            {levelTab === 'where' && renderFormattedText(level.where)}
            {levelTab === 'how' && renderFormattedText(level.how)}
          </div>

        </div>

        {/* Right Column: Chat Workspace */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
          <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Level Advisor Chat</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Ask anything specific to configuring this step of your roadmap.</p>
          </div>

          {/* Large subchat display */}
          <div style={{
            flex: 1, minHeight: '380px', maxHeight: '420px', overflowY: 'auto',
            background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)',
            borderRadius: 8, padding: '1rem', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '1rem'
          }}>
            {(!level.chatHistory || level.chatHistory.length === 0) ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💬</span>
                <p style={{ fontStyle: 'italic', margin: 0, textAlign: 'center', fontSize: '0.85rem' }}>
                  No questions asked yet.<br />Ask questions about interest rates, fund options, or setups here!
                </p>
              </div>
            ) : (
              level.chatHistory.map((m, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {m.role === 'user' ? 'You' : 'Level Advisor'}
                  </span>
                  <div style={{
                    background: m.role === 'user' ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                    padding: '0.75rem 1rem', borderRadius: 12,
                    border: m.role === 'user' ? 'none' : '1px solid var(--border-light)',
                    fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-primary)'
                  }}>{m.role === 'user' ? m.text : renderFormattedText(m.text)}</div>
                </div>
              ))
            )}
            {subChatLoading && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <div className="loading-spinner" style={{ width: 14, height: 14 }} />
                Level advisor typing response...
              </div>
            )}
          </div>

          {/* Subchat Input Form */}
          <form onSubmit={(e) => submitSubChat(e, level.levelNumber)} style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
            <input
              className="form-input"
              placeholder={`Ask a question about: ${level.title}...`}
              style={{ fontSize: '0.9rem', padding: '0.6rem 1rem' }}
              value={subChatText}
              onChange={e => setSubChatText(e.target.value)}
              disabled={subChatLoading}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem' }} disabled={subChatLoading}>
              Send
            </button>
          </form>
        </div>

      </div>
    </section>
  );
}

// ── Markdown Formatting Helpers ─────────────────────────────────────────────
function renderFormattedText(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    // Check if it's a bullet point
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const content = line.trim().substring(2);
      return (
        <li key={idx} style={{ marginLeft: '1rem', marginBottom: '0.25rem', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
          {parseInlineMarkdown(content)}
        </li>
      );
    }
    // Check if it's a numbered list
    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      return (
        <li key={idx} style={{ marginLeft: '1rem', marginBottom: '0.25rem', listStyleType: 'decimal', color: 'var(--text-secondary)' }}>
          {parseInlineMarkdown(numMatch[2])}
        </li>
      );
    }
    // Standard paragraph or empty line
    if (line.trim() === '') {
      return <div key={idx} style={{ height: '0.5rem' }} />;
    }
    return (
      <p key={idx} style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>
        {parseInlineMarkdown(line)}
      </p>
    );
  });
}

function parseInlineMarkdown(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}


