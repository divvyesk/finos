import { callOpenRouter } from './openRouterClient.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });


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

  // Level 1: Emergency Guardrail (Target: 3 months of expenses)
  const emergencyTarget = expensesSum * 3;
  const isEmergencyDone = savings >= emergencyTarget;
  levels.push({
    levelNumber: currentLevel++,
    title: 'The Emergency Guardrail',
    action: `Build a emergency buffer of ${currency} ${emergencyTarget.toLocaleString()}`,
    targetAmount: emergencyTarget,
    currentAmount: Math.min(savings, emergencyTarget),
    isCompleted: isEmergencyDone,
    allocation: 'High-Yield Savings Account (HYSA)',
    type: 'emergency'
  });

  // Remaining savings to offset high-interest debt or primary goal
  let remainingSavings = Math.max(0, savings - emergencyTarget);

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
    type: 'debt'
  });

  // Level 3: The Investment Launchpad
  // This level is educational & sets up dynamic regular investing
  levels.push({
    levelNumber: currentLevel++,
    title: 'The Investment Launchpad',
    action: `Set up regular automated investments (Target 10-15% of savings)`,
    targetAmount: Math.round(savingsCapacity * 0.15),
    currentAmount: 0,
    isCompleted: false,
    allocation: 'Broad-Market ETFs / Index Funds',
    type: 'investing'
  });

  // Level 4: The Goal Vault
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
    type: 'goal'
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
For EACH of the 4 levels, generate the explanations:
1. "why": Explain the financial psychology or economic logic. (e.g. why emergency funds protect investments, why index funds beat inflation).
2. "where": Recommend specific financial vehicles (e.g. Vanguard/Fidelity, HYSA providers, or payment strategies like debt avalanche). Do not mention specific brand names unless they are industry standards (like Index ETFs e.g. VTI, VOO).
3. "how": Exact, tactical step-by-step instructions on what to configure (e.g. "open a secondary sub-account, set auto-transfer on payday"). Use real numbers.
4. "what": A plain explanation of what the level is, written for a first-time earner.

Return a JSON array of 4 objects corresponding to the levels in order. Confirming to this schema:
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
      emergency: {
        why: 'An emergency fund acts as a financial buffer so you do not have to take on high-interest debt when unexpected costs arise.',
        where: 'Store this in a High-Yield Savings Account (HYSA) separate from your checking account to keep it liquid.',
        how: 'Set up an automatic recurring transfer of a portion of your paycheck to this HYSA on every payday.',
        what: 'This step establishes your primary safety net.'
      },
      debt: {
        why: 'High-interest debt is a drag on your financial system. Paying it off yields a guaranteed return equal to the interest rate of the loan.',
        where: 'Pay directly to your high-interest credit cards or loan accounts using the Debt Avalanche or Debt Snowball method.',
        how: 'Continue making minimum payments on all debts except the one with the highest interest rate, routing all extra savings capacity to that one.',
        what: 'This step focuses on clearing debt to free up future cash flow.'
      },
      investing: {
        why: 'To grow wealth and beat inflation over the long term, you need to invest in assets that appreciate. Compounding returns build security.',
        where: 'Open a low-cost brokerage account or tax-advantaged account (like a Roth IRA) and invest in broad-market low-cost index ETFs.',
        how: 'Schedule automated monthly purchases of a broad market index ETF (like VTI or VOO) inside your brokerage account.',
        what: 'This step introduces automated investing.'
      },
      goal: {
        why: 'Saving specifically for your goal ensures you do not compromise your retirement or emergency buffer to purchase your asset.',
        where: `For short timelines under 3 years, keep it in a secure HYSA or CD. For longer timelines, you can use a balanced investment portfolio.`,
        how: `Create a dedicated savings bucket named after your goal and set up automatic transfers for the calculated monthly savings target.`,
        what: `This step accumulates the final funds to purchase your goal.`
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
