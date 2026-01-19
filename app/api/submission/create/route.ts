import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, essayText } = body;

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!essayText || typeof essayText !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'essayText is required' },
        { status: 400 }
      );
    }

    const submission = await prisma.submission.create({
      data: {
        sessionId,
        essayText,
      },
    });

    return NextResponse.json({ ok: true, item: submission });
  } catch (err) {
    console.error('createSubmission error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
