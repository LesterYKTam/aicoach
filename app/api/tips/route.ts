import { NextRequest, NextResponse } from 'next/server';

// Word count requirements by grade
const wordCountByGrade: Record<number, { min: number; target: number }> = {
  1: { min: 40, target: 60 },
  2: { min: 60, target: 80 },
  3: { min: 80, target: 100 },
  4: { min: 100, target: 130 },
  5: { min: 130, target: 160 },
  6: { min: 160, target: 200 },
  7: { min: 200, target: 250 },
  8: { min: 250, target: 300 },
  9: { min: 300, target: 350 },
  10: { min: 350, target: 400 },
  11: { min: 400, target: 450 },
  12: { min: 450, target: 500 },
};

// Structure requirements by grade
function getStructureRequirements(grade: number) {
  if (grade <= 2) {
    return {
      paragraphs: [
        { name: 'Beginning', required: true, description: 'Start your story or idea' },
        { name: 'Middle', required: true, description: 'Tell more details' },
        { name: 'End', required: true, description: 'Finish your writing' },
      ],
      minBodyParagraphs: 1,
      counterpointRequired: false,
    };
  } else if (grade <= 4) {
    return {
      paragraphs: [
        { name: 'Introduction', required: true, description: 'Tell what your essay is about' },
        { name: 'Body Paragraph 1', required: true, description: 'Your first main idea' },
        { name: 'Body Paragraph 2', required: true, description: 'Your second main idea' },
        { name: 'Conclusion', required: true, description: 'Wrap up your essay' },
      ],
      minBodyParagraphs: 2,
      counterpointRequired: false,
    };
  } else if (grade <= 6) {
    return {
      paragraphs: [
        { name: 'Introduction', required: true, description: 'Hook + state your position' },
        { name: 'Body Paragraph 1', required: true, description: 'First reason with details' },
        { name: 'Body Paragraph 2', required: true, description: 'Second reason with details' },
        { name: 'Conclusion', required: true, description: 'Restate and wrap up' },
      ],
      minBodyParagraphs: 2,
      counterpointRequired: false,
    };
  } else {
    // Grade 7+
    return {
      paragraphs: [
        { name: 'Introduction', required: true, description: 'Hook + clear thesis statement' },
        { name: 'Body Paragraph 1', required: true, description: 'First argument with evidence' },
        { name: 'Body Paragraph 2', required: true, description: 'Second argument with evidence' },
        { name: 'Body Paragraph 3', required: true, description: 'Third argument OR counterpoint' },
        { name: 'Conclusion', required: true, description: 'Restate thesis + final thought' },
      ],
      minBodyParagraphs: 3,
      counterpointRequired: true,
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const grade = Number(searchParams.get('grade') ?? 5);

    if (!Number.isFinite(grade) || grade < 1 || grade > 12) {
      return NextResponse.json(
        { ok: false, error: 'grade must be 1-12' },
        { status: 400 }
      );
    }

    const wordCount = wordCountByGrade[grade] ?? { min: 150, target: 200 };
    const structure = getStructureRequirements(grade);

    return NextResponse.json({
      ok: true,
      requirements: {
        wordCount,
        structure,
      },
    });
  } catch (err) {
    console.error('getTips error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
