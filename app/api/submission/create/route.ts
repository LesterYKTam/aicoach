import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Calculate local date string (YYYY-MM-DD) from UTC time in a specific timezone
function getLocalDate(timezone: string): Date {
  const now = new Date();
  // Get the date parts in the target timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const localDateStr = formatter.format(now); // Returns YYYY-MM-DD format
  return new Date(localDateStr + 'T00:00:00.000Z');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, essayText, timezone: browserTimezone } = body;

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

    // Look up the student's preferred timezone from their user account
    // Session -> Profile -> User -> timezone
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        profile: {
          include: {
            user: true,
          },
        },
      },
    });

    // Priority: User's saved timezone > browser timezone > default
    const studentTimezone = session?.profile?.user?.timezone
      || browserTimezone
      || 'America/Toronto';

    const localDate = getLocalDate(studentTimezone);

    const submission = await prisma.submission.create({
      data: {
        sessionId,
        essayText,
        localDate,
        timezone: studentTimezone,
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
