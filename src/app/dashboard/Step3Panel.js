'use client';

import { useState, useEffect } from 'react';

const CURRENCY_SYMBOLS = { USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$', INR: '₹', SGD: 'S$', JPY: '¥', NZD: 'NZ$' };
const sym = (currency) => CURRENCY_SYMBOLS[currency] || currency + ' ';

const COMMON_HYSA_BANKS = [
  'Marcus by Goldman Sachs',
  'Ally Bank',
  'Wealthfront',
  'SoFi',
  'Discover Bank',
  'American Express',
  'Apple Savings',
  'Capital One 360',
  'Other'
];

const COMMON_DEBT_CATEGORIES = [
  'Credit Card',
  'Student Loan',
  'Car Loan',
  'Mortgage',
  'Personal Loan',
  'Other'
];

export default function Step3Panel({ onBack, onProceed, setStep3Done }) {
  const [loading, setLoading] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null); // null | 'target' | 'surplus' | 'timeline' | 'feasibility'
  const [error, setError] = useState('');

  // Paycheck info
  const [profile, setProfile] = useState(null);

  // Baseline details
  const [baselineSubmitted, setBaselineSubmitted] = useState(false);
  const [savingsList, setSavingsList] = useState([
    { type: 'savings', bank: '', amount: 5000, rate: 0.5 }
  ]);
  const [debt, setDebt] = useState([{ type: 'Credit Card', customType: '', amount: 2500, rate: 18 }]);
  const [monthlyExpenses, setMonthlyExpenses] = useState([
    { category: 'Rent / Mortgage', amount: 1500 },
    { category: 'Groceries & Dining', amount: 400 },
    { category: 'Utilities', amount: 200 },
    { category: 'Transport', amount: 150 }
  ]);

  const savings = savingsList.reduce((sum, sItem) => sum + Number(sItem.amount || 0), 0);

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
  const [netTakeHomeMonthly, setNetTakeHomeMonthly] = useState(0);


  // Roadmap active tabs & subchat
  const [expandedLevel, setExpandedLevel] = useState(1);
  const [levelTab, setLevelTab] = useState('what'); // what | why | where | how | ask
  const [subChatText, setSubChatText] = useState('');
  const [subChatLoading, setSubChatLoading] = useState(false);

  // Fetch baseline and active goal on load
  useEffect(() => {
    setLoading(true);

    // Fetch tax information to get net monthly take-home pay
    fetch('/api/taxes')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(tData => {
        if (tData.taxBreakdown) {
          setNetTakeHomeMonthly(Math.round(tData.taxBreakdown.netPay / 12));
        }
      })
      .catch(err => console.error('Failed to load tax details in Step 3:', err));

    fetch('/api/goals')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        if (d.profile) setProfile(d.profile);
        if (d.activeGoal) {
          setSavingsList(d.activeGoal.savingsList || [
            { type: 'savings', bank: '', amount: d.activeGoal.savings || 0, rate: 0.5 }
          ]);
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

  // Savings list helpers
  const addSavingsItem = () => {
    setSavingsList([...savingsList, { type: 'savings', bank: '', amount: '', rate: 0.5 }]);
  };

  const updateSavingsItem = (index, field, value) => {
    const updated = savingsList.map((item, i) => {
      if (i !== index) return item;
      const newItem = { ...item, [field]: field === 'amount' || field === 'rate' ? Number(value) : value };
      
      // Auto-set default rates when type changes
      if (field === 'type') {
        if (value === 'savings') {
          newItem.rate = 0.5;
          newItem.bank = '';
        } else if (value === 'hysa') {
          newItem.rate = 4.5;
          newItem.bank = 'Marcus by Goldman Sachs';
        } else if (value === 'investment') {
          newItem.rate = 8.0;
          newItem.bank = '';
        }
      }
      return newItem;
    });
    setSavingsList(updated);
  };

  const removeSavingsItem = (index) => {
    setSavingsList(savingsList.filter((_, i) => i !== index));
  };

  // Add debt item with custom type support
  const addDebtItem = () => {
    setDebt([...debt, { type: 'Credit Card', customType: '', amount: '', rate: '' }]);
  };

  // Update debt fields
  const updateDebtItem = (index, field, value) => {
    const updated = debt.map((item, i) => {
      if (i !== index) return item;
      const newItem = { ...item, [field]: field === 'amount' || field === 'rate' ? Number(value) : value };
      if (field === 'type' && value !== 'Other') {
        newItem.customType = '';
      }
      return newItem;
    });
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
          savingsList,
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
            savingsList,
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
          savingsList,
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

  // Checklist progress helper
  const getLevelProgress = (level) => {
    if (!level.checklist) {
      const fallbackPct = level.targetAmount > 0 ? (level.currentAmount / level.targetAmount) * 100 : 100;
      return {
        pct: fallbackPct,
        isCompleted: fallbackPct === 100
      };
    }

    const setupItems = level.checklist.setup || [];
    const monthlyChecked = level.checklist.monthlyChecked;

    let monthlyDoneFraction = monthlyChecked ? 1 : 0;
    if (level.checklist.monthlyCustomAmount !== '' && level.checklist.monthlyCustomAmount !== undefined && level.checklist.monthlyCustomAmount !== null) {
      const customVal = Number(level.checklist.monthlyCustomAmount);
      if (customVal > 0) {
        const monthlyTarget = useAlternative
          ? roadmap?.alternativePlan?.monthlyRequired || roadmap?.monthlyRequired || 1
          : roadmap?.monthlyRequired || 1;
        monthlyDoneFraction = Math.min(1, customVal / monthlyTarget);
      }
    }

    const totalItems = setupItems.length + 1; // setup steps + monthly check
    const completedItems = setupItems.filter(s => s.completed).length + monthlyDoneFraction;
    const pct = totalItems > 0 ? (completedItems / totalItems) * 100 : 100;
    
    return {
      pct: pct,
      isCompleted: pct === 100
    };
  };

  const toggleChecklistItem = async (levelNumber, itemId) => {
    if (!roadmap) return;
    const updatedLevels = roadmap.levels.map(level => {
      if (level.levelNumber !== levelNumber) return level;
      
      const setup = (level.checklist?.setup || []).map(item => {
        if (item.id === itemId) {
          return { ...item, completed: !item.completed };
        }
        return item;
      });

      const updatedLevel = {
        ...level,
        checklist: {
          ...(level.checklist || {}),
          setup
        }
      };

      const { isCompleted } = getLevelProgress(updatedLevel);
      updatedLevel.isCompleted = isCompleted;

      return updatedLevel;
    });

    const updatedRoadmap = {
      ...roadmap,
      levels: updatedLevels
    };

    setRoadmap(updatedRoadmap);
    saveChecklistProgress(updatedRoadmap);
  };

  const updateMonthlyCheck = async (levelNumber, isChecked, customAmount) => {
    if (!roadmap) return;
    const updatedLevels = roadmap.levels.map(level => {
      if (level.levelNumber !== levelNumber) return level;

      const updatedLevel = {
        ...level,
        checklist: {
          ...(level.checklist || {}),
          monthlyChecked: isChecked !== null ? isChecked : level.checklist?.monthlyChecked,
          monthlyCustomAmount: customAmount !== null ? customAmount : (level.checklist?.monthlyCustomAmount || '')
        }
      };

      const { isCompleted } = getLevelProgress(updatedLevel);
      updatedLevel.isCompleted = isCompleted;

      return updatedLevel;
    });

    const updatedRoadmap = {
      ...roadmap,
      levels: updatedLevels
    };

    setRoadmap(updatedRoadmap);
    saveChecklistProgress(updatedRoadmap);
  };

  const saveChecklistProgress = async (updatedRoadmap) => {
    try {
      await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmGoal: true,
          savings,
          savingsList,
          debt,
          monthlyExpenses,
          goalData: {
            title: extractedParams.title || 'My Personal Goal',
            extractedParameters: extractedParams,
            roadmap: updatedRoadmap
          }
        })
      });
    } catch (err) {
      console.error('Failed to auto-save checklist progress:', err);
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
          message: userMsg,
          roadmap: roadmap,
          savings: savings,
          debt: debt,
          monthlyExpenses: monthlyExpenses,
          extractedParams: extractedParams
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
  const expensesSum = monthlyExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

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
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>
                  Existing Savings & Investments ({profile?.currency || 'USD'})
                </label>
                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }} onClick={addSavingsItem}>
                  + Add Account
                </button>
              </div>

              {savingsList.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No savings registered. Click Add Account to register a savings source.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {savingsList.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      
                      {/* Type dropdown */}
                      <select
                        className="form-input"
                        value={item.type}
                        onChange={e => updateSavingsItem(i, 'type', e.target.value)}
                        style={{ flex: 1.5, minWidth: '130px' }}
                      >
                        <option value="savings">Savings Account</option>
                        <option value="hysa">HYSA</option>
                        <option value="investment">Other Investments (Stocks/Gold)</option>
                      </select>

                      {/* HYSA bank dropdown or custom input */}
                      {item.type === 'hysa' && (
                        <select
                          className="form-input"
                          value={COMMON_HYSA_BANKS.includes(item.bank) ? item.bank : 'Other'}
                          onChange={e => {
                            const val = e.target.value;
                            updateSavingsItem(i, 'bank', val === 'Other' ? '' : val);
                          }}
                          style={{ flex: 1.5, minWidth: '150px' }}
                        >
                          {COMMON_HYSA_BANKS.map((bName) => (
                            <option key={bName} value={bName}>{bName}</option>
                          ))}
                        </select>
                      )}

                      {/* Custom bank name input for HYSA if "Other" is active */}
                      {item.type === 'hysa' && !COMMON_HYSA_BANKS.filter(b => b !== 'Other').includes(item.bank) && (
                        <input
                          className="form-input"
                          placeholder="Custom Bank Name"
                          value={item.bank || ''}
                          onChange={e => updateSavingsItem(i, 'bank', e.target.value)}
                          style={{ flex: 1.2, minWidth: '110px' }}
                          required
                        />
                      )}

                      {/* Amount input */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1.2, minWidth: '100px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{s}</span>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Amount"
                          value={item.amount}
                          onChange={e => updateSavingsItem(i, 'amount', e.target.value)}
                          required
                        />
                      </div>

                      {/* Interest Rate input */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1.0, minWidth: '80px' }}>
                        <input
                          type="number"
                          step="0.1"
                          className="form-input"
                          placeholder="Rate %"
                          value={item.rate}
                          onChange={e => updateSavingsItem(i, 'rate', e.target.value)}
                          required
                        />
                        <span style={{ color: 'var(--text-muted)' }}>%</span>
                      </div>

                      <button type="button" className="btn btn-text" style={{ color: 'var(--error)' }} onClick={() => removeSavingsItem(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
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
                    <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      
                      {/* Type Selection */}
                      <select
                        className="form-input"
                        value={COMMON_DEBT_CATEGORIES.includes(item.type) ? item.type : 'Other'}
                        onChange={e => {
                          const val = e.target.value;
                          updateDebtItem(i, 'type', val === 'Other' ? '' : val);
                        }}
                        style={{ flex: 1.5, minWidth: '130px' }}
                      >
                        {COMMON_DEBT_CATEGORIES.map((cName) => (
                          <option key={cName} value={cName}>{cName}</option>
                        ))}
                      </select>

                      {/* Custom input if Other is active */}
                      {!COMMON_DEBT_CATEGORIES.filter(c => c !== 'Other').includes(item.type) && (
                        <input
                          className="form-input"
                          placeholder="Custom Debt Name"
                          value={item.type || ''}
                          onChange={e => updateDebtItem(i, 'type', e.target.value)}
                          style={{ flex: 1.5, minWidth: '130px' }}
                          required
                        />
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1.2, minWidth: '100px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{s}</span>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Amount"
                          value={item.amount}
                          onChange={e => updateDebtItem(i, 'amount', e.target.value)}
                          required
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1.0, minWidth: '80px' }}>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Rate %"
                          value={item.rate}
                          onChange={e => updateDebtItem(i, 'rate', e.target.value)}
                          required
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

            {/* Live Cash Flow Summary */}
            {netTakeHomeMonthly > 0 && (
              <div style={{
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                borderRadius: 12,
                padding: '1.25rem',
                marginBottom: '1.5rem'
              }}>
                <h4 style={{ fontSize: '0.95rem', margin: '0 0 0.75rem 0', color: 'var(--primary)', fontWeight: 600 }}>Monthly Cash Flow Summary</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Take-home Pay</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{s}{netTakeHomeMonthly.toLocaleString()}/mo</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Core Expenses</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--accent)' }}>{s}{expensesSum.toLocaleString()}/mo</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Left for Roadmap</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--success)' }}>
                      {s}{(netTakeHomeMonthly - expensesSum).toLocaleString()}/mo
                    </strong>
                  </div>
                </div>
                {netTakeHomeMonthly - expensesSum <= 0 && (
                  <p style={{ color: 'var(--error)', fontSize: '0.8rem', margin: '0.75rem 0 0 0', fontWeight: 500 }}>
                    ⚠ Warning: Core expenses exceed your monthly take-home pay. You will have $0 left to allocate to goals.
                  </p>
                )}
              </div>
            )}

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
                roadmap={roadmap}
                useAlternative={useAlternative}
                getLevelProgress={getLevelProgress}
                toggleChecklistItem={toggleChecklistItem}
                updateMonthlyCheck={updateMonthlyCheck}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  {/* Monthly Target Card */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Monthly Target</span>
                      <button
                        type="button"
                        onClick={() => setActiveTooltip(activeTooltip === 'target' ? null : 'target')}
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: activeTooltip === 'target' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                          color: activeTooltip === 'target' ? '#fff' : 'var(--text-secondary)',
                          fontSize: '10px',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          border: '1px solid var(--border-light)',
                          outline: 'none',
                          padding: 0,
                          lineHeight: 1
                        }}
                      >
                        i
                      </button>
                    </div>
                    <strong style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>
                      {s}{(useAlternative ? roadmap.alternativePlan?.monthlyRequired || roadmap.monthlyRequired : roadmap.monthlyRequired).toLocaleString()}
                    </strong>
                    {activeTooltip === 'target' && (
                      <div style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        marginTop: '0.75rem',
                        borderTop: '1px solid var(--border-light)',
                        paddingTop: '0.5rem',
                        lineHeight: '1.4'
                      }}>
                        The amount you need to save each month to hit your primary goal within the selected timeline.
                      </div>
                    )}
                  </div>

                  {/* Your Monthly Surplus Card */}
                  {netTakeHomeMonthly > 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Your Monthly Surplus</span>
                        <button
                          type="button"
                          onClick={() => setActiveTooltip(activeTooltip === 'surplus' ? null : 'surplus')}
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: activeTooltip === 'surplus' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                            color: activeTooltip === 'surplus' ? '#fff' : 'var(--text-secondary)',
                            fontSize: '10px',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            border: '1px solid var(--border-light)',
                            outline: 'none',
                            padding: 0,
                            lineHeight: 1
                          }}
                        >
                          i
                        </button>
                      </div>
                      <strong style={{ fontSize: '1.4rem', color: 'var(--success)' }}>
                        {s}{(netTakeHomeMonthly - expensesSum).toLocaleString()}
                      </strong>
                      {activeTooltip === 'surplus' && (
                        <div style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          marginTop: '0.75rem',
                          borderTop: '1px solid var(--border-light)',
                          paddingTop: '0.5rem',
                          lineHeight: '1.4'
                        }}>
                          Your net monthly take-home pay minus your core expenses (the money available to save or invest).
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timeline Card */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Timeline</span>
                      <button
                        type="button"
                        onClick={() => setActiveTooltip(activeTooltip === 'timeline' ? null : 'timeline')}
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: activeTooltip === 'timeline' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                          color: activeTooltip === 'timeline' ? '#fff' : 'var(--text-secondary)',
                          fontSize: '10px',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          border: '1px solid var(--border-light)',
                          outline: 'none',
                          padding: 0,
                          lineHeight: 1
                        }}
                      >
                        i
                      </button>
                    </div>
                    <strong style={{ fontSize: '1.4rem' }}>
                      {useAlternative ? roadmap.alternativePlan?.timelineYears || roadmap.timelineYears : roadmap.timelineYears} Years
                    </strong>
                    {activeTooltip === 'timeline' && (
                      <div style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        marginTop: '0.75rem',
                        borderTop: '1px solid var(--border-light)',
                        paddingTop: '0.5rem',
                        lineHeight: '1.4'
                      }}>
                        The duration allocated to achieve your primary goal. Can be extended to reduce monthly savings stress.
                      </div>
                    )}
                  </div>

                  {/* Feasibility Card */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Feasibility</span>
                      <button
                        type="button"
                        onClick={() => setActiveTooltip(activeTooltip === 'feasibility' ? null : 'feasibility')}
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: activeTooltip === 'feasibility' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                          color: activeTooltip === 'feasibility' ? '#fff' : 'var(--text-secondary)',
                          fontSize: '10px',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          border: '1px solid var(--border-light)',
                          outline: 'none',
                          padding: 0,
                          lineHeight: 1
                        }}
                      >
                        i
                      </button>
                    </div>
                    <strong style={{
                      fontSize: '1.4rem',
                      color: (useAlternative || roadmap.stressLevel === 'low')
                        ? 'var(--success)'
                        : roadmap.stressLevel === 'medium'
                          ? 'var(--accent)'
                          : 'var(--error)'
                    }}>
                      {useAlternative ? 'HIGH (Stress-Free)' : {
                        low: 'HIGH',
                        medium: 'MODERATE',
                        high: 'LOW',
                        impossible: 'UNFEASIBLE'
                      }[roadmap.stressLevel] || 'UNKNOWN'}
                    </strong>
                    {activeTooltip === 'feasibility' && (
                      <div style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        marginTop: '0.75rem',
                        borderTop: '1px solid var(--border-light)',
                        paddingTop: '0.5rem',
                        lineHeight: '1.4'
                      }}>
                        How realistic your goal is based on the savings ratio (Monthly Target / Monthly Surplus). HIGH: ≤ 20%, MODERATE: ≤ 40%, LOW: ≤ 60%, UNFEASIBLE: &gt; 60%.
                      </div>
                    )}
                  </div>
                </div>

                {/* Simplified levels list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
                  {(roadmap.levels || []).map((level) => {
                    const { pct, isCompleted } = getLevelProgress(level);

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
                              background: isCompleted ? 'var(--success-glow)' : 'var(--primary-glow)',
                              color: isCompleted ? 'var(--success)' : 'var(--primary)',
                              display: 'flex', justifyContent: 'center', alignItems: 'center',
                              fontSize: '0.85rem', fontWeight: 700,
                              border: `1px solid ${isCompleted ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`
                            }}>
                              {isCompleted ? '✓' : level.levelNumber}
                            </span>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Level {level.levelNumber} · {level.allocation}
                              </span>
                              <h3 style={{ fontSize: '1.05rem', margin: '0.15rem 0 0' }}>{level.title}</h3>
                              <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 500 }}>
                                {level.targetAmount === 0 ? 'No target amount' : `Target Amount: ${s}${level.targetAmount.toLocaleString()}`}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{
                              fontSize: '0.9rem', fontWeight: 700,
                              color: isCompleted ? 'var(--success)' : 'var(--text-primary)'
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
                            <div style={{ width: `${pct}%`, height: '100%', background: isCompleted ? 'var(--success)' : 'var(--primary)', transition: 'width 0.3s' }} />
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 600, fontSize: '0.95rem' }}>
                      ✓ Roadmap Confirmed & Active
                    </div>
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
  renderFormattedText,
  roadmap,
  useAlternative,
  getLevelProgress,
  toggleChecklistItem,
  updateMonthlyCheck
}) {
  const { pct, isCompleted } = getLevelProgress(level);

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
          background: isCompleted ? 'var(--success-glow)' : 'var(--primary-glow)',
          color: isCompleted ? 'var(--success)' : 'var(--primary)',
          fontSize: '0.8rem', fontWeight: 700, padding: '0.35rem 0.75rem',
          borderRadius: 20, border: `1px solid ${isCompleted ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`
        }}>
          {isCompleted ? '✓ Objective Met' : 'Active Stage'}
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
                  <span>{pct.toFixed(0)}%</span>
                </div>
                <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: isCompleted ? 'var(--success)' : 'var(--primary)', transition: 'width 0.3s' }} />
                </div>
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <strong>Total Target Amount:</strong> {s}{level.targetAmount.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Checklist Section */}
          {level.checklist && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Level Action Checklist
              </span>
              
              {/* Setup steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.50rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>1. Setup Quests:</span>
                {(level.checklist.setup || []).map((quest) => (
                  <label key={quest.id} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', alignItems: 'flex-start', cursor: 'pointer', color: quest.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={quest.completed || false}
                      onChange={() => toggleChecklistItem(level.levelNumber, quest.id)}
                      style={{ marginTop: '0.15rem' }}
                    />
                    <span style={{ textDecoration: quest.completed ? 'line-through' : 'none' }}>
                      {quest.label}
                    </span>
                  </label>
                ))}
              </div>

              {/* Monthly check-in */}
              <div style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.50rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>2. Monthly Deposit Check-in:</span>
                <p style={{ fontSize: '0.82rem', margin: 0, color: 'var(--text-muted)' }}>
                  Did you make a deposit towards this goal level this month?
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`btn ${level.checklist.monthlyChecked ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                    onClick={() => updateMonthlyCheck(level.levelNumber, true, '')}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`btn ${(!level.checklist.monthlyChecked && level.checklist.monthlyCustomAmount === '') ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                    onClick={() => updateMonthlyCheck(level.levelNumber, false, '')}
                  >
                    No
                  </button>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>or enter:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s}</span>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Custom Amount"
                      value={level.checklist.monthlyCustomAmount || ''}
                      onChange={(e) => updateMonthlyCheck(level.levelNumber, false, e.target.value)}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', width: '100px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

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
            flex: 1, minHeight: '380px', overflowY: 'auto',
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


