import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getData } from '../../lib/db';
import { calculateTaxes } from '../../lib/taxEngine';
import { generateTaxExplanation } from '../../lib/explanationEngine';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session')?.value;

    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getData();
    const user = db.users.find(u => u.id === sessionId);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find latest upload for this user
    const userUploads = db.uploads
      .filter(u => u.userId === sessionId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (userUploads.length === 0) {
      return NextResponse.json({ error: 'No profile data found. Please complete Step 1 first.' }, { status: 400 });
    }

    const latestUpload = userUploads[0];
    const { salary, country, state, currency } = latestUpload.data;

    if (!salary) {
      return NextResponse.json({ error: 'Salary details missing in profile. Please re-upload or enter manually.' }, { status: 400 });
    }

    // Default pre-tax contribution rate is 0 initially
    const preTaxContribution = 0;

    const taxBreakdown = await calculateTaxes({
      salary,
      country,
      state,
      currency,
      preTaxContribution
    });

    const explanation = await generateTaxExplanation({
      grossSalary: salary,
      currency: taxBreakdown.currency,
      country,
      state,
      deductions: taxBreakdown.deductions,
      effectiveTaxRate: taxBreakdown.effectiveTaxRate,
      taxBrackets: taxBreakdown.taxBrackets
    });

    return NextResponse.json({
      profile: { salary, country, state, currency },
      taxBreakdown,
      explanation
    });
  } catch (error) {
    console.error('Error in GET /api/taxes:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { salary, country, state, currency, preTaxContributionRate = 0 } = body;

    if (!salary) {
      return NextResponse.json({ error: 'Salary is required' }, { status: 400 });
    }

    const numSalary = Number(salary);
    const contributionRate = Number(preTaxContributionRate);
    const preTaxContribution = Math.round((contributionRate / 100) * numSalary);

    const taxBreakdown = await calculateTaxes({
      salary: numSalary,
      country: country || 'US',
      state: state || '',
      currency: currency || 'USD',
      preTaxContribution
    });

    // Inject contribution into deductions dynamically if > 0
    if (preTaxContribution > 0) {
      taxBreakdown.deductions = {
        "Pre-tax Contribution": preTaxContribution,
        ...taxBreakdown.deductions
      };
    }

    // Recalculate netPay and effective tax rate based on the current deductions map
    const totalDeductionsSum = Object.values(taxBreakdown.deductions).reduce((sum, val) => sum + val, 0);
    taxBreakdown.netPay = numSalary - totalDeductionsSum;
    taxBreakdown.effectiveTaxRate = parseFloat(((totalDeductionsSum / numSalary) * 100).toFixed(1));

    const explanation = await generateTaxExplanation({
      grossSalary: numSalary,
      currency: taxBreakdown.currency,
      country: country || 'US',
      state: state || '',
      deductions: taxBreakdown.deductions,
      effectiveTaxRate: taxBreakdown.effectiveTaxRate,
      taxBrackets: taxBreakdown.taxBrackets
    });

    return NextResponse.json({
      taxBreakdown,
      explanation
    });
  } catch (error) {
    console.error('Error in POST /api/taxes:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
