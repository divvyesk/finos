'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

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

export default function Step3Panel({ onBack, onProceed, setStep3Done, onChecklistCompleted, setPennyMode }) {
  const [loading, setLoading] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null); // null | 'target' | 'surplus' | 'timeline' | 'feasibility'
  const [error, setError] = useState('');
  const [portalTarget, setPortalTarget] = useState(null);

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

  useEffect(() => {
    if (activeLevelWorkspace !== null) {
      if (setPennyMode) setPennyMode('workspace');
    } else {
      if (setPennyMode) setPennyMode('none');
    }
  }, [activeLevelWorkspace, setPennyMode]);
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
        }
      })
      .catch(err => {
        console.error("Failed to load goals info:", err);
        setError("Could not load your financial context. Make sure you completed Step 1.");
      })
      .finally(() => setLoading(false));
    setPortalTarget(document.getElementById('penny-portal-target'));
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

  useEffect(() => {
    if (!goalConfirmed || !roadmap || !roadmap.levels || roadmap.levels.length === 0) {
      setStep3Done(false);
      return;
    }
    const allCompleted = roadmap.levels.every(level => {
      const { isCompleted } = getLevelProgress(level);
      return isCompleted;
    });
    setStep3Done(allCompleted);
  }, [roadmap, goalConfirmed, setStep3Done]);

  const toggleChecklistItem = async (levelNumber, itemId) => {
    if (!roadmap) return;
    const updatedLevels = roadmap.levels.map(level => {
      if (level.levelNumber !== levelNumber) return level;

      const setup = (level.checklist?.setup || []).map(item => {
        if (item.id === itemId) {
          const newlyCompleted = !item.completed;
          if (newlyCompleted && onChecklistCompleted) {
            onChecklistCompleted();
          }
          return { ...item, completed: newlyCompleted };
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.75rem', marginBottom: '1.75rem' }}>

              {/* Savings inputs */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '1.75rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '1.05rem', letterSpacing: '-0.01em', margin: 0 }}>
                    Savings & Investments
                  </label>
                  <button type="button" style={{ fontSize: '0.85rem', padding: '0.35rem 0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-primary)' }} onClick={addSavingsItem}>
                    + Add
                  </button>
                </div>

                {savingsList.length === 0 ? (
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', margin: 'auto' }}>No savings registered.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {savingsList.map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <select
                          className="form-input"
                          value={item.type === 'hysa' && COMMON_HYSA_BANKS.includes(item.bank) ? item.bank : item.type}
                          onChange={e => {
                            const val = e.target.value;
                            if (COMMON_HYSA_BANKS.includes(val)) {
                              updateSavingsItem(i, 'type', 'hysa');
                              updateSavingsItem(i, 'bank', val);
                            } else {
                              updateSavingsItem(i, 'type', val);
                            }
                          }}
                          style={{ flex: 1.5, minWidth: '110px', fontSize: '0.95rem', padding: '0.5rem 0.75rem', height: '38px' }}
                        >
                          <option value="savings">Savings</option>
                          <option value="investment">Investments</option>
                          <optgroup label="HYSA">
                            {COMMON_HYSA_BANKS.map((bName) => (
                              <option key={bName} value={bName}>{bName}</option>
                            ))}
                          </optgroup>
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0 0.75rem', flex: 1.2, height: '38px' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{s}</span>
                          <input
                            type="number"
                            placeholder="Amt"
                            value={item.amount}
                            onChange={e => updateSavingsItem(i, 'amount', e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', fontSize: '0.95rem', outline: 'none' }}
                            required
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0 0.75rem', flex: 0.8, height: '38px' }}>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Rate"
                            value={item.rate}
                            onChange={e => updateSavingsItem(i, 'rate', e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', fontSize: '0.95rem', outline: 'none' }}
                            required
                          />
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>%</span>
                        </div>
                        <button type="button" style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.3rem' }} onClick={() => removeSavingsItem(i)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Debt inputs */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '1.75rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '1.05rem', letterSpacing: '-0.01em', margin: 0 }}>
                    Debt & Liabilities
                  </label>
                  <button type="button" style={{ fontSize: '0.85rem', padding: '0.35rem 0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-primary)' }} onClick={addDebtItem}>
                    + Add
                  </button>
                </div>

                {debt.length === 0 ? (
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', margin: 'auto' }}>No debt registered.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {debt.map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <select
                          className="form-input"
                          value={COMMON_DEBT_CATEGORIES.includes(item.type) ? item.type : 'Other'}
                          onChange={e => {
                            const val = e.target.value;
                            updateDebtItem(i, 'type', val === 'Other' ? '' : val);
                          }}
                          style={{ flex: 1.5, minWidth: '110px', fontSize: '0.95rem', padding: '0.5rem 0.75rem', height: '38px' }}
                        >
                          {COMMON_DEBT_CATEGORIES.map((cName) => (
                            <option key={cName} value={cName}>{cName}</option>
                          ))}
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0 0.75rem', flex: 1.2, height: '38px' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{s}</span>
                          <input
                            type="number"
                            placeholder="Amt"
                            value={item.amount}
                            onChange={e => updateDebtItem(i, 'amount', e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', fontSize: '0.95rem', outline: 'none' }}
                            required
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0 0.75rem', flex: 0.8, height: '38px' }}>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Rate"
                            value={item.rate}
                            onChange={e => updateDebtItem(i, 'rate', e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', fontSize: '0.95rem', outline: 'none' }}
                            required
                          />
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>%</span>
                        </div>
                        <button type="button" style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.3rem' }} onClick={() => removeDebtItem(i)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Expenses inputs */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '1.75rem', marginBottom: '1.75rem' }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '1.05rem', letterSpacing: '-0.01em', marginBottom: '1.25rem', display: 'block' }}>
                Core Monthly Living Expenses
              </label>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {monthlyExpenses.map((exp, i) => (
                  <div key={i} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '24px', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>{exp.category}</span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{s}{exp.amount.toLocaleString()}</strong>
                    <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, marginLeft: '0.2rem', display: 'flex', alignItems: 'center', fontSize: '1rem' }} onClick={() => removeExpense(i)}>✕</button>
                  </div>
                ))}
              </div>

              {/* Dynamic expense adder */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', padding: '0.4rem', borderRadius: '12px', width: 'fit-content', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Expense (e.g. Pet Care)"
                  value={customExpCategory}
                  onChange={e => setCustomExpCategory(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem', padding: '0.3rem 0.6rem', minWidth: '160px' }}
                />
                <div style={{ width: '1px', height: '20px', background: 'var(--border-light)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', paddingLeft: '0.5rem' }}>{s}</span>
                <input
                  type="number"
                  placeholder="Amount"
                  value={customExpAmount}
                  onChange={e => setCustomExpAmount(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem', padding: '0.3rem', width: '90px' }}
                />
                <button type="button" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)', border: 'none', borderRadius: '10px', padding: '0.4rem 1rem', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }} onClick={addCustomExpense}>
                  Add
                </button>
              </div>
            </div>

            {/* Live Cash Flow Summary & Submit */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '1.5rem 1.75rem', flexWrap: 'wrap' }}>

              <div style={{ display: 'flex', gap: '2.5rem', flex: 1, minWidth: '320px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Take-home</span>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{s}{netTakeHomeMonthly.toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Expenses</span>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--accent)' }}>{s}{expensesSum.toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Left for Goals</span>
                  <strong style={{ fontSize: '1.25rem', color: netTakeHomeMonthly - expensesSum <= 0 ? 'var(--error)' : 'var(--success)' }}>
                    {s}{(netTakeHomeMonthly - expensesSum).toLocaleString()}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button type="button" className="btn btn-secondary" style={{ borderRadius: '20px', padding: '0.75rem 1.5rem', fontSize: '1rem' }} onClick={onBack}>Back</button>
                <button type="submit" className="btn btn-primary" style={{ borderRadius: '20px', padding: '0.75rem 1.75rem', fontSize: '1rem', fontWeight: 600, background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>Proceed →</button>
              </div>
            </div>

            {netTakeHomeMonthly - expensesSum <= 0 && netTakeHomeMonthly > 0 && (
              <p style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '0.75rem', fontWeight: 500, textAlign: 'center' }}>
                ⚠ Warning: Core expenses exceed your monthly take-home pay.
              </p>
            )}
          </form>
        </section>
      )}

      {/* ── GOAL DISCOVERY ENGINE CHAT & ROADMAP ── */}
      {baselineSubmitted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* Intake Chat Panel */}
          {!goalConfirmed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.65)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '24px',
                padding: '2rem',
                boxShadow: '0 12px 48px rgba(0,0,0,0.06)',
              }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 600, letterSpacing: '-0.02em', color: '#1d1d1f', marginBottom: '0.5rem' }}>Chat with Penny</h3>
                <p style={{ color: '#86868b', fontSize: '0.95rem', marginBottom: '1.5rem', fontWeight: 400 }}>
                  Tell me what you are saving for!
                </p>

                {/* Quick start chips */}
                {chatHistory.length === 0 && (
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                    {[
                      ['First Home', 'I want to buy a house in 5 years costing 350000'],
                      ['Buy a Car', 'I want to buy a used sedan in 2 years costing 20000'],
                      ['Emergency Reserve', 'I want to secure a buffer of 15000 in 12 months'],
                      ['Travel Trip', 'I want to travel to Europe next summer costing 8000']
                    ].map(([label, prompt]) => (
                      <button
                        key={label}
                        style={{
                          background: 'rgba(0,0,0,0.05)',
                          border: 'none',
                          color: '#1d1d1f',
                          borderRadius: '20px',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          padding: '0.55rem 1rem',
                          cursor: 'pointer',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(0,0,0,0.08)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(0,0,0,0.05)'}
                        onClick={() => setGoalInput(prompt)}
                        disabled={loading}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Chat Log */}
                {chatHistory.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: 300, overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.5rem' }}>
                    {chatHistory.map((chat, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignSelf: chat.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                        <span style={{ fontSize: '0.75rem', color: '#86868b', marginBottom: '0.3rem', alignSelf: chat.role === 'user' ? 'flex-end' : 'flex-start', fontWeight: 500 }}>
                          {chat.role === 'user' ? 'You' : 'Penny'}
                        </span>
                        <div style={{
                          background: chat.role === 'user' ? '#0071e3' : '#e9e9eb',
                          color: chat.role === 'user' ? '#fff' : '#1d1d1f',
                          padding: '0.8rem 1.1rem',
                          borderRadius: chat.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          fontSize: '0.95rem',
                          lineHeight: 1.5,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                        }}>
                          {chat.role === 'user' ? chat.text : renderFormattedText(chat.text)}
                        </div>
                      </div>
                    ))}
                    {loading && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#86868b', fontSize: '0.85rem', fontWeight: 500 }}>
                        <div className="loading-spinner" style={{ width: 14, height: 14 }} />
                        Analyzing...
                      </div>
                    )}
                  </div>
                )}

                {/* Question follow-up input */}
                {needsClarification && !loading && (
                  <div style={{ background: '#f5f5f7', padding: '1rem', borderRadius: '20px' }}>
                    <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1d1d1f', marginBottom: '0.75rem' }}>
                      Clarification ({currentQuestionIndex + 1}/{followUpQuestions.length})
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', background: '#fff', borderRadius: '16px', padding: '0.4rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      <input
                        placeholder="Your answer..."
                        id="clarification-input"
                        style={{ fontSize: '0.95rem', padding: '0.5rem 0.8rem', border: 'none', background: 'transparent', outline: 'none', flex: 1, color: '#1d1d1f' }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            handleClarificationAnswer(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        autoFocus
                      />
                      <button
                        style={{ background: '#1d1d1f', color: '#fff', border: 'none', borderRadius: '14px', padding: '0.6rem 1.25rem', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer' }}
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
                  <div style={{ display: 'flex', gap: '0.5rem', background: '#f5f5f7', borderRadius: '24px', padding: '0.4rem', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <input
                      placeholder="e.g. I want to buy a house in 5 years costing 350000"
                      value={goalInput}
                      style={{ fontSize: '0.95rem', padding: '0.6rem 1rem', border: 'none', background: 'transparent', outline: 'none', flex: 1, color: '#1d1d1f' }}
                      onChange={e => setGoalInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleGoalSubmit()}
                      disabled={loading}
                    />
                    <button
                      style={{
                        background: '#1d1d1f',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '0.6rem 1.4rem',
                        fontSize: '0.95rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        opacity: loading ? 0.7 : 1
                      }}
                      onClick={() => handleGoalSubmit()}
                      disabled={loading}
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            </div>
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
              <section style={{
                background: 'rgba(255, 255, 255, 0.65)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '24px',
                padding: '2.5rem',
                boxShadow: '0 12px 48px rgba(0,0,0,0.06)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 600, letterSpacing: '-0.03em', color: '#1d1d1f', marginBottom: '0.4rem' }}>
                      {goalConfirmed ? 'Your Active Roadmap' : 'Preview Roadmap'}
                    </h2>
                    <p style={{ color: '#86868b', fontSize: '1rem', margin: 0, fontWeight: 400 }}>
                      Target: <strong style={{ color: '#1d1d1f' }}>{s}{(useAlternative ? roadmap.alternativePlan?.targetCost || roadmap.targetCost : roadmap.targetCost).toLocaleString()}</strong> in <strong style={{ color: '#1d1d1f' }}>{useAlternative ? roadmap.alternativePlan?.timelineYears || roadmap.timelineYears : roadmap.timelineYears} years</strong>
                    </p>
                  </div>
                </div>

                {/* Alternative plan toggle banner */}
                {(roadmap.stressLevel === 'high' || roadmap.stressLevel === 'impossible') && (
                  <div style={{ background: '#fff2f2', padding: '1.25rem 1.5rem', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ flex: 1, paddingRight: '1rem' }}>
                      <strong style={{ color: '#d93025', fontSize: '1rem', display: 'block', marginBottom: '0.3rem', letterSpacing: '-0.01em' }}>
                        ⚠ Financial Stress Index: {roadmap.stressLevel.toUpperCase()}
                      </strong>
                      <p style={{ color: '#86868b', fontSize: '0.9rem', margin: 0, lineHeight: 1.4 }}>
                        Saving {s}{roadmap.monthlyRequired}/month takes {((roadmap.monthlyRequired / (profile?.salary / 12 || 10000)) * 100).toFixed(0)}% of your income. We recommend a stress-free alternative.
                      </p>
                    </div>
                    <button
                      style={{
                        background: useAlternative ? '#1d1d1f' : 'rgba(0,0,0,0.05)',
                        color: useAlternative ? '#fff' : '#1d1d1f',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap'
                      }}
                      onClick={() => setUseAlternative(!useAlternative)}
                    >
                      {useAlternative ? '✓ Using Alternative Plan' : 'Switch to Alternative Plan'}
                    </button>
                  </div>
                )}

                {/* Stress / metrics summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
                  {/* Monthly Target Card */}
                  <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 14px rgba(0,0,0,0.03)', padding: '1.5rem', borderRadius: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#86868b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Monthly Target</span>
                      <button
                        type="button"
                        onClick={() => setActiveTooltip(activeTooltip === 'target' ? null : 'target')}
                        style={{
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: activeTooltip === 'target' ? '#1d1d1f' : 'rgba(0,0,0,0.06)',
                          color: activeTooltip === 'target' ? '#fff' : '#86868b',
                          fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer'
                        }}
                      >i</button>
                    </div>
                    <strong style={{ fontSize: '1.5rem', color: '#1d1d1f', letterSpacing: '-0.03em' }}>
                      {s}{(useAlternative ? roadmap.alternativePlan?.monthlyRequired || roadmap.monthlyRequired : roadmap.monthlyRequired).toLocaleString()}
                    </strong>
                    {activeTooltip === 'target' && (
                      <div style={{ fontSize: '0.85rem', color: '#86868b', marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '0.75rem', lineHeight: '1.4' }}>
                        The amount you need to save each month to hit your primary goal within the selected timeline.
                      </div>
                    )}
                  </div>

                  {/* Your Monthly Surplus Card */}
                  {netTakeHomeMonthly > 0 && (
                    <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 14px rgba(0,0,0,0.03)', padding: '1.5rem', borderRadius: '20px', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#86868b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Your Monthly Surplus</span>
                        <button
                          type="button"
                          onClick={() => setActiveTooltip(activeTooltip === 'surplus' ? null : 'surplus')}
                          style={{
                            width: '22px', height: '22px', borderRadius: '50%',
                            background: activeTooltip === 'surplus' ? '#1d1d1f' : 'rgba(0,0,0,0.06)',
                            color: activeTooltip === 'surplus' ? '#fff' : '#86868b',
                            fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer'
                          }}
                        >i</button>
                      </div>
                      <strong style={{ fontSize: '1.5rem', color: '#575c8d', letterSpacing: '-0.03em' }}>
                        {s}{(netTakeHomeMonthly - expensesSum).toLocaleString()}
                      </strong>
                      {activeTooltip === 'surplus' && (
                        <div style={{ fontSize: '0.85rem', color: '#86868b', marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '0.75rem', lineHeight: '1.4' }}>
                          Your net monthly take-home pay minus your core expenses (the money available to save or invest).
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timeline Card */}
                  <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 14px rgba(0,0,0,0.03)', padding: '1.5rem', borderRadius: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#86868b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Timeline</span>
                      <button
                        type="button"
                        onClick={() => setActiveTooltip(activeTooltip === 'timeline' ? null : 'timeline')}
                        style={{
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: activeTooltip === 'timeline' ? '#1d1d1f' : 'rgba(0,0,0,0.06)',
                          color: activeTooltip === 'timeline' ? '#fff' : '#86868b',
                          fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer'
                        }}
                      >i</button>
                    </div>
                    <strong style={{ fontSize: '1.5rem', color: '#1d1d1f', letterSpacing: '-0.03em' }}>
                      {useAlternative ? roadmap.alternativePlan?.timelineYears || roadmap.timelineYears : roadmap.timelineYears} Years
                    </strong>
                    {activeTooltip === 'timeline' && (
                      <div style={{ fontSize: '0.85rem', color: '#86868b', marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '0.75rem', lineHeight: '1.4' }}>
                        The duration allocated to achieve your primary goal. Can be extended to reduce monthly savings stress.
                      </div>
                    )}
                  </div>

                  {/* Feasibility Card */}
                  <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 14px rgba(0,0,0,0.03)', padding: '1.5rem', borderRadius: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#86868b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Feasibility</span>
                      <button
                        type="button"
                        onClick={() => setActiveTooltip(activeTooltip === 'feasibility' ? null : 'feasibility')}
                        style={{
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: activeTooltip === 'feasibility' ? '#1d1d1f' : 'rgba(0,0,0,0.06)',
                          color: activeTooltip === 'feasibility' ? '#fff' : '#86868b',
                          fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer'
                        }}
                      >i</button>
                    </div>
                    <strong style={{
                      fontSize: '1.5rem',
                      letterSpacing: '-0.03em',
                      color: (useAlternative || roadmap.stressLevel === 'low')
                        ? '#575c8d'
                        : roadmap.stressLevel === 'medium'
                          ? '#ff9500'
                          : '#ff3b30'
                    }}>
                      {useAlternative ? 'HIGH' : {
                        low: 'HIGH',
                        medium: 'MODERATE',
                        high: 'LOW',
                        impossible: 'UNFEASIBLE'
                      }[roadmap.stressLevel] || 'UNKNOWN'}
                    </strong>
                    {activeTooltip === 'feasibility' && (
                      <div style={{ fontSize: '0.85rem', color: '#86868b', marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '0.75rem', lineHeight: '1.4' }}>
                        How realistic your goal is based on the savings ratio.
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
  const [showChat, setShowChat] = useState(false);

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '600px', background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(24px)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', borderRadius: '24px', padding: '2rem' }}>
      {/* Workspace Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button className="btn btn-secondary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: '12px', fontWeight: 600, color: 'var(--text-primary)' }} onClick={onBack}>
            <span>←</span> Dashboard
          </button>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Level {level.levelNumber} Workspace · {level.allocation}
            </span>
            <h2 style={{ fontSize: '1.5rem', margin: '0.15rem 0 0', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{level.title}</h2>
          </div>
        </div>
        <span style={{
          background: isCompleted ? 'rgba(52, 199, 89, 0.1)' : 'rgba(87, 92, 141, 0.1)',
          color: isCompleted ? '#34c759' : '#575c8d',
          fontSize: '0.8rem', fontWeight: 700, padding: '0.4rem 0.8rem',
          borderRadius: 20
        }}>
          {isCompleted ? '✓ Objective Met' : 'Active Stage'}
        </span>
      </div>

      {showChat ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', flex: 1 }}>
          <button onClick={() => setShowChat(false)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#575c8d', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <span>←</span> Back to Workspace
          </button>
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: '20px',
            padding: '1.5rem',
            boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
            display: 'flex', flexDirection: 'column', flex: 1, minHeight: '400px'
          }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>Chat with Penny</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Ask anything about configuring this step!
            </p>

            {/* Large subchat display */}
            <div style={{
              flex: 1, overflowY: 'auto', paddingRight: '0.5rem',
              marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem'
            }}>
              {(!level.chatHistory || level.chatHistory.length === 0) ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.5 }}>💬</span>
                  <p style={{ margin: 0, textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    No questions asked yet.<br />Ask about interest rates or setups!
                  </p>
                </div>
              ) : (
                level.chatHistory.map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', fontWeight: 600 }}>
                      {m.role === 'user' ? 'You' : 'Penny'}
                    </span>
                    <div style={{
                      background: m.role === 'user' ? '#575c8d' : '#e9e9eb',
                      padding: '0.8rem 1rem', borderRadius: '16px',
                      border: m.role === 'user' ? 'none' : '1px solid rgba(0,0,0,0.05)',
                      fontSize: '0.9rem', lineHeight: 1.5, color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                      borderBottomRightRadius: m.role === 'user' ? '4px' : '16px',
                      borderBottomLeftRadius: m.role === 'user' ? '16px' : '4px'
                    }}>{m.role === 'user' ? m.text : renderFormattedText(m.text)}</div>
                  </div>
                ))
              )}
              {subChatLoading && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <div className="loading-spinner" style={{ width: 14, height: 14 }} />
                  Penny is typing...
                </div>
              )}
            </div>

            {/* Subchat Input Form */}
            <form onSubmit={(e) => submitSubChat(e, level.levelNumber)} style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
              <input
                className="form-input"
                placeholder={`Ask about: ${level.title}...`}
                style={{ fontSize: '0.9rem', padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', flex: 1 }}
                value={subChatText}
                onChange={e => setSubChatText(e.target.value)}
                disabled={subChatLoading}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.7rem 1.2rem', fontSize: '0.9rem', borderRadius: '12px', background: '#575c8d', border: 'none', fontWeight: 600 }} disabled={subChatLoading}>
                Send
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Single Column Layout */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', flex: 1 }}>

          {/* Metrics & Guides */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Progress Section */}
            <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                Level Objective & Progress
              </span>
              <p style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 500 }}>{level.action}</p>
              {level.targetAmount > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    <span>Completed</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: '#f5f5f7', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: isCompleted ? '#34c759' : '#575c8d', transition: 'width 0.4s ease-out' }} />
                  </div>
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Total Target Amount:</strong> {s}{level.targetAmount.toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Checklist Section */}
            {level.checklist && (
              <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                  Level Action Checklist
                </span>

                {/* Setup steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>1. Setup Quests:</span>
                  {(level.checklist.setup || []).map((quest) => (
                    <label key={quest.id} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.9rem', alignItems: 'flex-start', cursor: 'pointer', color: quest.completed ? 'var(--text-muted)' : 'var(--text-secondary)', transition: 'all 0.2s' }}>
                      <input
                        type="checkbox"
                        checked={quest.completed || false}
                        onChange={() => toggleChecklistItem(level.levelNumber, quest.id)}
                        style={{ marginTop: '0.2rem', accentColor: '#575c8d', width: '16px', height: '16px' }}
                      />
                      <span>
                        {quest.label}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Monthly check-in */}
                <div style={{ borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>2. Monthly Deposit Check-in:</span>
                  <p style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-secondary)' }}>
                    Did you make a deposit towards this goal level this month?
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      style={{
                        fontSize: '0.85rem', padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid',
                        background: level.checklist.monthlyChecked ? '#575c8d' : '#ffffff',
                        borderColor: level.checklist.monthlyChecked ? '#575c8d' : 'rgba(0,0,0,0.1)',
                        color: level.checklist.monthlyChecked ? '#ffffff' : 'var(--text-primary)',
                        fontWeight: level.checklist.monthlyChecked ? 600 : 500,
                        cursor: 'pointer', transition: 'all 0.2s'
                      }}
                      onClick={() => updateMonthlyCheck(level.levelNumber, true, '')}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      style={{
                        fontSize: '0.85rem', padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid',
                        background: (!level.checklist.monthlyChecked && level.checklist.monthlyCustomAmount === '') ? '#575c8d' : '#ffffff',
                        borderColor: (!level.checklist.monthlyChecked && level.checklist.monthlyCustomAmount === '') ? '#575c8d' : 'rgba(0,0,0,0.1)',
                        color: (!level.checklist.monthlyChecked && level.checklist.monthlyCustomAmount === '') ? '#ffffff' : 'var(--text-primary)',
                        fontWeight: (!level.checklist.monthlyChecked && level.checklist.monthlyCustomAmount === '') ? 600 : 500,
                        cursor: 'pointer', transition: 'all 0.2s'
                      }}
                      onClick={() => updateMonthlyCheck(level.levelNumber, false, '')}
                    >
                      No
                    </button>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0.5rem' }}>or enter:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{s}</span>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Amount"
                        value={level.checklist.monthlyCustomAmount || ''}
                        onChange={(e) => updateMonthlyCheck(level.levelNumber, false, e.target.value)}
                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.6rem', width: '100px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Ask Penny Button placed before tabs */}
            <button
              onClick={() => setShowChat(true)}
              style={{
                background: '#ffffff',
                border: '1px solid rgba(87,92,141,0.2)',
                color: '#575c8d',
                padding: '1rem',
                borderRadius: '16px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                boxShadow: '0 4px 14px rgba(87,92,141,0.08)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <span style={{ fontSize: '1.2rem' }}></span>
              Ask Penny a Question about this Step
            </button>

            {/* Sub-tabs switch */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                ['what', 'What is this step?'],
                ['why', 'Financial Rationale (Why this step?)'],
                ['where', 'Asset Allocation'],
                ['how', 'How to execute']
              ].map(([tKey, label]) => (
                <button
                  key={tKey}
                  style={{
                    background: levelTab === tKey ? '#575c8d' : '#ffffff',
                    border: '1px solid ' + (levelTab === tKey ? '#575c8d' : 'rgba(0,0,0,0.06)'),
                    color: levelTab === tKey ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: levelTab === tKey ? 600 : 500,
                    fontSize: '0.85rem', cursor: 'pointer', outline: 'none',
                    padding: '0.8rem 1rem', borderRadius: '12px',
                    textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'all 0.2s',
                    boxShadow: levelTab === tKey ? '0 4px 12px rgba(87,92,141,0.2)' : '0 2px 6px rgba(0,0,0,0.02)'
                  }}
                  onClick={() => setLevelTab(tKey)}
                >
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Tab Explanation Details Area */}
            <div style={{
              minHeight: '100px', background: '#f5f5f7', border: '1px solid rgba(0,0,0,0.04)',
              padding: '1.5rem', borderRadius: '16px', fontSize: '0.95rem', lineHeight: 1.6, overflowY: 'auto',
              color: 'var(--text-primary)'
            }}>
              {levelTab === 'what' && renderFormattedText(level.what)}
              {levelTab === 'why' && renderFormattedText(level.why)}
              {levelTab === 'where' && renderFormattedText(level.where)}
              {levelTab === 'how' && renderFormattedText(level.how)}
            </div>
          </div>
        </div>
      )}
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


