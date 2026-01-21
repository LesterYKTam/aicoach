import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';

const coachHelpSchema = {
  name: 'coach_help_v1',
  schema: {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      status: {
        type: 'string',
        enum: ['not_started', 'in_progress', 'almost_done', 'complete'],
        description: 'Where the student is in their writing',
      },
      encouragement: {
        type: 'string',
        minLength: 20,
        maxLength: 100,
        description: 'A short, encouraging message about what they have done well',
      },
      nextStep: {
        type: 'string',
        minLength: 20,
        maxLength: 150,
        description: 'One specific, actionable suggestion for what to do next',
      },
      question: {
        type: 'string',
        minLength: 10,
        maxLength: 100,
        description: 'A thought-provoking question to help them think about their writing',
      },
    },
    required: ['status', 'encouragement', 'nextStep', 'question'],
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { grade, topic, essayText } = body;

    if (!Number.isFinite(grade) || grade < 3 || grade > 8) {
      return NextResponse.json(
        { ok: false, error: 'grade must be 3-8' },
        { status: 400 }
      );
    }

    const wordCount = essayText?.trim().split(/\s+/).length || 0;
    const hasContent = wordCount > 10;

    // If no content, give a starter prompt
    if (!hasContent) {
      return NextResponse.json({
        ok: true,
        status: 'not_started',
        encouragement: "You're about to start writing - that's exciting!",
        nextStep: topic
          ? `Think about your opinion on "${topic}" and write your first sentence.`
          : 'Start by thinking about what you want to say. Write your first thought!',
        question: 'What is the most important thing you want your reader to know?',
      });
    }

    // Get AI feedback on their current writing
    const resp = await getOpenAI().responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: `
You are a friendly, encouraging writing coach for a Grade ${grade} student.
${topic ? `Their topic is: "${topic}"` : ''}

Here is what they have written so far (${wordCount} words):
"""
${essayText}
"""

Give them helpful, personalized feedback:

1. status: Where are they in their writing?
   - "not_started" = less than a sentence
   - "in_progress" = started but not complete
   - "almost_done" = has most parts, needs finishing touches
   - "complete" = has intro, body paragraphs, and conclusion

2. encouragement: Point out ONE specific thing they did well. Be genuine and specific to their writing.

3. nextStep: Give ONE specific, actionable suggestion. Not a list - just the single most helpful next step.
   - If missing intro, help with that
   - If intro done but no body, suggest adding a reason/example
   - If body started, suggest what to add next
   - If almost done, suggest how to wrap up

4. question: Ask ONE thought-provoking question to help them think deeper about their topic.

Keep your language simple and encouraging - this is a ${grade}th grader!
Do NOT overwhelm them with multiple suggestions. ONE encouragement, ONE next step, ONE question.
`.trim(),
      text: {
        format: {
          type: 'json_schema',
          name: coachHelpSchema.name,
          schema: coachHelpSchema.schema,
        },
      },
    });

    const data = JSON.parse(resp.output_text);

    return NextResponse.json({
      ok: true,
      ...data,
    });
  } catch (err) {
    console.error('coachHelp error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
