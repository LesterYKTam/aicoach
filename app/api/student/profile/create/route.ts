import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, displayName, grade } = body;

    if (!deviceId) {
      return NextResponse.json(
        { ok: false, error: 'deviceId is required' },
        { status: 400 }
      );
    }

    const profile = await prisma.profile.create({
      data: {
        deviceId,
        displayName: displayName ?? null,
        grade: grade ?? null,
      },
    });

    return NextResponse.json({ ok: true, item: profile });
  } catch (err) {
    console.error('createProfile error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
