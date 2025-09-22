import { useState, useEffect } from 'react';
import { supabase, Database } from '../lib/supabase';
import type { WorkoutTemplate } from '../content/workout_templates';
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

  const createWorkoutFromTemplate = async (
    template: WorkoutTemplate,
    scheduledDate: string
  ) => {
    try {
      // 1) Create the workout
      const workoutPayload: Database['public']['Tables']['workouts']['Insert'] = {
        title: template.title,
        description: template.description,
        duration_minutes: template.duration_minutes,
        focus_area: template.focus_area,
        scheduled_date: scheduledDate,
        status: 'scheduled',
        user_id: userId,
      } as any;

      const { data: workout, error: workoutErr } = await supabase
        .from('workouts')
        .insert([workoutPayload])
        .select()
        .single();
      if (workoutErr || !workout) throw workoutErr || new Error('Workout insert failed');

      // 2) Create the exercises for the new workout
      const exercisePayloads = template.exercises.map((e) => ({
        workout_id: workout.id,
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        weight_kg: e.weight_kg ?? 0,
        notes: e.notes ?? '',
        completed: false,
      }));
      if (exercisePayloads.length > 0) {
        const { error: exErr } = await supabase
          .from('exercises')
          .insert(exercisePayloads);
        if (exErr) {
          // Rollback workout if exercise creation fails
          await supabase.from('workouts').delete().eq('id', workout.id);
          throw exErr;
        }
      }

      await fetchWorkouts();
      return { data: workout, error: null } as const;
    } catch (error) {
      return { data: null, error } as const;
    }
  };

  const getTodaysWorkouts = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return workouts.filter((workout) => workout.scheduled_date === today && workout.status !== 'completed');
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
    createWorkoutFromTemplate,
    updateWorkout,
    deleteWorkout,
    getTodaysWorkouts,
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