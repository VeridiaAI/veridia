import { useState, useEffect } from 'react';
import { supabase, Database } from '../lib/supabase';

type Session = Database['public']['Tables']['workout_sessions']['Row'];
type SessionInsert = Database['public']['Tables']['workout_sessions']['Insert'];
type SetLog = Database['public']['Tables']['set_logs']['Row'];
type SetLogInsert = Database['public']['Tables']['set_logs']['Insert'];

export function useSessions(userId: string) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetchSessions();
  }, [userId]);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });
      if (error) throw error;
      setSessions(data || []);
    } catch (e) {
      console.error('Error fetching sessions', e);
    } finally {
      setLoading(false);
    }
  };

  const startSession = async (workoutId: string) => {
    const payload: SessionInsert = { user_id: userId, workout_id: workoutId };
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert([payload])
      .select()
      .single();
    if (error) return { data: null, error } as const;
    await fetchSessions();
    return { data, error: null } as const;
  };

  const completeSession = async (sessionId: string, notes?: string, rpe?: number, totalTimeSec?: number) => {
    const { data, error } = await supabase
      .from('workout_sessions')
      .update({ ended_at: new Date().toISOString(), notes: notes ?? null, rpe: rpe ?? null, total_time_sec: totalTimeSec ?? null })
      .eq('id', sessionId)
      .select()
      .single();
    if (error) return { data: null, error } as const;
    await fetchSessions();
    return { data, error: null } as const;
  };

  const logSet = async (sessionId: string, exerciseId: string, setIndex: number, reps?: number, weightKg?: number, completed: boolean = true) => {
    const payload: SetLogInsert = {
      session_id: sessionId,
      exercise_id: exerciseId,
      set_index: setIndex,
      reps: reps ?? null,
      weight_kg: weightKg ?? null,
      completed,
    };
    const { data, error } = await supabase
      .from('set_logs')
      .insert([payload])
      .select()
      .single();
    return { data, error } as const;
  };

  const getSetLogsForSession = async (sessionId: string) => {
    const { data, error } = await supabase
      .from('set_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('set_index', { ascending: true });
    return { data: (data || []) as SetLog[], error } as const;
  };

  return { sessions, loading, startSession, completeSession, logSet, getSetLogsForSession, refetch: fetchSessions };
}


