import { callOpenRouter } from '../openRouterClient.js';
import dotenv from 'dotenv';

// Load environment variables (fallback in case next server has not loaded them yet)
dotenv.config({ path: '.env.local' });


// ── JSON Schema for structured output ───────────────────────────────────────
// This is passed directly to Gemini as responseSchema.
// Gemini guarantees the response matches this schema exactly.

const COMPENSATION_SCHEMA = {
  type: 'object',
  description: 'Structured compensation data extracted from an employment document.',
  properties: {
    country: {
      type: 'string',
      description: 'ISO 3166-1 alpha-2 country code (e.g. "US", "GB", "IN"). Infer from document context.',
      nullable: true,
    },
    currency: {
      type: 'string',
      description: 'ISO 4217 currency code (e.g. "USD", "GBP", "INR"). Infer from currency symbols or country.',
      nullable: true,
    },
    state: {
      type: 'string',
      description: 'Full name of the state, province, or region (e.g. "California", "Ontario"). Null if not mentioned.',
      nullable: true,
    },
    salary: {
      type: 'number',
      description: 'Annual base salary as a whole number (no decimals). Convert hourly/monthly to annual if needed. Null if not found.',
      nullable: true,
    },
    signing_bonus: {
      type: 'number',
      description: 'One-time signing or sign-on bonus amount. Null if not mentioned.',
      nullable: true,
    },
    relocation_bonus: {
      type: 'number',
      description: 'Relocation allowance, stipend, or assistance amount. Null if not mentioned.',
      nullable: true,
    },
    rsu_count: {
      type: 'number',
      description: 'Number of Restricted Stock Units (RSUs) granted. Null if not mentioned.',
      nullable: true,
    },
    vesting_period_years: {
      type: 'number',
      description: 'RSU vesting period in years (e.g. 4). Null if not mentioned.',
      nullable: true,
    },
    stock_options: {
      type: 'number',
      description: 'Number of stock options granted. Null if not mentioned.',
      nullable: true,
    },
    pay_frequency: {
      type: 'string',
      enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
      description: 'How often the employee is paid. Null if not stated.',
      nullable: true,
    },
    start_date: {
      type: 'string',
      description: 'Employment start date in ISO 8601 format: YYYY-MM-DD. Null if not mentioned.',
      nullable: true,
    },
    location: {
      type: 'string',
      description: 'Work location as a human-readable string (e.g. "San Francisco, CA" or "London, UK"). Null if not mentioned.',
      nullable: true,
    },
    employment_type: {
      type: 'string',
      enum: ['full_time', 'part_time', 'contract', 'intern'],
      description: 'Type of employment. Default to "full_time" if the document is clearly an offer letter but type is not explicit.',
      nullable: true,
    },
    retirement_401k: {
      type: 'object',
      description: '401(k) or pension match details. Null if not mentioned.',
      nullable: true,
      properties: {
        match_rate: {
          type: 'number',
          description: 'Employer match rate as a decimal (e.g. 0.50 for 50% match). Null if not parseable.',
          nullable: true,
        },
        match_limit: {
          type: 'number',
          description: 'Maximum percentage of salary the employer matches (e.g. 6 for "up to 6%"). Null if not parseable.',
          nullable: true,
        },
      },
    },
    health_insurance: {
      type: 'object',
      description: 'Health insurance benefits. Null if none mentioned.',
      nullable: true,
      properties: {
        medical: { type: 'boolean', description: 'True if medical/health coverage is mentioned.' },
        dental: { type: 'boolean', description: 'True if dental coverage is mentioned.' },
        vision: { type: 'boolean', description: 'True if vision coverage is mentioned.' },
      },
    },
    pto_days: {
      type: 'number',
      description: 'Annual paid time off in days. Null if not mentioned.',
      nullable: true,
    },
    probation_period_days: {
      type: 'number',
      description: 'Probationary period length in days. Convert months to days (1 month = 30 days). Null if not mentioned.',
      nullable: true,
    },
  },
  required: [
    'country', 'currency', 'state', 'salary', 'signing_bonus',
    'relocation_bonus', 'rsu_count', 'vesting_period_years', 'stock_options',
    'pay_frequency', 'start_date', 'location', 'employment_type',
    'retirement_401k', 'health_insurance', 'pto_days', 'probation_period_days',
  ],
};

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a specialist in reading employment documents: offer letters, paystubs, employment contracts, and compensation summaries.

Your job is to extract structured compensation data from the document text provided.

Rules:
- Return ONLY the JSON object. No explanation, no markdown, no extra text.
- Set a field to null if the information is genuinely absent. NEVER fabricate or guess a value.
- Salary must always be the ANNUAL base figure. If the document shows hourly or monthly, convert it.
- Currency: use ISO 4217 codes (USD, GBP, EUR, INR, CAD, AUD, SGD, JPY, NZD, etc.).
- Country: use ISO 3166-1 alpha-2 codes (US, GB, IN, CA, AU, SG, JP, NZ, DE, FR, etc.).
- Dates must be in YYYY-MM-DD format.
- match_rate for 401k is a decimal (50% match = 0.50, not 50).
- If employment type is not stated but the document is clearly a full-time offer letter, use "full_time".`;

// ── Safe null template ───────────────────────────────────────────────────────
// Returned if the API call fails entirely, so the pipeline never crashes.

const NULL_RESULT = {
  country: 'US',
  currency: 'USD',
  state: null,
  salary: null,
  signing_bonus: null,
  relocation_bonus: null,
  rsu_count: null,
  vesting_period_years: null,
  stock_options: null,
  pay_frequency: null,
  start_date: null,
  location: null,
  employment_type: 'full_time',
  retirement_401k: null,
  health_insurance: null,
  pto_days: null,
  probation_period_days: null,
};

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * extractAllFields
 *
 * Drop-in replacement for the previous regex-based extractor.
 * Same signature, same return shape — the rest of the pipeline is unchanged.
 *
 * @param {string} rawText - Raw text from Stage 1 (OCR or PDF parse)
 * @returns {Promise<object>} - Structured compensation object
 */
export async function extractAllFields(rawText) {
  if (!rawText || rawText.trim().length === 0) {
    console.warn('[fieldExtractor] Empty raw text — returning null result.');
    return { ...NULL_RESULT };
  }

  try {
    const response = await callOpenRouter({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `${SYSTEM_PROMPT}\n\n---\nDOCUMENT TEXT:\n${rawText}` }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: COMPENSATION_SCHEMA,
        temperature: 0,      // deterministic extraction — no creativity
        maxOutputTokens: 1024,
      },
    });

    const raw = response.text;

    if (!raw) {
      console.warn('[fieldExtractor] Gemini returned empty response.');
      return { ...NULL_RESULT };
    }

    // Parse — Gemini guarantees valid JSON when responseMimeType is set,
    // but we wrap in try/catch as a belt-and-suspenders precaution.
    const parsed = JSON.parse(raw);

    // Merge with NULL_RESULT to ensure every key is present even if
    // Gemini omits an optional field.
    return { ...NULL_RESULT, ...parsed };

  } catch (err) {
    console.error('[fieldExtractor] Gemini API call failed:', err.message);
    // Return safe defaults so Stage 3 validator surfaces missing fields
    // to the user instead of crashing the server.
    return { ...NULL_RESULT };
  }
}
