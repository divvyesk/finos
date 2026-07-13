# FinOS

FinOS is an AI-powered personal finance simulator and roadmap planner. It takes the guesswork out of budgeting by parsing your actual paystub or offer letter, running localized tax simulations, and helping you build a clear, step-by-step savings and investment roadmap with the help of a friendly feline mascot, Penny.

---

## What It Does

### 1. Smart Document Intake
Instead of manually typing in your salary details, you can upload a PDF or an image of your paycheck or offer letter. 
- **OCR & Extraction:** Under the hood, `tesseract.js` (for images) and `pdf-parse` (for PDFs) extract the raw text. 
- **AI Processing:** An LLM processes the raw text to extract structured details like base salary, bonuses, pay frequency, location, and retirement matching limits. 
- **Manual Adjustments:** You can review and tweak the extracted numbers at any time.

### 2. Localized Tax Simulation
Once your gross salary is confirmed, the tax engine runs a localized simulation based on your country and state. It calculates the exact taxes according to your work location. 

This gives you a realistic view of the actual surplus cash you have available for savings.

### 3. Dynamic Waterfall Roadmap
You define your financial goals (like building an emergency fund, buying a car, or saving for a house deposit) through an interactive chat with **Penny**, our project companion. Penny is inspired by the creator's real-life cat, Strawberry!
- **Roadmap Generation:** Penny creates a sequential, 5-level compounding savings plan.
- **Level Workspaces:** Each roadmap level has its own dedicated workspace. Here, you get a breakdown of the goal (What, Why, Where, How), a customized action checklist, and an inline workspace chat where you can ask Penny specific questions about that step.
- **Completion Tracking:** Checking off tasks in your workspace checklists updates your progress bar. The main dashboard progress tracker ticks off the final "Define Goals" stage once all your roadmap checklists reach 100% completion.

---

## Tech Stack

- **Framework:** Next.js (App Router, React 19)
- **Styling:** Vanilla CSS (Apple light-mode styling, glassmorphism, and responsive CSS grids)
- **Animations:** Framer Motion & HTML5 Canvas (for 60fps scrollytelling image-sequence rendering)
- **Database:** MongoDB
- **OCR Engine:** Tesseract.js (for images) & pdf-parse (for PDFs)
- **AI Integration:** Google Gemini SDK via Node.js

---

## Folder Structure

```
├── public/                 # Static assets (images, mascot sequences, author photos)
├── src/
│   ├── app/                # Next.js App Router routes & API endpoints
│   │   ├── api/            # API routes (auth, goals, geo, taxes, document upload)
│   │   ├── author/         # The Author showcase page (/author)
│   │   ├── dashboard/      # Main application dashboard workspace
│   │   ├── login/          # User login page
│   │   ├── signup/         # User registration page
│   │   ├── layout.js       # App root layout
│   │   └── globals.css     # Global stylesheets and CSS design tokens
│   └── components/         # Reusable React components
│       ├── Navbar.js       # Top sticky glassmorphic navigation bar
│       ├── PennyCompanion.js # The animated Penny mascot sidebar companion
│       └── MascotScrollytelling.js # Canvas-based scrolling animation engine
```