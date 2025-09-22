// Map exercise names -> demo video URL (YouTube or other). Case-insensitive lookup.
export const exerciseVideoMap: Record<string, string> = {
  // Fill with real links later
  'barbell bench press': 'https://www.youtube.com/watch?v=placeholder-bench',
  'back squat': 'https://youtu.be/AWoz6HhEADU?si=SZlpmbpS5N19xFyJ',
  'romanian deadlift': 'https://www.youtube.com/watch?v=placeholder-rdl',
  'overhead press': 'https://www.youtube.com/watch?v=placeholder-ohp',
};

export function getExerciseVideoUrl(name?: string): string | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  return exerciseVideoMap[key];
}


