import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDatabase } from '../../lib/mongodb';
import { getData } from '../../lib/db';
import { calculateTaxes } from '../../lib/taxEngine';
import { parseGoalInput, buildRoadmap } from '../../lib/goalsEngine';

// Helper to authenticate session and sync user/uploads to MongoDB
async function getAuthContext() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session')?.value;

  if (!sessionId) {
    throw new Error('Unauthorized');
  }

  // Get local user from db.json first to bridge data
  const localDb = getData();
  const localUser = localDb.users.find(u => u.id === sessionId);

  if (!localUser) {
    throw new Error('Unauthorized');
  }

  const db = await getDatabase();

  // Sync user to MongoDB users collection if not exists
  let mongoUser = await db.collection('users').findOne({ _id: sessionId });
  if (!mongoUser) {
    await db.collection('users').updateOne(
      { _id: sessionId },
      {
        $set: {
          name: localUser.name,
          email: localUser.email,
          createdAt: new Date(localUser.createdAt || Date.now())
        }
      },
      { upsert: true }
    );
    mongoUser = { _id: sessionId, name: localUser.name, email: localUser.email };
  }

  // Sync latest upload for this user from db.json to MongoDB uploads collection
  const localUploads = localDb.uploads
    .filter(u => u.userId === sessionId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (localUploads.length > 0) {
    const latestLocalUpload = localUploads[0];
    await db.collection('uploads').updateOne(
      { _id: latestLocalUpload.id || latestLocalUpload.timestamp },
      {
        $set: {
          userId: sessionId,
          data: latestLocalUpload.data,
          timestamp: new Date(latestLocalUpload.timestamp)
        }
      },
      { upsert: true }
    );
  }

  // Find latest upload in MongoDB
  const latestMongoUpload = await db.collection('uploads')
    .find({ userId: sessionId })
    .sort({ timestamp: -1 })
    .limit(1)
    .next();

  return { userId: sessionId, user: mongoUser, latestUpload: latestMongoUpload, db };
}

export async function GET() {
  try {
    const { userId, latestUpload, db } = await getAuthContext();

    const activeGoal = await db.collection('goals').findOne({ userId });

    return NextResponse.json({
      hasProfile: !!latestUpload,
      activeGoal,
      profile: latestUpload ? latestUpload.data : null
    });
  } catch (error) {
    console.error('Error in GET /api/goals:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId, latestUpload, db } = await getAuthContext();

    if (!latestUpload) {
      return NextResponse.json({ error: 'Please upload or submit your income profile first (Step 1 & 2).' }, { status: 400 });
    }

    const body = await request.json();
    const {
      message,
      savings = 0,
      savingsList = [],
      debt = [],
      monthlyExpenses = [],
      history = [],
      confirmGoal = false,
      goalData = null // Used when saving the roadmap
    } = body;

    // Calculate net take-home monthly pay
    const { salary, country, state, currency } = latestUpload.data;
    const taxBreakdown = await calculateTaxes({
      salary,
      country,
      state,
      currency,
      preTaxContribution: 0
    });
    const netMonthlyPay = Math.round(taxBreakdown.netPay / 12);

    if (confirmGoal) {
      if (!goalData) {
        return NextResponse.json({ error: 'Goal data is required to confirm.' }, { status: 400 });
      }

      // Update user baseline in MongoDB users collection
      await db.collection('users').updateOne(
        { _id: userId },
        {
          $set: {
            savings: Number(savings),
            savingsList,
            debt,
            monthlyExpenses,
            updatedAt: new Date()
          }
        }
      );

      // Save goal to MongoDB
      const goalToSave = {
        userId,
        ...goalData,
        savings: Number(savings),
        savingsList,
        debt,
        monthlyExpenses,
        updatedAt: new Date()
      };

      await db.collection('goals').updateOne(
        { userId },
        { $set: goalToSave },
        { upsert: true }
      );

      return NextResponse.json({ success: true, goal: goalToSave });
    }

    if (!message) {
      return NextResponse.json({ error: 'Message is required to parse goal.' }, { status: 400 });
    }

    // Call Goals Engine to parse input
    const parsed = await parseGoalInput(message, history);

    if (parsed.needsClarification) {
      return NextResponse.json({
        needsClarification: true,
        followUpQuestions: parsed.followUpQuestions,
        extractedParams: parsed.extractedParams
      });
    }

    // Generate Level-by-Level Roadmap
    const roadmap = await buildRoadmap({
      netMonthlyPay,
      savings: Number(savings),
      debt,
      monthlyExpenses,
      extractedParams: parsed.extractedParams,
      currency: currency || 'USD'
    });

    return NextResponse.json({
      needsClarification: false,
      extractedParams: parsed.extractedParams,
      roadmap
    });

  } catch (error) {
    console.error('Error in POST /api/goals:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { userId, db } = await getAuthContext();
    await db.collection('goals').deleteOne({ userId });
    return NextResponse.json({ success: true, message: 'Goal reset' });
  } catch (error) {
    console.error('Error in DELETE /api/goals:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
