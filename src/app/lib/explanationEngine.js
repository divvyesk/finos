import { callOpenRouter } from './openRouterClient.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });


export async function generateTaxExplanation({
  grossSalary,
  currency,
  country,
  state,
  deductions,
  effectiveTaxRate,
  taxBrackets
}) {


  const deductionLines = Object.entries(deductions)
    .map(([key, val]) => `- ${key}: ${val} ${currency}`)
    .join('\n');

  const prompt = `You are a helpful, clear personal finance AI advisor.
Analyze the user's tax breakdown:
Gross Salary: ${grossSalary} ${currency}
Country: ${country}
State/Province: ${state || 'N/A'}
Currency: ${currency}

Breakdown:
${deductionLines}
- Effective Tax Rate: ${effectiveTaxRate}%
- Federal/National Marginal Rate: ${taxBrackets.federalMarginalRate}%
- State/Provincial Marginal Rate: ${taxBrackets.stateMarginalRate}%

Task:
1. Generate an array of 3-5 concise bullet points ("insights") describing the user's specific tax situation. 
   - Keep each insight VERY short (1-2 sentences maximum), punchy, and easy to read.
   - Include the overall percentage of income lost to taxes.
   - Include comparative context (e.g., whether this is typical).
   - Identify what their largest single deduction is.
   - Provide an actionable tax optimization tip.
2. Generate an array of Q&As ("faqs") for EACH AND EVERY deduction item listed in the Breakdown.
   - For every deduction key EXCEPT "Pre-tax Contribution", the question MUST match this exact format: "What is [Deduction Name] and why am I paying it?"
   - If "Pre-tax Contribution" is listed in the Breakdown, you MUST generate this exact question: "What is Pre-Tax Contribution and why is it helpful?"
   - For the answer, keep it VERY short (2-3 sentences maximum). Explain exactly what the tax or contribution is, what it funds, and how it impacts them.

Return a JSON object conforming exactly to this structure:
{
  "insights": [
    "string"
  ],
  "faqs": [
    {
      "question": "string",
      "answer": "string"
    }
  ]
}
Do not include any formatting, markdown formatting, or explainers, just the JSON payload. Ensure response matches this schema exactly.`;

  try {
    const response = await callOpenRouter({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const resultText = response.text.trim();
    return JSON.parse(resultText);
  } catch (error) {
    console.error('Error generating tax explanation:', error);
    // Return standard fallback dynamically
    const faqs = Object.keys(deductions).map(key => {
      if (key === "Pre-tax Contribution") {
        return {
          question: "What is Pre-Tax Contribution and why is it helpful?",
          answer: "A pre-tax contribution is money taken out of your paycheck before income taxes are calculated. It is helpful because it reduces your overall taxable income, lowering your tax bill today while building savings for retirement or healthcare."
        };
      }
      return {
        question: `What is ${key} and why am I paying it?`,
        answer: `${key} is a deduction from your paycheck calculated based on your annual income of ${grossSalary} in ${state || country}. It funds public services, infrastructure, and social programs.`
      };
    });
    return {
      insights: [
        `You lose ${effectiveTaxRate}% of your income to taxes.`,
        `This is standard for individuals in ${state || country}.`,
        `Your largest deduction is income tax.`,
        `Contributing to pre-tax accounts could reduce your taxable income.`
      ],
      faqs
    };
  }
}
