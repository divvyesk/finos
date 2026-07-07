/**
 * Stage 3 — Validation Layer
 *
 * Takes the structured JSON from Stage 2 and runs deterministic rule checks.
 * This is pure JavaScript logic — no AI, no randomness.
 *
 * Output:
 * {
 *   isValid: boolean,       // false if any blocking ERROR exists
 *   errors: string[],       // blocking — user must fix before proceeding
 *   warnings: string[],     // non-blocking — user should verify but can continue
 * }
 *
 * Rule design:
 * - ERRORS block the pipeline. The frontend shows a clarification prompt.
 * - WARNINGS are displayed as advisory notices. The user can override.
 */

export async function validateExtractedData(data) {
  const errors = [];
  const warnings = [];

  // Convert salary to USD if currency is not USD
  let salaryInUSD = data.salary;
  if (data.salary !== null && data.salary !== undefined) {
    const currency = (data.currency || 'USD').toUpperCase();
    if (currency !== 'USD') {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        if (!res.ok) throw new Error('API response not ok');
        const json = await res.json();
        const rate = json.rates[currency];
        if (rate) {
          salaryInUSD = data.salary / rate;
        } else {
          const fallbacks = { INR: 84, CAD: 1.36, GBP: 0.78, EUR: 0.92, AUD: 1.5, SGD: 1.34, JPY: 155 };
          const fallbackRate = fallbacks[currency] || 1;
          salaryInUSD = data.salary / fallbackRate;
        }
      } catch (err) {
        console.warn('[validator] Failed to fetch live exchange rate, using static fallback:', err.message);
        const fallbacks = { INR: 84, CAD: 1.36, GBP: 0.78, EUR: 0.92, AUD: 1.5, SGD: 1.34, JPY: 155 };
        const fallbackRate = fallbacks[currency] || 1;
        salaryInUSD = data.salary / fallbackRate;
      }
    }
  }

  // ── BLOCKING ERRORS ──────────────────────────────────────────

  // Salary is the most critical field — nothing works without it
  if (data.salary === null || data.salary === undefined) {
    errors.push('Could not detect base salary. Please enter it manually.');
  } else if (salaryInUSD < 5000) {
    errors.push(
      `Salary of ${data.currency || '$'}${data.salary.toLocaleString()} (approx. $${Math.round(salaryInUSD).toLocaleString()} USD) looks too low for an annual figure. ` +
      `Did the document show a weekly or hourly rate instead?`
    );
  } else if (salaryInUSD > 1000000) {
    errors.push(
      `Salary of ${data.currency || '$'}${data.salary.toLocaleString()} (approx. $${Math.round(salaryInUSD).toLocaleString()} USD) is unusually high. ` +
      `Please verify the currency and figure.`
    );
  }

  // State is required for US tax calculations
  if ((data.country === 'US' || data.country === 'USA') && !data.state) {
    errors.push('Employment state is missing. Required for US federal and state tax calculations.');
  }

  // Pay frequency is required to compute per-paycheck breakdown
  if (!data.pay_frequency) {
    errors.push('Pay frequency (weekly, biweekly, monthly, etc.) could not be detected. Please specify it manually.');
  }

  // ── NON-BLOCKING WARNINGS ────────────────────────────────────

  if (data.signing_bonus && data.signing_bonus > data.salary) {
    warnings.push(
      `Signing bonus (${data.signing_bonus.toLocaleString()}) exceeds base salary. Verify this is correct.`
    );
  }

  if (data.vesting_period_years !== null && data.vesting_period_years > 6) {
    warnings.push(
      `RSU vesting period of ${data.vesting_period_years} years is unusually long. Standard is 4 years.`
    );
  }

  if (data.retirement_401k?.match_rate !== null && data.retirement_401k?.match_rate > 1.0) {
    warnings.push(
      `401(k) match rate of ${(data.retirement_401k.match_rate * 100).toFixed(0)}% exceeds 100%. Verify the document.`
    );
  }

  if (data.pto_days !== null) {
    if (data.pto_days < 5) {
      warnings.push(`PTO of ${data.pto_days} days is below the legal minimum in many US states. Verify this is correct.`);
    }
    if (data.pto_days > 60) {
      warnings.push(`PTO of ${data.pto_days} days is unusually high. Verify this isn't a total leave balance.`);
    }
  }

  if (!data.start_date) {
    warnings.push('Start date not detected. You can add it manually if needed for roadmap planning.');
  }

  if (!data.location) {
    warnings.push('Work location not detected. This may affect state tax jurisdiction calculations.');
  }

  if (!data.health_insurance) {
    warnings.push('No health insurance benefits detected in the document. This is unusual for full-time employment.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
