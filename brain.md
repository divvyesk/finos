# Project Brain: FinOS Personal Finance Application

This file maintains the live state, architecture, history, and goals of the FinOS project. All AI agents must read and update this file continuously to prevent hallucination, minimize redundant analysis, and ensure context persistence across conversations.

---

## 1. What We Are Building & Why

### The Product
**FinOS** is a personalized financial roadmap generator and simulator designed for individuals who have just received their first paycheck and want to learn how money works.
- **Why**: Many young professionals find finance confusing, opaque, and intimidating. FinOS makes it accessible, interactive, and educational.
- **How**: It guides the user through a multi-step journey (Income → Taxes → Goals → Safety Net → Spending → Scenarios → Roadmap) powered by coordinated AI services.
- **Educational Angle**: It teaches personal finance concepts (e.g., 50/30/20 budget, emergency funds, tax brackets) alongside AI engineering concepts (e.g., OCR pipeline, structured LLM extraction, validation, and branching simulations).

---

## 2. Project Structure & Architecture

Below is the directory map of the codebase with the purpose of each key module:

```
finance/
├── AGENTS.md                   # System rules and instructions for AI agents (including Brain.md sync)
├── CLAUDE.md                   # Entry point pointing to AGENTS.md
├── package.json                # Dependencies: Next.js 16, React 19, @google/genai, pdf-parse, tesseract.js, mongodb
├── db.json                     # Local JSON database for development users, uploads, profile, and goals
├── src/
│   └── app/
│       ├── globals.css         # Main stylesheet (premium dark mode theme, colors, and layout classes)
│       ├── layout.js           # Core layout wrapper
│       ├── page.js             # Landing page introducing the journey and learning curriculum
│       ├── login/ & signup/    # User authentication pages
│       ├── dashboard/
│       │   ├── page.js         # Interactive dashboard governing the step-by-step financial flow
│       │   └── Step3Panel.js   # Interactive goals engine workspace and roadmap visualizer
│       ├── api/
│       │   ├── auth/           # Login, signup, and session state endpoints (/api/auth/me)
│       │   ├── geo/            # Country and state lookup for localization
│       │   ├── goals/          # Save profile, load goal workspace, update financial configurations
│       │   ├── taxes/          # Tax bracket engine endpoint
│       │   └── upload/         # File intake API (runs OCR/PDF parser → LLM field extractor → validator)
│       └── lib/
│           ├── db.js           # Read/write access helper for db.json
│           ├── mongodb.js      # MongoDB database driver connection helper
│           ├── openRouterClient.js # Centralized client routing LLM calls to OpenRouter (replacing direct Gemini SDK calls)
│           ├── explanationEngine.js # AI-driven text generator explaining tax calculations & plan allocations
│           ├── goalsEngine.js  # Mathematics for goal success calculations, runway, and financial roadmaps
│           ├── taxEngine.js    # Local tax tables and bracket estimation formulas
│           ├── geo.js          # Raw geographical databases (countries, currencies, states)
│           └── extractors/
│               ├── pdfExtractor.js   # PDF text extraction using pdf-parse
│               ├── imageExtractor.js # OCR text extraction using tesseract.js
│               ├── fieldExtractor.js # LLM structured extraction from offer letters / paystubs
│               └── validator.js      # Data validation rules ensuring sanity of extracted/manual fields
```

---

## 3. What Has Been Done So Far & Why

### Milestones & Decisions
1. **Intake OCR & Parser Layer**: Installed `tesseract.js` and `pdf-parse`. Designed extraction modules to convert raw files (PDF/Images) into raw text, pass it to the LLM, and parse out structured data like salary, country, state, currency, and employment terms.
2. **Validator Engine**: Implemented `validator.js` to ensure the parsed information is financially consistent (e.g. gross pay > net pay, validation warnings/errors).
3. **Tax & Goals Engine**: Added localized estimation rules for taxes (`taxEngine.js`) and simulated success trajectories for goals using compounding math and runaways (`goalsEngine.js`).
4. **OpenRouter Migration**: Replaced direct Gemini SDK calls with a centralized OpenRouter proxy (`openRouterClient.js`) to prevent high demand rate limits on the free Google Gemini tier. The proxy maps direct model designations to OpenRouter slugs (e.g., `gemini-2.5-flash` to `google/gemini-2.5-flash`) and transforms the SDK format to standard chat completions.
5. **Level-wise Chatbot Fix**: Fixed a bug where interacting with the level chatbot before saving/confirming a goal threw a `"No active goal found"` error. We introduced client-side fallback context parameters (`roadmap`, `savings`, `debt`, etc.) to the POST body, and updated `/api/goals/chat` to build prompt context dynamically using these parameters when the database record does not exist yet.
6. **Monthly Deposit Indicators**: Enhanced the roadmap level display to explicitly show the monthly deposit requirement for each stage (calculated dynamically by dividing the level's total target amount by the active timeline in months). Supported automatic updates if switching to/from the stress-free alternative plan.
7. **Cash Flow Surplus Indicators**: Integrated net take-home pay tracking from Step 2 into the Step 3 Baseline Wizard. Created a "Monthly Cash Flow Summary" panel that live-calculates the surplus money left over (take-home minus core expenses) before proceeding. Also added a "Your Monthly Surplus" card to the roadmap dashboard metrics grid.
8. **Five-Level Starter Emergency Fund Roadmap**: Shifted from a 4-level system to a 5-level system to support the "Starter Emergency Fund" approach. The sequence is now: (1) Starter Emergency Shield (1 month of core expenses target), (2) Debt Decelerator (high-interest debt pay down), (3) Full Emergency Guardrail (build remainder up to 3 months of core expenses), (4) Investment Launchpad (automated index funds investing), and (5) Goal Vault (primary goal accumulation).
9. **Granular Savings & Standardized Debt Baseline Inputs**: Replaced the single savings number input in Step 3 with a list builder supporting selection dropdowns for type (Regular Savings, HYSA, Investment) and popular HYSA banks, as well as standardized debt category dropdowns. Dynamic calculated sums are passed alongside detailed breakdown list states to MongoDB.
10. **Automatic OpenRouter Model Fallbacks & JSON Sanitization**: Modified `openRouterClient.js` to execute calls via an inner request executor and catch exceptions. If the primary model (`google/gemini-2.5-flash`) fails, it enters a try-retry loop attempting fallback models in sequence (`meta-llama/llama-3.1-8b-instruct`, `google/gemini-2.5-pro`, `anthropic/claude-3-haiku`). Added automated markdown code block cleaning (`cleanJSONText`) on returned JSON text whenever `responseMimeType: 'application/json'` is set to avoid formatting syntax errors during client parsing.
11. **Grounded & Empathetic Level Explanations**: Refined the prompt inside `goalsEngine.js` to instruct the AI with temperature `0.0` (deterministic outputs) to provide detailed explanations (exactly 3-4 sentences per section) using clear analogies. Rewrote the fallback templates inside `goalsEngine.js` to provide comprehensive, detailed, and warm instructions for first-time earners.

---

## 4. Current Goal

- **Goal**: Maintain code alignment and support subsequent roadmap refinement requests.
- **Why**: Deliver clear, transparent, and actionable personal finance tools.
- **State**: The `brain.md` file is actively synchronized. Detailed, grounded level descriptions are fully integrated into the goals engine with deterministic parameters and expanded fallback templates.

---

## 5. How to Update This File

When the user asks you to **"update the brain.md file"**, follow these instructions:
1. **Analyze recent changes**: Look at `git log`, `git status`, or the conversation history/context to identify what tasks were completed.
2. **Review structure changes**: If any new files were created, moved, or deleted, update the **Project Structure & Architecture** section.
3. **Record progress**: Add the completed work to **What Has Been Done So Far & Why** with details on *what* was done and *why*.
4. **Define the next step**: Update the **Current Goal** section to reflect the new direction or the user's next request.
5. **Keep it concise**: Preserve the clear markdown headings and structure for future readability.
