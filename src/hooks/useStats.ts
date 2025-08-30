import { useState, useEffect } from 'react';
import { supabase, Database } from '../lib/supabase';
import { format, startOfWeek, endOfWeek, subDays } from 'date-fns';

type UserStat = Database['public']['Tables']['user_stats']['Row'];

export function useStats(userId: string) {
  const [stats, setStats] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchStats();
    }
  }, [userId]);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) throw error;
      setStats(data || []);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const logStat = async (date: string, weight_kg?: number, mood_energy?: number) => {
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .upsert([{
          user_id: userId,
          date,
          weight_kg,
          mood_energy,
        }])
        .select()
        .single();

      if (error) throw error;
      await fetchStats();
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const getCurrentStreak = async () => {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('scheduled_date')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('scheduled_date', { ascending: false });

      if (error) throw error;

      let streak = 0;
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      for (const workout of data) {
        const workoutDate = new Date(workout.scheduled_date);
        workoutDate.setHours(0, 0, 0, 0);
        
        const daysBetween = Math.floor((currentDate.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysBetween === streak) {
          streak++;
          currentDate = subDays(currentDate, 1);
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      console.error('Error calculating streak:', error);
      return 0;
    }
  };

  const getWeeklyWorkouts = async () => {
    try {
      const startWeek = format(startOfWeek(new Date()), 'yyyy-MM-dd');
      const endWeek = format(endOfWeek(new Date()), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('scheduled_date', startWeek)
        .lte('scheduled_date', endWeek);

      if (error) throw error;
      return data.length;
    } catch (error) {
      console.error('Error fetching weekly workouts:', error);
      return 0;
    }
  };

  return {
    stats,
    loading,
    logStat,
    getCurrentStreak,
    getWeeklyWorkouts,
    refetch: fetchStats,
  };
}