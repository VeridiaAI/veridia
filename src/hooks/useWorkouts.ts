import { useState, useEffect } from 'react';
import { supabase, Database } from '../lib/supabase';
import { format } from 'date-fns';

type Workout = Database['public']['Tables']['workouts']['Row'];
type Exercise = Database['public']['Tables']['exercises']['Row'];

export function useWorkouts(userId: string) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchWorkouts();
    }
  }, [userId]);

  const fetchWorkouts = async () => {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setWorkouts(data || []);
    } catch (error) {
      console.error('Error fetching workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const createWorkout = async (workout: Omit<Database['public']['Tables']['workouts']['Insert'], 'user_id'>) => {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .insert([{ ...workout, user_id: userId }])
        .select()
        .single();

      if (error) throw error;
      await fetchWorkouts();
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const updateWorkout = async (id: string, updates: Database['public']['Tables']['workouts']['Update']) => {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchWorkouts();
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const deleteWorkout = async (id: string) => {
    try {
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchWorkouts();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const getTodaysWorkout = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return workouts.find(workout => workout.scheduled_date === today);
  };

  const getUpcomingWorkouts = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return workouts.filter(workout => 
      workout.scheduled_date > today && workout.status === 'scheduled'
    );
  };

  const getCompletedWorkouts = () => {
    return workouts.filter(workout => workout.status === 'completed');
  };

  return {
    workouts,
    loading,
    createWorkout,
    updateWorkout,
    deleteWorkout,
    getTodaysWorkout,
    getUpcomingWorkouts,
    getCompletedWorkouts,
    refetch: fetchWorkouts,
  };
}

export function useExercises(workoutId: string) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workoutId) {
      fetchExercises();
    }
  }, [workoutId]);

  const fetchExercises = async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('workout_id', workoutId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setExercises(data || []);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  const createExercise = async (exercise: Omit<Database['public']['Tables']['exercises']['Insert'], 'workout_id'>) => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .insert([{ ...exercise, workout_id: workoutId }])
        .select()
        .single();

      if (error) throw error;
      await fetchExercises();
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const updateExercise = async (id: string, updates: Database['public']['Tables']['exercises']['Update']) => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchExercises();
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const deleteExercise = async (id: string) => {
    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchExercises();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  return {
    exercises,
    loading,
    createExercise,
    updateExercise,
    deleteExercise,
    refetch: fetchExercises,
  };
}