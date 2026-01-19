import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;

    if (!profileId) {
      return NextResponse.json(
        { ok: false, error: 'profileId is required' },
        { status: 400 }
      );
    }

    const sessions = await prisma.session.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      items: sessions,
      count: sessions.length,
    });
  } catch (err) {
    console.error('listSessions error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
