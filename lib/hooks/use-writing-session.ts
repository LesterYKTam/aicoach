'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

type Profile = {
  id: string;
  deviceId: string | null;
  userId: string | null;
  displayName: string | null;
  grade: number | null;
};

type WritingSession = {
  id: string;
  profileId: string;
  topic: string | null;
  status: string;
};

type Submission = {
  id: string;
  sessionId: string;
  essayText: string;
};

function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers using crypto.getRandomValues
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
      (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
  }
  // Last resort fallback using Math.random (less secure but works everywhere)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

export function useWritingSession() {
  const { data: session, status: authStatus } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [writingSession, setWritingSession] = useState<WritingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceId, setDeviceId] = useState<string>('');

  const isAuthenticated = authStatus === 'authenticated' && !!session?.user?.id;
  const userId = isAuthenticated ? session.user.id : null;

  // Initialize deviceId on mount
  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  // Load or create profile when auth status is known
  useEffect(() => {
    if (authStatus === 'loading' || !deviceId) return;

    async function loadOrCreateProfile() {
      setIsLoading(true);
      try {
        // Build query params
        const params = new URLSearchParams();
        if (userId) {
          params.set('userId', userId);
        } else {
          params.set('deviceId', deviceId);
        }

        // Try to get existing profiles
        const res = await fetch(`/api/student/profile/list?${params}`);
        const data = await res.json();

        if (data.ok && data.items.length > 0) {
          // Use the first profile
          setProfile(data.items[0]);
        } else {
          // Create a new profile
          const createRes = await fetch('/api/student/profile/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId: userId ? null : deviceId,
              userId: userId || null,
            }),
          });
          const createData = await createRes.json();
          if (createData.ok) {
            setProfile(createData.item);
          }
        }
      } catch (err) {
        console.error('Failed to load/create profile:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadOrCreateProfile();
  }, [authStatus, userId, deviceId]);

  // Create a new writing session
  const createSession = useCallback(async (topic?: string): Promise<WritingSession | null> => {
    if (!profile) return null;

    try {
      const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: profile.id,
          topic: topic || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setWritingSession(data.item);
        return data.item;
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
    return null;
  }, [profile]);

  // Create a submission and evaluate it
  const submitAndEvaluate = useCallback(async (
    essayText: string,
    grade: number,
    topic?: string
  ): Promise<{ submission: Submission | null; evaluation: unknown | null }> => {
    if (!profile) {
      return { submission: null, evaluation: null };
    }

    try {
      // Create session if we don't have one or topic changed
      let currentSession = writingSession;
      if (!currentSession || (topic && currentSession.topic !== topic)) {
        currentSession = await createSession(topic);
        if (!currentSession) {
          throw new Error('Failed to create session');
        }
      }

      // Create submission
      const subRes = await fetch('/api/submission/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          essayText,
        }),
      });
      const subData = await subRes.json();
      if (!subData.ok) {
        throw new Error('Failed to create submission');
      }
      const submission = subData.item;

      // Evaluate submission
      const evalRes = await fetch('/api/submission/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submission.id,
          grade,
          essayText,
        }),
      });
      const evaluation = await evalRes.json();

      return { submission, evaluation };
    } catch (err) {
      console.error('Failed to submit and evaluate:', err);
      return { submission: null, evaluation: null };
    }
  }, [profile, writingSession, createSession]);

  // Update profile grade
  const updateProfileGrade = useCallback(async (grade: number) => {
    if (!profile) return;

    // For now, just update local state
    // Could add API endpoint to update profile
    setProfile({ ...profile, grade });
  }, [profile]);

  return {
    profile,
    writingSession,
    isLoading,
    isAuthenticated,
    userId,
    deviceId,
    createSession,
    submitAndEvaluate,
    updateProfileGrade,
  };
}
