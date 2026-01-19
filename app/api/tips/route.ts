import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';

const tipsSchema = {
  name: 'writing_tips_v1',
  schema: {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      wordCount: { type: 'integer', minimum: 50, maximum: 800 },
      paragraphStructure: {
        type: 'array',
        minItems: 4,
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            paragraph: { type: 'string' },
            guidance: { type: 'string' },
          },
          required: ['paragraph', 'guidance'],
        },
      },
      quickTips: {
        type: 'array',
        minItems: 3,
        maxItems: 4,
        items: { type: 'string', minLength: 10, maxLength: 80 },
      },
    },
    required: ['wordCount', 'paragraphStructure', 'quickTips'],
  },
};

const wordCountByGrade: Record<number, number> = {
  1: 60, 2: 80, 3: 100, 4: 130, 5: 160, 6: 200,
  7: 250, 8: 300, 9: 350, 10: 400, 11: 450, 12: 500,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const grade = Number(searchParams.get('grade') ?? 5);
    const topic = searchParams.get('topic') ?? '';

    if (!Number.isFinite(grade) || grade < 1 || grade > 12) {
      return NextResponse.json(
        { ok: false, error: 'grade must be 1-12' },
        { status: 400 }
      );
    }

    const targetWordCount = wordCountByGrade[grade] ?? 200;

    const resp = await getOpenAI().responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: `
You are a friendly writing coach helping a Grade ${grade} student write an essay.
${topic ? `The student's topic is: "${topic}"` : 'The student is about to write an essay.'}

Generate helpful writing tips for this grade level:

1. Word count target: ${targetWordCount} words (appropriate for Grade ${grade})

2. Paragraph structure: Provide guidance for a 4-paragraph essay:
   - Introduction: How to start (kid-friendly advice)
   - Body Paragraph 1: First main point
   - Body Paragraph 2: Second main point
   - Conclusion: How to wrap up

3. Quick tips: 3-4 short, encouraging tips a ${grade}th grader can follow.
   Examples of good tips:
   - "Start with a question or fun fact to grab attention"
   - "Use words like 'first', 'next', 'finally' to connect your ideas"
   - "Read your essay out loud to catch mistakes"

Keep all language simple and encouraging - this is for a ${grade}th grader!
`.trim(),
      text: {
        format: {
          type: 'json_schema',
          name: tipsSchema.name,
          schema: tipsSchema.schema,
        },
      },
    });

    const data = JSON.parse(resp.output_text);

    // Ensure correct paragraph labels
    const expected = ['Introduction', 'Body Paragraph 1', 'Body Paragraph 2', 'Conclusion'];
    data.paragraphStructure = data.paragraphStructure.map((p: { guidance: string }, i: number) => ({
      paragraph: expected[i],
      guidance: p.guidance,
    }));
    data.wordCount = targetWordCount;

    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error('getTips error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
