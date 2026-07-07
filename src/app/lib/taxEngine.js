import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

let ai = null;
function getAiClient() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

// ── US Rule Engine (2024 brackets) ──────────────────────────────────────────
export function calculateUSTaxes(salary, stateInput = 'California', preTaxContribution = 0) {
  const state = (stateInput || 'California').trim().toLowerCase();
  
  // 1. FICA (Social Security & Medicare)
  // Social Security: 6.2% up to $168,600
  const ssWageLimit = 168600;
  const socialSecurity = Math.round(Math.min(salary, ssWageLimit) * 0.062);

  // Medicare: 1.45% on all, plus 0.9% additional on salary above $200,000
  let medicare = salary * 0.0145;
  if (salary > 200000) {
    medicare += (salary - 200000) * 0.009;
  }
  medicare = Math.round(medicare);

  // 2. Federal Income Tax (Single Filer, Standard Deduction $14,600)
  const fedStandardDeduction = 14600;
  const fedTaxable = Math.max(0, salary - preTaxContribution - fedStandardDeduction);
  
  const fedBrackets = [
    { limit: 11600, rate: 0.10 },
    { limit: 47150, rate: 0.12 },
    { limit: 100525, rate: 0.22 },
    { limit: 191950, rate: 0.24 },
    { limit: 243725, rate: 0.32 },
    { limit: 609350, rate: 0.35 },
    { limit: Infinity, rate: 0.37 }
  ];

  let federalTax = 0;
  let remainingFedTaxable = fedTaxable;
  let prevLimit = 0;
  let fedMarginalRate = 0;

  for (const bracket of fedBrackets) {
    const bracketWidth = bracket.limit - prevLimit;
    if (remainingFedTaxable > bracketWidth) {
      federalTax += bracketWidth * bracket.rate;
      remainingFedTaxable -= bracketWidth;
    } else {
      federalTax += remainingFedTaxable * bracket.rate;
      if (remainingFedTaxable > 0) {
        fedMarginalRate = bracket.rate * 100;
      }
      remainingFedTaxable = 0;
      break;
    }
    prevLimit = bracket.limit;
  }
  federalTax = Math.round(federalTax);

  // 3. State Income Tax (California Progressive vs Other Fallbacks)
  let stateTax = 0;
  let stateMarginalRate = 0;

  if (state.includes('california') || state === 'ca') {
    // CA Standard Deduction (Single: $5,363)
    const caStandardDeduction = 5363;
    const caTaxable = Math.max(0, salary - preTaxContribution - caStandardDeduction);

    const caBrackets = [
      { limit: 10412, rate: 0.01 },
      { limit: 24684, rate: 0.02 },
      { limit: 38959, rate: 0.04 },
      { limit: 54081, rate: 0.06 },
      { limit: 68350, rate: 0.08 },
      { limit: 349137, rate: 0.093 },
      { limit: 418961, rate: 0.103 },
      { limit: 698271, rate: 0.113 },
      { limit: Infinity, rate: 0.123 }
    ];

    let remainingCaTaxable = caTaxable;
    let prevCaLimit = 0;

    for (const bracket of caBrackets) {
      const bracketWidth = bracket.limit - prevCaLimit;
      if (remainingCaTaxable > bracketWidth) {
        stateTax += bracketWidth * bracket.rate;
        remainingCaTaxable -= bracketWidth;
      } else {
        stateTax += remainingCaTaxable * bracket.rate;
        if (remainingCaTaxable > 0) {
          stateMarginalRate = bracket.rate * 100;
        }
        remainingCaTaxable = 0;
        break;
      }
      prevCaLimit = bracket.limit;
    }
  } else {
    // Default fallback state tax (4% flat rate for other states)
    stateTax = Math.max(0, Math.round((salary - preTaxContribution) * 0.04));
    stateMarginalRate = 4.0;
  }
  stateTax = Math.round(stateTax);

  const totalDeductions = federalTax + stateTax + socialSecurity + medicare;
  const netPay = salary - totalDeductions;
  const effectiveTaxRate = parseFloat(((totalDeductions / salary) * 100).toFixed(1));

  const stateLabel = (state.includes('california') || state === 'ca') ? "California State Tax" : "State Income Tax";
  return {
    grossSalary: salary,
    currency: 'USD',
    deductions: {
      "Federal Income Tax": federalTax,
      [stateLabel]: stateTax,
      "Social Security (FICA)": socialSecurity,
      "Medicare (FICA)": medicare
    },
    netPay,
    effectiveTaxRate,
    taxBrackets: {
      federalMarginalRate: fedMarginalRate || 10,
      stateMarginalRate
    }
  };
}

// ── Canada Rule Engine (2024 brackets) ──────────────────────────────────────
export function calculateCanadaTaxes(salary, provinceInput = 'Ontario', preTaxContribution = 0) {
  const province = (provinceInput || 'Ontario').trim().toLowerCase();

  // 1. CPP (Canada Pension Plan)
  // Employee rate: 5.95%, Exemption: $3,500, Max Earnings: $68,500. Max contribution: $3,867.50
  const cppExemption = 3500;
  const cppLimit = 68500;
  const cppEarnings = Math.max(0, Math.min(salary, cppLimit) - cppExemption);
  const socialSecurity = Math.round(Math.min(cppEarnings * 0.0595, 3867.50));

  // 2. EI (Employment Insurance)
  // Employee rate: 1.66%, Max Earnings: $63,200. Max contribution: $1,049.12
  const eiLimit = 63200;
  const medicare = Math.round(Math.min(salary, eiLimit) * 0.0166); // Modeled under 'medicare' for consistency

  // 3. Federal Income Tax (2024, Basic Personal Amount $15,705)
  const fedBPA = 15705;
  const fedTaxable = Math.max(0, salary - preTaxContribution - fedBPA);

  const fedBrackets = [
    { limit: 55867, rate: 0.15 },
    { limit: 111733, rate: 0.205 },
    { limit: 173205, rate: 0.26 },
    { limit: 246752, rate: 0.29 },
    { limit: Infinity, rate: 0.33 }
  ];

  let federalTax = 0;
  let remainingFedTaxable = fedTaxable;
  let prevLimit = 0;
  let fedMarginalRate = 0;

  for (const bracket of fedBrackets) {
    const bracketWidth = bracket.limit - prevLimit;
    if (remainingFedTaxable > bracketWidth) {
      federalTax += bracketWidth * bracket.rate;
      remainingFedTaxable -= bracketWidth;
    } else {
      federalTax += remainingFedTaxable * bracket.rate;
      if (remainingFedTaxable > 0) {
        fedMarginalRate = bracket.rate * 100;
      }
      remainingFedTaxable = 0;
      break;
    }
    prevLimit = bracket.limit;
  }
  federalTax = Math.round(federalTax);

  // 4. Provincial Income Tax (Ontario Brackets or Fallback)
  let stateTax = 0;
  let stateMarginalRate = 0;

  if (province.includes('ontario') || province === 'on') {
    const onBPA = 12244;
    const onTaxable = Math.max(0, salary - preTaxContribution - onBPA);
    const onBrackets = [
      { limit: 51446, rate: 0.0505 },
      { limit: 102894, rate: 0.0915 },
      { limit: 150000, rate: 0.1116 },
      { limit: 220000, rate: 0.1216 },
      { limit: Infinity, rate: 0.1316 }
    ];

    let remainingOnTaxable = onTaxable;
    let prevOnLimit = 0;

    for (const bracket of onBrackets) {
      const bracketWidth = bracket.limit - prevOnLimit;
      if (remainingOnTaxable > bracketWidth) {
        stateTax += bracketWidth * bracket.rate;
        remainingOnTaxable -= bracketWidth;
      } else {
        stateTax += remainingOnTaxable * bracket.rate;
        if (remainingOnTaxable > 0) {
          stateMarginalRate = bracket.rate * 100;
        }
        remainingOnTaxable = 0;
        break;
      }
      prevOnLimit = bracket.limit;
    }
  } else {
    // Default provincial tax fallback (8% flat rate)
    stateTax = Math.max(0, Math.round((salary - preTaxContribution) * 0.08));
    stateMarginalRate = 8.0;
  }
  stateTax = Math.round(stateTax);

  const totalDeductions = federalTax + stateTax + socialSecurity + medicare;
  const netPay = salary - totalDeductions;
  const effectiveTaxRate = parseFloat(((totalDeductions / salary) * 100).toFixed(1));

  const provLabel = (province.includes('ontario') || province === 'on') ? "Ontario Provincial Tax" : "Provincial Income Tax";
  return {
    grossSalary: salary,
    currency: 'CAD',
    deductions: {
      "Federal Income Tax": federalTax,
      [provLabel]: stateTax,
      "Canada Pension Plan (CPP)": socialSecurity,
      "Employment Insurance (EI)": medicare
    },
    netPay,
    effectiveTaxRate,
    taxBrackets: {
      federalMarginalRate: fedMarginalRate || 15,
      stateMarginalRate
    }
  };
}

// ── Grounded AI Tax Engine (Fallback for other countries) ───────────────────
export async function calculateInternationalTaxesGemini(salary, country, state = '', currency = 'USD', preTaxContribution = 0) {
  const aiClient = getAiClient();
  const prompt = `You are a professional multi-country tax calculator.
Analyze the following personal profile:
Gross Annual Salary: ${salary}
Country: ${country}
State/Province/Region: ${state}
Currency: ${currency}
Pre-tax retirement/other contributions (reduces taxable income): ${preTaxContribution}

Task:
Calculate the estimated tax deductions for this salary under the local country/state rules for the current tax year (2024 or 2025).
Determine the exact, localized tax and contribution items the user pays (e.g. "PAYE Income Tax", "Class 1 National Insurance" in the UK; "Professional Tax", "Income Tax (TDS)" in India).

Return a JSON object conforming exactly to this structure:
{
  "grossSalary": number,
  "currency": string,
  "deductions": {
    "[Localized Tax/Deduction Name 1]": number,
    "[Localized Tax/Deduction Name 2]": number
  },
  "netPay": number,
  "effectiveTaxRate": number,
  "taxBrackets": {
    "federalMarginalRate": number,
    "stateMarginalRate": number
  }
}
"deductions" must be a flat key-value map with the keys being the exact local names of each tax/contribution and values being integers. Sum of all deductions and netPay must equal grossSalary. effectiveTaxRate, federalMarginalRate, and stateMarginalRate must be numbers (percentages, e.g. 22.5). Do not include any formatting, markdown formatting, or explainers, just the JSON payload.`;

  let responseText = '';
  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });
    responseText = response.text.trim();
  } catch (error) {
    console.warn('[taxEngine] Primary gemini-2.5-flash model failed or unavailable. Retrying with gemini-1.5-flash...', error.message);
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      responseText = response.text.trim();
    } catch (secondError) {
      console.error('[taxEngine] Secondary model also failed. Invoking static code fallback...', secondError.message);
      // Simple fallback in case of rate limits / errors
      const taxableSalary = Math.max(0, salary - preTaxContribution);
      const federalTax = Math.round(taxableSalary * 0.15);
      const stateTax = Math.round(taxableSalary * 0.05);
      const socialSecurity = Math.round(salary * 0.05);
      const medicare = Math.round(salary * 0.02);
      const total = federalTax + stateTax + socialSecurity + medicare;
      return {
        grossSalary: salary,
        currency: currency || 'USD',
        deductions: {
          "National Income Tax": federalTax,
          "Regional/State Tax": stateTax,
          "Social Security / Pension": socialSecurity,
          "Medicare / Health Insurance": medicare
        },
        netPay: salary - total,
        effectiveTaxRate: parseFloat(((total / salary) * 100).toFixed(1)),
        taxBrackets: {
          federalMarginalRate: 15,
          stateMarginalRate: 5
        }
      };
    }
  }

  try {
    return JSON.parse(responseText);
  } catch (parseErr) {
    console.error('[taxEngine] Failed to parse model response as JSON. Output was:', responseText);
    throw parseErr;
  }
}

// ── Entrypoint ─────────────────────────────────────────────────────────────
export async function calculateTaxes({ salary, country, state, currency, preTaxContribution = 0 }) {
  const normCountry = (country || 'US').trim().toLowerCase();
  
  if (normCountry === 'us' || normCountry === 'united states' || normCountry === 'usa') {
    return calculateUSTaxes(salary, state, preTaxContribution);
  } else if (normCountry === 'ca' || normCountry === 'canada') {
    return calculateCanadaTaxes(salary, state, preTaxContribution);
  } else {
    return calculateInternationalTaxesGemini(salary, country, state, currency, preTaxContribution);
  }
}
