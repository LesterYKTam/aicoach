import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { ok: false, error: 'deviceId query parameter is required' },
        { status: 400 }
      );
    }

    const profiles = await prisma.profile.findMany({
      where: { deviceId },
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
