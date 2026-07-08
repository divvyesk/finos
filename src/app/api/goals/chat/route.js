import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDatabase } from '../../../lib/mongodb';
import { callOpenRouter } from '../../../lib/openRouterClient.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });


export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session')?.value;

    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { levelNumber, message } = body;

    if (levelNumber === undefined || !message) {
      return NextResponse.json({ error: 'Level number and message are required' }, { status: 400 });
    }

    const db = await getDatabase();
    const activeGoal = await db.collection('goals').findOne({ userId: sessionId });

    if (!activeGoal) {
      return NextResponse.json({ error: 'No active goal found. Please create a goal first.' }, { status: 400 });
    }

    const level = activeGoal.roadmap?.levels?.find(l => l.levelNumber === Number(levelNumber));
    if (!level) {
      return NextResponse.json({ error: 'Invalid level number' }, { status: 400 });
    }


    const prompt = `You are a helpful, direct financial advisor assistant inside the FinOS application.
The user is viewing the roadmap step: "Level ${level.levelNumber}: ${level.title}".
Context of this level:
- Action: ${level.action}
- Target: ${level.targetAmount}
- Stored/Invested in: ${level.allocation}
- What it is: ${level.what}
- Why: ${level.why}
- Where: ${level.where}
- How: ${level.how}

User's financial context:
- Base Salary: ${activeGoal.targetCost} ${activeGoal.roadmap?.currency || 'USD'}
- Available Savings: ${activeGoal.savings}
- Debt details: ${JSON.stringify(activeGoal.debt)}
- Monthly Expenses details: ${JSON.stringify(activeGoal.monthlyExpenses)}

User's Question: "${message}"

Task:
Answer the user's question directly, clearly, and concisely (1-3 short paragraphs maximum). Ensure your answer is specifically tailored to this level's context and their financial situation. Use bullet points or code formatting if appropriate. Answer "how, what, why, where" questions directly.

Do not include any greeting or signature, just write the helpful response in clear markdown format.`;

    const response = await callOpenRouter({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    const reply = response.text.trim();

    // Log chat message to history in MongoDB
    const chatMsg = {
      role: 'user',
      text: message,
      timestamp: new Date()
    };
    const replyMsg = {
      role: 'model',
      text: reply,
      timestamp: new Date()
    };

    // Update level chatHistory in DB
    await db.collection('goals').updateOne(
      { userId: sessionId, "roadmap.levels.levelNumber": Number(levelNumber) },
      {
        $push: {
          "roadmap.levels.$.chatHistory": {
            $each: [chatMsg, replyMsg]
          }
        }
      }
    );

    return NextResponse.json({ reply });

  } catch (error) {
    console.error('Error in POST /api/goals/chat:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
