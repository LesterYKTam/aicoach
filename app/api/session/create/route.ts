import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId, topic } = body;

    if (!profileId) {
      return NextResponse.json(
        { ok: false, error: 'profileId is required' },
        { status: 400 }
      );
    }

    const session = await prisma.session.create({
      data: {
        profileId,
        topic: topic ?? null,
        status: 'active',
      },
    });

    return NextResponse.json({ ok: true, item: session });
  } catch (err) {
    console.error('createSession error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
