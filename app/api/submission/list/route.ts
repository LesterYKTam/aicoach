import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: 'sessionId query parameter is required' },
        { status: 400 }
      );
    }

    const submissions = await prisma.submission.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      items: submissions,
      count: submissions.length,
    });
  } catch (err) {
    console.error('listSubmissions error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
