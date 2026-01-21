import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const userId = searchParams.get('userId');

    // Must have either deviceId (guest) or userId (logged-in)
    if (!deviceId && !userId) {
      return NextResponse.json(
        { ok: false, error: 'deviceId or userId query parameter is required' },
        { status: 400 }
      );
    }

    // Build where clause - only filter by ONE identifier to prevent cross-user access
    const where = userId
      ? { userId }
      : { deviceId, userId: null }; // Guest: must have deviceId AND no userId

    const profiles = await prisma.profile.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      items: profiles,
      count: profiles.length,
    });
  } catch (err) {
    console.error('listProfiles error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
