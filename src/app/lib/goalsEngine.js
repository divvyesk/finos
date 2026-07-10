import { callOpenRouter } from './openRouterClient.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

function getDefaultChecklist(type) {
  const checklists = {
    starter_emergency: [
      { id: 'se_1', label: 'Open a dedicated HYSA: Research and open a High-Yield Savings Account (HYSA) at a separate, online-only bank from your primary checking account.', completed: false },
      { id: 'se_2', label: 'Automate Payday Transfer: Log into your primary checking account and set up a recurring automatic transfer to your new HYSA scheduled for the day after your paycheck lands.', completed: false },
      { id: 'se_3', label: 'Define "Emergency": Write down a clear rule list of what constitutes an emergency (e.g. medical bills, car repairs, job loss) to prevent you from touching this money for regular shopping.', completed: false }
    ],
    debt: [
      { id: 'db_1', label: 'Map Your Debt List: Create a list or spreadsheet of all your debts, recording their total balances, interest rates (APRs), and minimum monthly payments.', completed: false },
      { id: 'db_2', label: 'Set Autopay on Minimums: Set up automatic minimum payments for all your debts so you never get hit with late fees or credit score damage.', completed: false },
      { id: 'db_3', label: 'Lock Your Cards: Remove your credit cards from online shopping portals (Amazon, Google Pay, Apple Pay) to prevent adding new debt while paying down old balances.', completed: false },
      { id: 'db_4', label: 'Choose Your Payoff Method: Formally choose either the Debt Avalanche method (paying highest interest first to save money) or Debt Snowball method (paying smallest balance first for psychological momentum).', completed: false }
    ],
    full_emergency: [
      { id: 'fe_1', label: 'Verify APY Competitive Rates: Verify that your HYSA bank is offering a competitive interest rate (APY) compared to current market averages.', completed: false },
      { id: 'fe_2', label: 'Adjust Savings Rules: Update your automated monthly payday savings transfer to reflect your new, higher Level 3 target contribution.', completed: false },
      { id: 'fe_3', label: 'Quarterly Audit Schedule: Mark your calendar for a quarterly review check to adjust your core monthly expense numbers if your bills or rent change.', completed: false }
    ],
    investing: [
      { id: 'iv_1', label: 'Open Investment Account: Open a low-cost taxable brokerage account or a tax-advantaged retirement account (like a Roth IRA or 401k equivalent).', completed: false },
      { id: 'iv_2', label: 'Choose a Broad Market Index Fund: Select a low-cost, diversified index ETF that tracks the entire stock market (like VTI, VOO, or VT).', completed: false },
      { id: 'iv_3', label: 'Turn on DRIP (Auto-Reinvestment): Enable Dividend Reinvestment (DRIP) inside your broker portal so any earnings are automatically re-invested.', completed: false },
      { id: 'iv_4', label: 'Automate Investments: Set up a recurring monthly transfer and an automatic buy order (Auto-Invest) inside your brokerage account.', completed: false }
    ],
    goal: [
      { id: 'gl_1', label: 'Open a Dedicated Sub-Bucket: Create a separate sub-account or savings "vault" named specifically after your goal.', completed: false },
      { id: 'gl_2', label: 'Align Timeline with Asset Class: Verify your vault matches your timeline (HYSA/CDs for timelines under 3 years; balanced index portfolios for longer).', completed: false },
      { id: 'gl_3', label: 'Automate Goal Savings: Set up a monthly automatic transfer from your checking account to your goal vault.', completed: false }
    ]
  };

  return {
    setup: checklists[type] || checklists.goal,
    monthlyChecked: false,
    monthlyCustomAmount: ''
  };
}

/**
 * Parses user input to extract goal details.
 * If details are insufficient, flags needsClarification: true and returns followUpQuestions.
 */
export async function parseGoalInput(message, history = []) {

  
  const historyText = history
    .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
    .join('\n');

  const prompt = `You are a strict financial analysis AI parser.
Analyze the user's message describing their financial goal. 
Context of previous conversation:
${historyText}

Current User Message: "${message}"

Task:
1. Extract the following parameters into "extractedParams":
   - "title": A short name for the goal (e.g., "Tesla Model 3", "Starter Home Downpayment").
   - "category": Must be one of ["house", "car", "travel", "emergency_fund", "retirement", "other"].
   - "targetCost": Number (in user's currency). Null if not specified or impossible to infer.
   - "timelineYears": Number of years to achieve the goal. Null if not specified or impossible to infer.
   - "downPayment": Target down payment amount (number). Null if not specified.
   - "condition": Condition of asset if applicable (e.g., "new", "used", "fixer-upper"). Null if not applicable.
   - "priority": Level of importance, one of ["high", "medium", "low"]. Default to "medium" if not specified.

2. Determine if the goal input is too vague or missing critical details (specifically "targetCost" or "timelineYears").
   - If "targetCost" or "timelineYears" is missing, set "needsClarification" to true.
   - Generate 1 to 3 highly specific "followUpQuestions" asking for the missing details (e.g. "What is your target budget for this car?" or "In how many years do you plan to buy the house?"). Do not ask questions for details the user has already provided.
   - If the user has provided enough information to calculate a basic roadmap, set "needsClarification" to false and "followUpQuestions" to [].

Return a JSON object conforming exactly to this structure:
{
  "needsClarification": boolean,
  "followUpQuestions": ["string"],
  "extractedParams": {
    "title": "string" | null,
    "category": "string" | null,
    "targetCost": number | null,
    "timelineYears": number | null,
    "downPayment": number | null,
    "condition": "string" | null,
    "priority": "string" | null
  }
}

Do not return any markdown formatting or explanations, just the raw JSON object.`;

  try {
    const response = await callOpenRouter({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error('Error parsing goal input with Gemini:', error);
    // Safe fallback
    return {
      needsClarification: true,
      followUpQuestions: ["Could you tell me what your budget is and when you hope to achieve this goal?"],
      extractedParams: {
        title: "Financial Goal",
        category: "other",
        targetCost: null,
        timelineYears: null,
        downPayment: null,
        condition: null,
        priority: "medium"
      }
    };
  }
}

/**
 * Calculates financial metrics and generates step explanations for the levels.
 */
export async function buildRoadmap({
  netMonthlyPay,
  savings,
  debt = [],
  monthlyExpenses = [],
  extractedParams,
  currency = 'USD'
}) {
  const expensesSum = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netMonthlyIncome = netMonthlyPay;
  const savingsCapacity = netMonthlyIncome - expensesSum;

  const targetCost = extractedParams.targetCost || 0;
  const timelineYears = extractedParams.timelineYears || 5;
  const downPayment = extractedParams.downPayment || 0;
  const targetSaveAmount = downPayment > 0 ? downPayment : targetCost;

  const totalRequiredMonthly = targetSaveAmount / (timelineYears * 12);
  let ratio = totalRequiredMonthly / netMonthlyIncome;
  if (savingsCapacity <= 0) {
    ratio = 9.9; // Impossible due to negative cashflow
  }

  let stressLevel = 'low';
  if (ratio > 0.6 || savingsCapacity <= 0) {
    stressLevel = 'impossible';
  } else if (ratio > 0.4) {
    stressLevel = 'high';
  } else if (ratio > 0.2) {
    stressLevel = 'medium';
  }

  // Calculate stress-free alternative plan (cap required savings at 20% of net monthly pay)
  const safeMonthlySavings = netMonthlyIncome * 0.2;
  const revisedTimelineYears = parseFloat((targetSaveAmount / (safeMonthlySavings * 12)).toFixed(1));
  const revisedTargetCost = parseFloat((safeMonthlySavings * timelineYears * 12).toFixed(0));

  const alternativePlan = {
    timelineYears: revisedTimelineYears,
    monthlyRequired: Math.round(safeMonthlySavings),
    targetCost: targetCost,
    message: `By extending your timeline to ${revisedTimelineYears} years, you can save a comfortable ${currency} ${Math.round(safeMonthlySavings).toLocaleString()}/month (20% of income), eliminating financial stress.`
  };

  // Generate levels
  const levels = [];
  let currentLevel = 1;

  // Level 1: Starter Emergency Shield (Target: 1 month of expenses or flat default)
  const starterTarget = expensesSum > 0 ? expensesSum : (currency === 'INR' ? 30000 : 1000);
  const isStarterDone = savings >= starterTarget;
  levels.push({
    levelNumber: currentLevel++,
    title: 'The Starter Emergency Shield',
    action: `Build a starter buffer of ${currency} ${starterTarget.toLocaleString()}`,
    targetAmount: starterTarget,
    currentAmount: Math.min(savings, starterTarget),
    isCompleted: isStarterDone,
    allocation: 'High-Yield Savings Account (HYSA)',
    type: 'starter_emergency',
    checklist: getDefaultChecklist('starter_emergency')
  });

  // Remaining savings to offset high-interest debt or full emergency
  let remainingSavings = Math.max(0, savings - starterTarget);

  // Level 2: The Debt Decelerator
  const highInterestDebt = debt.filter(d => d.rate > 7);
  const totalDebt = highInterestDebt.reduce((sum, d) => sum + d.amount, 0);
  
  // Allocate remaining savings to debt first
  let debtPaymentFromSavings = 0;
  if (totalDebt > 0) {
    debtPaymentFromSavings = Math.min(remainingSavings, totalDebt);
    remainingSavings -= debtPaymentFromSavings;
  }

  const isDebtDone = totalDebt === 0 || debtPaymentFromSavings >= totalDebt;
  levels.push({
    levelNumber: currentLevel++,
    title: 'The Debt Decelerator',
    action: totalDebt > 0 
      ? `Pay off high-interest debt of ${currency} ${totalDebt.toLocaleString()}` 
      : 'No high-interest debt detected! Keep it that way.',
    targetAmount: totalDebt,
    currentAmount: debtPaymentFromSavings,
    isCompleted: isDebtDone,
    allocation: 'Debt Payoff Accounts',
    type: 'debt',
    checklist: getDefaultChecklist('debt')
  });

  // Level 3: The Full Emergency Guardrail
  const fullTarget = expensesSum * 3;
  const incrementalTarget = Math.max(0, fullTarget - starterTarget); // Remaining 2 months
  const isFullDone = isStarterDone && (remainingSavings >= incrementalTarget);
  levels.push({
    levelNumber: currentLevel++,
    title: 'The Full Emergency Guardrail',
    action: `Build the full emergency buffer of ${currency} ${fullTarget.toLocaleString()}`,
    targetAmount: incrementalTarget,
    currentAmount: Math.min(remainingSavings, incrementalTarget),
    isCompleted: isFullDone,
    allocation: 'High-Yield Savings Account (HYSA)',
    type: 'full_emergency',
    checklist: getDefaultChecklist('full_emergency')
  });
  remainingSavings = Math.max(0, remainingSavings - incrementalTarget);

  // Level 4: The Investment Launchpad
  // This level is educational & sets up dynamic regular investing
  levels.push({
    levelNumber: currentLevel++,
    title: 'The Investment Launchpad',
    action: `Set up regular automated investments (Target 10-15% of savings)`,
    targetAmount: Math.round(savingsCapacity * 0.15),
    currentAmount: 0,
    isCompleted: false,
    allocation: 'Broad-Market ETFs / Index Funds',
    type: 'investing',
    checklist: getDefaultChecklist('investing')
  });

  // Level 5: The Goal Vault
  const goalCurrentAmount = remainingSavings;
  const isGoalDone = goalCurrentAmount >= targetSaveAmount;
  levels.push({
    levelNumber: currentLevel++,
    title: `The Goal Vault — ${extractedParams.title || 'My Goal'}`,
    action: `Accumulate the target of ${currency} ${targetSaveAmount.toLocaleString()}`,
    targetAmount: targetSaveAmount,
    currentAmount: Math.min(goalCurrentAmount, targetSaveAmount),
    isCompleted: isGoalDone,
    allocation: timelineYears < 3 ? 'HYSA / CD' : 'Balanced Investment Portfolio',
    type: 'goal',
    checklist: getDefaultChecklist('goal')
  });

  // Invoke Gemini to generate personalized explanations for each level

  const levelsContext = levels.map(l => {
    return `Level ${l.levelNumber}: ${l.title} (${l.action}) -> Stored in: ${l.allocation}`;
  }).join('\n');

  const prompt = `You are a certified personal financial planner.
Analyze the user's financial setup:
- Net Monthly Income: ${currency} ${netMonthlyIncome}
- Available Cash/Savings: ${currency} ${savings}
- Monthly Core Expenses: ${currency} ${expensesSum}
- Monthly Savings Capacity (Income minus Expenses): ${currency} ${savingsCapacity}
- Goal: "${extractedParams.title}" in category "${extractedParams.category}"
- Goal Cost: ${currency} ${targetCost} over ${timelineYears} years
- Stress Index: ${stressLevel} (Monthly Savings Required is ${currency} ${Math.round(totalRequiredMonthly)})

Here is the Level-by-Level Roadmap we designed:
${levelsContext}

Task:
For EACH of the 5 levels, generate detailed, grounded, and highly educational explanations.
The target reader is a first-time earner who has just received income for the first time in their life, is confused by financial jargon, and needs clear, reassuring guidance.
Do not use hype, generic text, or filler. Explain key financial terms (like APY, index fund, liquidity, compound interest, and debt avalanche) using clear analogies.
Every level explanation MUST contain exactly 3 to 4 complete, detailed sentences for each of the following keys:
1. "why": The economic logic or financial psychology. Why is this sequence mathematically or behaviorally necessary? Explain what happens if they skip it.
2. "where": Concrete recommendation of account types and financial vehicles (e.g. online HYSAs vs brokerage accounts, index ETFs like VTI/VOO, or paying high-rate debt accounts). Explain why this vehicle is suitable.
3. "how": Exact, tactical step-by-step instructions. What should they type, click, or set up in their banking app or payroll portal on payday? (Use actual numbers from this user's parameters where possible).
4. "what": A plain, simple overview of this level written in warm, reassuring terms so they instantly understand what this step represents for their safety.

Return a JSON array of 5 objects corresponding to the levels in order. Confirming to this schema:
[
  {
    "levelNumber": number,
    "why": "string",
    "where": "string",
    "how": "string",
    "what": "string"
  }
]

Do not return any formatting, markdown markers, or explanations, just the JSON array.`;

  try {
    const response = await callOpenRouter({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.0
      }
    });

    let cleanText = response.text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }
    const parsedExplanations = JSON.parse(cleanText);

    // Merge the AI explanations with the calculated metrics
    const finalLevels = levels.map(lvl => {
      const explanation = parsedExplanations.find(exp => Number(exp.levelNumber) === Number(lvl.levelNumber)) || {};
      return {
        ...lvl,
        why: explanation.why || 'To build a secure baseline.',
        where: explanation.where || 'A high-yield account.',
        how: explanation.how || 'Set up automatic deposits.',
        what: explanation.what || 'Establishing a financial buffer.'
      };
    });

    return {
      targetCost,
      timelineYears,
      downPayment,
      monthlyRequired: Math.round(totalRequiredMonthly),
      isFeasible: stressLevel !== 'impossible',
      stressLevel,
      alternativePlan,
      levels: finalLevels
    };

  } catch (error) {
    console.error('Error generating level explanations with Gemini:', error);
    
    // Custom fallback explanations per level category
    const fallbacks = {
      starter_emergency: {
        why: 'A starter emergency fund acts as an immediate psychological and financial safety shield. When you first receive money, minor unexpected expenses like car repairs or medical bills can derail you, forcing you into expensive high-interest credit card debt. Having a small, dedicated cash buffer keeps you from slipping backward, letting you focus on your financial plan with confidence and peace of mind.',
        where: 'Keep this money in a High-Yield Savings Account (HYSA) at an online-only bank separate from your daily checking account. Online HYSAs are insured up to normal government limits (like FDIC/DICGC) and pay much higher interest rates (called APY) than traditional brick-and-mortar banks. Keeping it separate prevents you from accidentally spending it on regular daily purchases while ensuring it remains accessible when needed.',
        how: `Log into your employer payroll portal or bank app and configure a recurring transfer of 10% to 15% of your pay to automatically sweep into this new HYSA on every single payday. Keep this automatic process running without touching the money until the account balance hits your target of ${currency} ${starterTarget.toLocaleString()}. Treat this account like an emergency-only vault and do not check it for daily expenses.`,
        what: 'This step builds a basic starter cash buffer of one full month of your core expenses to shield you from unexpected emergencies. Think of it as a small financial umbrella that protects you from life\'s minor storms so you never have to borrow high-interest money. It is the very first foundation block of your financial house, designed to keep you stable.'
      },
      debt: {
        why: 'High-interest debt (often credit cards or personal loans carrying interest rates above 7%) acts like a financial leak in your bucket. Every month you carry this debt, compounding interest eats away at your hard-earned income, making banks richer while keeping you stuck. Paying off this debt yields a guaranteed return equal to the interest rate of the loan, which is mathematically the single best return on your money.',
        where: 'Direct all your surplus cash flow to pay off your high-interest credit card accounts or loan portals. You can use the "Debt Avalanche" strategy by ranking debts from highest interest rate to lowest, or the "Debt Snowball" strategy by ranking them from smallest balance to largest. Focus your extra energy on one target at a time while maintaining the bare minimum payments on the rest.',
        how: `List all your loans, balances, and annual percentage rates (APR) in a sheet, then set up automatic minimum payments on all accounts so you never miss a deadline. Route every extra dollar of your monthly cash flow surplus directly to the loan with the highest interest rate. Once that high-rate loan is fully paid off, roll its entire monthly payment amount into the next highest loan until they are all gone.`,
        what: 'This step concentrates all your surplus cash flow on paying down expensive debts with interest rates higher than 7%. Think of high-interest debt as a weight dragging down your progress; by cutting it loose, you free up massive amounts of future income to save and invest. It transforms your debt payments back into wealth-building savings.'
      },
      full_emergency: {
        why: 'Now that high-interest debt is eliminated, a full emergency fund protects your investments and career options from major life disruptions like job loss or economic downturns. Without this buffer, a sudden loss of income would force you to sell your investments at a loss or borrow money. Having a complete 3-month expense cushion allows you to make calm, rational decisions during stressful life changes.',
        where: 'Store this larger buffer in your existing High-Yield Savings Account (HYSA) or in low-risk Money Market Funds. These accounts keep your money secure and stable while earning interest, and they allow you to withdraw the cash within 1 to 2 business days. Do not invest this money in volatile assets like stocks or gold, as their value can crash exactly when you need them most.',
        how: `Redirect the monthly cash flows that you were previously using to pay off debt into your dedicated High-Yield Savings Account (HYSA). Set up automatic monthly transfers to deposit your surplus cash flow into this account on every payday until the total incremental buffer of ${currency} ${incrementalTarget.toLocaleString()} is saved. Mark the goal as complete and leave the balance untouched.`,
        what: 'This step completes your long-term security shield by expanding your starter buffer up to a full three months of core living expenses. It acts as a robust financial mattress that cushions you during major disruptions like temporary unemployment or health emergencies. Once this is filled, your survival is fully secured, letting you start building real wealth.'
      },
      investing: {
        why: 'To build long-term wealth and protect your money from losing purchasing power to inflation, you need to invest in assets that grow over time. While savings accounts keep money safe, they do not grow wealth. Compounding interest allows your money to earn its own money, and over 10 to 20 years, this compound growth becomes the main driver of your net worth.',
        where: 'Open a low-cost brokerage account or a tax-advantaged retirement account (like a Roth IRA or equivalent) at a major custodian. Invest the funds in broad-market low-cost index ETFs or Mutual Funds (such as funds tracking the S&P 500 or Total Stock Market like VTI or VOO). These index funds package thousands of companies together, giving you instant diversification and safety.',
        how: `Set up a monthly recurring automatic transfer from your checking account into your new brokerage or retirement account on the day after you get paid. Configure the brokerage account to automatically buy shares of your chosen index ETF (like VTI or VOO) using that money every month. Turn on "Dividend Reinvestment" (DRIP) so any earnings are automatically put back to work to speed up compounding.`,
        what: 'This step introduces you to the world of automated investing by regularly putting 10% to 15% of your savings capacity into diversified stock index funds. Think of it as buying small shares of the world\'s largest companies so they work for you while you sleep. It is not trading or gambling; it is a passive, slow-and-steady system to build long-term wealth.'
      },
      goal: {
        why: 'Saving specifically for your major life goal (like a house, car, or education) ensures you do not compromise your retirement or touch your emergency buffer. Buying a major asset using dedicated savings prevents you from taking on fresh high-interest debt that would set you back. It keeps your overall financial system balanced, secure, and aligned with your personal values.',
        where: `If your goal timeline is short (less than 3 years), keep the funds in a secure HYSA or Certificate of Deposit (CD) to protect your principal from market volatility. If your timeline is longer (more than 3 years), you can use a balanced investment portfolio of conservative index ETFs and government bonds to grow the funds faster.`,
        how: `Create a separate sub-account or savings bucket named after your goal inside your bank or brokerage app. Calculate your required monthly contribution and configure an automatic recurring deposit of ${currency} ${(Math.round(targetCost / (timelineYears * 12))).toLocaleString()} per month into this dedicated bucket. Track the progress bar regularly until you hit the target.`,
        what: `This step accumulates the final target funds of ${currency} ${targetSaveAmount.toLocaleString()} to purchase your specific goal. It keeps this major purchase isolated from the rest of your wealth so you never have to choose between buying your goal and staying financially secure. It is the final destination vault of your custom financial roadmap.`
      }
    };

    const finalLevels = levels.map(lvl => {
      const fb = fallbacks[lvl.type] || fallbacks.goal;
      return {
        ...lvl,
        why: fb.why,
        where: fb.where,
        how: fb.how,
        what: fb.what
      };
    });

    return {
      targetCost,
      timelineYears,
      downPayment,
      monthlyRequired: Math.round(totalRequiredMonthly),
      isFeasible: stressLevel !== 'impossible',
      stressLevel,
      alternativePlan,
      levels: finalLevels
    };
  }

}
