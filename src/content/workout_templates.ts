export type ExerciseTemplate = {
  name: string;
  sets: number;
  reps: number;
  weight_kg?: number;
  notes?: string;
};

export type WorkoutTemplate = {
  key: string;
  title: string;
  description: string;
  duration_minutes: number;
  focus_area: string;
  exercises: ExerciseTemplate[];
};

export const workoutTemplates: WorkoutTemplate[] = [
  {
    key: 'full_body_strength_day_1',
    title: 'Full Body Strength - Day 1',
    description: 'Compound lifts and accessories',
    duration_minutes: 45,
    focus_area: 'Full Body',
    exercises: [
      { name: 'Back Squat', sets: 4, reps: 5, notes: 'RPE 7–8, 2–3 min rest' },
      { name: 'Barbell Bench Press', sets: 4, reps: 5, notes: 'RPE 7–8, 2–3 min rest' },
      { name: 'Romanian Deadlift', sets: 3, reps: 8, notes: 'Controlled eccentric, 2 min rest' },
      { name: 'Pull-Up or Lat Pulldown', sets: 3, reps: 8, notes: 'Full range; add assistance if needed' },
      { name: 'One-Arm Dumbbell Row', sets: 3, reps: 10, notes: 'Each side; 60–90s rest' },
      { name: 'Plank Hold', sets: 3, reps: 45, notes: 'Seconds; braced core, 45–60s rest' },
    ],
  },
  {
    key: 'upper_body_push',
    title: 'Upper Body Push',
    description: 'Pressing focus with accessories',
    duration_minutes: 40,
    focus_area: 'Chest/Shoulders/Triceps',
    exercises: [
      { name: 'Barbell Bench Press', sets: 4, reps: 6, notes: 'RPE 7–8, 2–3 min rest' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: 10, notes: '90s rest' },
      { name: 'Overhead Press', sets: 3, reps: 8, notes: 'RPE 7–8, 2 min rest' },
      { name: 'Dumbbell Lateral Raise', sets: 3, reps: 12, notes: 'Strict form, 60s rest' },
      { name: 'Triceps Rope Pushdown', sets: 3, reps: 12, notes: 'Full lockout, 60s rest' },
      { name: 'Push-Ups', sets: 2, reps: 15, notes: 'AMRAP target; modify as needed' },
    ],
  },
  {
    key: 'lower_body_strength',
    title: 'Lower Body Strength',
    description: 'Squat pattern emphasis',
    duration_minutes: 50,
    focus_area: 'Legs/Glutes',
    exercises: [
      { name: 'Back Squat', sets: 5, reps: 5, notes: 'RPE 7–8, 2–3 min rest' },
      { name: 'Romanian Deadlift', sets: 4, reps: 8, notes: 'Hinge; hamstring focus, 2 min rest' },
      { name: 'Walking Lunges', sets: 3, reps: 12, notes: 'Each leg; 90s rest' },
      { name: 'Leg Press', sets: 3, reps: 10, notes: 'Controlled depth, 90s rest' },
      { name: 'Standing Calf Raise', sets: 3, reps: 15, notes: 'Pause at top/bottom, 60s rest' },
      { name: 'Hanging Knee Raise', sets: 3, reps: 12, notes: 'Slow and controlled' },
    ],
  },
  {
    key: 'hiit_cardio',
    title: 'HIIT Cardio',
    description: 'Intervals for conditioning',
    duration_minutes: 25,
    focus_area: 'Cardio',
    exercises: [
      { name: 'Warm-Up (Easy Cardio)', sets: 1, reps: 3, notes: 'Minutes; RPE 3' },
      { name: 'HIIT Intervals (Run/Bike/Row)', sets: 8, reps: 1, notes: '8 rounds: 60s hard @ RPE 8–9 / 90s easy' },
      { name: 'Cooldown (Easy Cardio)', sets: 1, reps: 2, notes: 'Minutes; nasal breathing' },
    ],
  },
];


