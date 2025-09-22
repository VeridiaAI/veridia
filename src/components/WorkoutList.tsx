import React, { useState, useEffect } from 'react';
import { useWorkouts, useExercises } from '../hooks/useWorkouts';
import { workoutTemplates } from '../content/workout_templates';
import { getExerciseVideoUrl } from '../content/exercise_videos';
import { useSessions } from '../hooks/useSessions';
import { format, isToday, isFuture, isPast } from 'date-fns';
import { 
  Play, 
  Edit3, 
  Calendar, 
  Clock, 
  Target,
  Plus,
  CheckCircle,
  Circle,
  X
} from 'lucide-react';

interface WorkoutListProps {
  user: any;
}

export function WorkoutList({ user }: WorkoutListProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'completed' | 'explore'>('today');
  const [selectedWorkout, setSelectedWorkout] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [detailNotes, setDetailNotes] = useState('');
  const [showReschedule, setShowReschedule] = useState<{ id: string; date: string } | null>(null);
  const [showLog, setShowLog] = useState<any>(null);
  const [showExerciseView, setShowExerciseView] = useState<any>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(1);
  const [repsInput, setRepsInput] = useState<number | ''>('');
  const [weightInput, setWeightInput] = useState<number | ''>('');
  const [sessionStartMs, setSessionStartMs] = useState<number | null>(null);
  const [isResting, setIsResting] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [loggedSets, setLoggedSets] = useState<{ reps?: number; weightKg?: number }[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryVolume, setSummaryVolume] = useState(0);
  const [rpe, setRpe] = useState(7);
  const [sessionNotes, setSessionNotes] = useState('');
  const [summaryWorkoutId, setSummaryWorkoutId] = useState<string | null>(null);
  const [summaryLogs, setSummaryLogs] = useState<any[]>([]);
  const [newWorkout, setNewWorkout] = useState({
    title: '',
    description: '',
    duration_minutes: 30,
    focus_area: '',
    scheduled_date: format(new Date(), 'yyyy-MM-dd'),
  });

  const [librarySearch, setLibrarySearch] = useState('');
  const libraryTemplates = workoutTemplates.map(t => ({
    title: t.title,
    duration_minutes: t.duration_minutes,
    focus_area: t.focus_area,
    description: t.description,
    key: t.key,
  }));

  const { 
    workouts, 
    loading, 
    createWorkout, 
    createWorkoutFromTemplate,
    updateWorkout, 
    deleteWorkout,
    getTodaysWorkouts,
    getUpcomingWorkouts,
    getCompletedWorkouts 
  } = useWorkouts(user.id);

  const { exercises, createExercise, updateExercise } = useExercises(selectedWorkout?.id || '');
  // For detail modal preview of exercises
  const { exercises: detailExercises } = useExercises(showDetail?.id || '');
  const { exercises: logExercises } = useExercises(showLog?.id || '');
  const { exercises: evExercises } = useExercises(showExerciseView?.id || '');
  const { exercises: summaryExercises } = useExercises(summaryWorkoutId || '');
  const { startSession, completeSession, logSet, sessions, getSetLogsForSession } = useSessions(user.id);

  // rest timer
  useEffect(() => {
    if (!isResting) return;
    const id = setInterval(() => setRestSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isResting]);

  // Load set logs for summary when opened
  useEffect(() => {
    (async () => {
      if (showSummary && activeSessionId) {
        const { data } = await getSetLogsForSession(activeSessionId);
        setSummaryLogs(data || []);
      }
    })();
  }, [showSummary, activeSessionId]);

  const [newExercise, setNewExercise] = useState({
    name: '',
    sets: 3,
    reps: 10,
    weight_kg: 0,
  });

  const getFilteredWorkouts = () => {
    switch (activeTab) {
      case 'today':
        const todays = getTodaysWorkouts();
        return todays;
      case 'upcoming':
        return getUpcomingWorkouts();
      case 'completed':
        return getCompletedWorkouts();
      case 'explore':
        return [];
      default:
        return [];
    }
  };

  const handleCreateWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const template = (workoutTemplates || []).find((t) => t.title === newWorkout.title);
    let error: any = null;
    let created: any = null;
    if (template) {
      const res = await createWorkoutFromTemplate(template, newWorkout.scheduled_date);
      error = res.error;
      created = res.data;
    } else {
      const res = await createWorkout(newWorkout);
      error = res.error;
      created = res.data;
    }
    if (error) {
      setCreateError((error as any)?.message || 'Could not create workout. Please try again.');
      setCreating(false);
      return;
    }
    setShowCreateForm(false);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setActiveTab(newWorkout.scheduled_date === todayStr ? 'today' : 'upcoming');
    if (created) {
      // Immediately open details of the newly created workout
      setShowDetail(created);
    }
    setNewWorkout({
      title: '',
      description: '',
      duration_minutes: 30,
      focus_area: '',
      scheduled_date: format(new Date(), 'yyyy-MM-dd'),
    });
    setCreating(false);
  };

  const handleStartWorkout = async (workout: any) => {
    await updateWorkout(workout.id, { status: 'in_progress' });
    const { data } = await startSession(workout.id);
    setActiveSessionId(data?.id || null);
    setSessionStartMs(Date.now());
    setExerciseIdx(0);
    setSetIdx(1);
    // Prefill from first exercise
    const first = evExercises[0];
    setRepsInput(first?.reps ?? '');
    setWeightInput(first?.weight_kg ?? '');
    setShowExerciseView(workout);
    setShowDetail(null);
  };

  const handleCompleteWorkout = async (workout: any) => {
    await updateWorkout(workout.id, { status: 'completed' });
    setSelectedWorkout(null);
  };

  const handleAddExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await createExercise(newExercise);
    if (!error) {
      setNewExercise({
        name: '',
        sets: 3,
        reps: 10,
        weight_kg: 0,
      });
    }
  };

  const toggleExerciseComplete = async (exercise: any) => {
    await updateExercise(exercise.id, { completed: !exercise.completed });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workouts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My Workouts</h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Workout
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-xl p-1 mb-6">
          {[
            { key: 'today', label: 'Today', count: getTodaysWorkouts().length },
            { key: 'upcoming', label: 'Upcoming', count: getUpcomingWorkouts().length },
            { key: 'completed', label: 'Completed', count: getCompletedWorkouts().length },
            { key: 'explore', label: 'Explore Library', count: libraryTemplates.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Explore Library */}
        {activeTab === 'explore' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-lg p-4 flex items-center gap-3">
              <input
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Search library..."
                className="flex-1 p-3 border border-gray-200 rounded-xl"
              />
            </div>
            {libraryTemplates
              .filter(t => t.title.toLowerCase().includes(librarySearch.toLowerCase()))
              .map((t, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-lg p-6 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{t.title}</h3>
                  <p className="text-gray-600">{t.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{t.duration_minutes} min</span>
                    <span className="flex items-center gap-1"><Target className="w-4 h-4" />{t.focus_area}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCreateForm(true);
                    setNewWorkout({
                      title: t.title,
                      description: t.description,
                      duration_minutes: t.duration_minutes,
                      focus_area: t.focus_area,
                      scheduled_date: format(new Date(), 'yyyy-MM-dd'),
                    });
                  }}
                  className="bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Create from template
                </button>
              </div>
            ))}
            {libraryTemplates.filter(t => t.title.toLowerCase().includes(librarySearch.toLowerCase())).length === 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center text-gray-500">No results</div>
            )}
          </div>
        )}

        {/* Workout List */}
        {activeTab !== 'explore' && (
        <div className="space-y-4">
          {getFilteredWorkouts().map((workout) => (
            <div key={workout.id} className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <button onClick={() => setShowDetail(workout)} className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 hover:underline">{workout.title}</h3>
                  </button>
                  <p className="text-gray-600 text-sm mb-2">{workout.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(workout.scheduled_date), 'MMM d, yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {workout.duration_minutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      {workout.focus_area}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {workout.status === 'scheduled' && (
                    <button
                      onClick={() => handleStartWorkout(workout)}
                      className="bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Start
                    </button>
                  )}
                  
                  {workout.status === 'in_progress' && (
                    <button
                      onClick={() => handleCompleteWorkout(workout)}
                      className="bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                      Complete
                    </button>
                  )}
                  {activeTab === 'completed' && (
                    <button
                      onClick={() => setShowLog(workout)}
                      className="py-2 px-3 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      View Log
                    </button>
                  )}
                  {activeTab === 'upcoming' && (
                    <>
                      <button
                        onClick={() => setShowReschedule({ id: workout.id, date: workout.scheduled_date })}
                        className="py-2 px-3 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Reschedule
                      </button>
                      <button
                        onClick={() => deleteWorkout(workout.id)}
                        className="py-2 px-3 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setSelectedWorkout(selectedWorkout?.id === workout.id ? null : workout)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Workout Details */}
              {selectedWorkout?.id === workout.id && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-semibold text-gray-900">Exercises</h4>
                    <span className="text-sm text-gray-500">
                      {exercises.filter(e => e.completed).length} / {exercises.length} completed
                    </span>
                  </div>

                  {/* Exercise List */}
                  <div className="space-y-3 mb-4">
                    {exercises.map((exercise) => (
                      <div
                        key={exercise.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <button
                          onClick={() => toggleExerciseComplete(exercise)}
                          className="text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          {exercise.completed ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>
                        <div className="flex-1">
                          <p className={`font-medium ${exercise.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {exercise.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {exercise.sets} sets × {exercise.reps} reps
                            {exercise.weight_kg > 0 && ` @ ${exercise.weight_kg}kg`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Exercise Form */}
                  <form onSubmit={handleAddExercise} className="bg-gray-50 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 mb-3">Add Exercise</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={newExercise.name}
                        onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
                        placeholder="Exercise name"
                        required
                        className="p-2 border border-gray-200 rounded-lg text-sm"
                      />
                      <input
                        type="number"
                        value={newExercise.sets}
                        onChange={(e) => setNewExercise({ ...newExercise, sets: parseInt(e.target.value) })}
                        placeholder="Sets"
                        min="1"
                        className="p-2 border border-gray-200 rounded-lg text-sm"
                      />
                      <input
                        type="number"
                        value={newExercise.reps}
                        onChange={(e) => setNewExercise({ ...newExercise, reps: parseInt(e.target.value) })}
                        placeholder="Reps"
                        min="1"
                        className="p-2 border border-gray-200 rounded-lg text-sm"
                      />
                      <input
                        type="number"
                        step="0.5"
                        value={newExercise.weight_kg}
                        onChange={(e) => setNewExercise({ ...newExercise, weight_kg: parseFloat(e.target.value) })}
                        placeholder="Weight (kg)"
                        min="0"
                        className="p-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full mt-3 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
                    >
                      Add Exercise
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}

          {getFilteredWorkouts().length === 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <p className="text-gray-500 mb-4">
                {activeTab === 'today' && 'No workout scheduled for today'}
                {activeTab === 'upcoming' && 'No upcoming workouts'}
                {activeTab === 'completed' && 'No completed workouts yet'}
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create Workout
              </button>
            </div>
          )}
        </div>
        )}

        {/* Create Workout Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Create New Workout</h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateWorkout} className="space-y-4">
                <input
                  type="text"
                  value={newWorkout.title}
                  onChange={(e) => setNewWorkout({ ...newWorkout, title: e.target.value })}
                  placeholder="Workout title"
                  required
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                
                <textarea
                  value={newWorkout.description}
                  onChange={(e) => setNewWorkout({ ...newWorkout, description: e.target.value })}
                  placeholder="Description (optional)"
                  rows={3}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />

                {(() => {
                  const tmpl = (workoutTemplates || []).find((t) => t.title === newWorkout.title);
                  if (!tmpl || !tmpl.exercises?.length) return null;
                  return (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-sm font-medium text-gray-900 mb-2">Exercises in this template</div>
                      <div className="space-y-2 max-h-48 overflow-auto pr-1">
                        {tmpl.exercises.map((ex, i) => (
                          <div key={`${ex.name}-${i}`} className="flex items-center justify-between p-2 bg-white rounded-lg text-sm border border-gray-100">
                            <span className="font-medium text-gray-800">{ex.name}</span>
                            <span className="text-gray-600">{ex.sets} × {ex.reps}{ex.weight_kg ? ` @ ${ex.weight_kg}kg` : ''}{ex.notes ? ` — ${ex.notes}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {createError && (
                  <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-sm">{createError}</div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={newWorkout.duration_minutes}
                    onChange={(e) => setNewWorkout({ ...newWorkout, duration_minutes: parseInt(e.target.value) })}
                    placeholder="Duration (min)"
                    min="5"
                    className="p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  <input
                    type="text"
                    value={newWorkout.focus_area}
                    onChange={(e) => setNewWorkout({ ...newWorkout, focus_area: e.target.value })}
                    placeholder="Focus area"
                    className="p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <input
                  type="date"
                  value={newWorkout.scheduled_date}
                  onChange={(e) => setNewWorkout({ ...newWorkout, scheduled_date: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Workout Detail / Pre-Workout */}
        {showDetail && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">{showDetail.title}</h3>
                <button onClick={() => setShowDetail(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="text-sm text-gray-600 mb-3">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{format(new Date(showDetail.scheduled_date), 'MMM d, yyyy')}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{showDetail.duration_minutes} min</span>
                  <span className="flex items-center gap-1"><Target className="w-4 h-4" />{showDetail.focus_area}</span>
                </div>
              </div>
              <p className="text-gray-700 mb-4">{showDetail.description}</p>
              <div className="mb-4">
                <h4 className="text-md font-semibold text-gray-900 mb-2">Exercises</h4>
                {detailExercises.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-auto pr-1">
                    {detailExercises.map((ex: any) => (
                      <div key={ex.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                        <span className="font-medium text-gray-800">{ex.name}</span>
                        <span className="text-gray-600">{ex.sets || '-'} x {ex.reps || '-'} {ex.weight_kg ? `@ ${ex.weight_kg}kg` : ''}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No exercises added yet</p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={detailNotes}
                  onChange={(e) => setDetailNotes(e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                  placeholder="Optional pre-workout notes"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => { setSelectedWorkout(showDetail); setShowDetail(null); }}
                  className="flex-1 py-2 px-4 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50"
                >
                  Modify
                </button>
                <button
                  onClick={() => setShowReschedule({ id: showDetail.id, date: showDetail.scheduled_date })}
                  className="flex-1 py-2 px-4 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50"
                >
                  Reschedule
                </button>
                <button
                  onClick={async () => { await handleStartWorkout(showDetail); setShowDetail(null); }}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" /> Start Workout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reschedule Modal */}
        {showReschedule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-semibold mb-4">Reschedule Workout</h3>
              <input
                type="date"
                value={showReschedule.date}
                onChange={(e) => setShowReschedule({ ...showReschedule, date: e.target.value })}
                className="w-full p-3 border border-gray-200 rounded-xl mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReschedule(null)}
                  className="flex-1 py-2 px-4 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await updateWorkout(showReschedule.id, { scheduled_date: showReschedule.date, status: 'scheduled' as any });
                    setShowReschedule(null);
                  }}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Completed Workout Log (stub) */}
        {showLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">{showLog.title} — Log</h3>
                <button onClick={() => setShowLog(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="text-sm text-gray-600 mb-3">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{format(new Date(showLog.scheduled_date), 'MMM d, yyyy')}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{showLog.duration_minutes} min</span>
                  <span className="flex items-center gap-1"><Target className="w-4 h-4" />{showLog.focus_area}</span>
                </div>
              </div>
              {(() => {
                const session = (sessions || []).find((s) => s.workout_id === showLog.id);
                if (!session || (!session.notes && !session.rpe && !session.total_time_sec)) return null;
                return (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-800">
                    {session.notes && (
                      <div className="mb-2">
                        <div className="font-medium text-gray-700 mb-1">Notes</div>
                        <div className="whitespace-pre-wrap">{session.notes}</div>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-gray-600">
                      {typeof session.rpe === 'number' && <span>RPE: {session.rpe}</span>}
                      {typeof session.total_time_sec === 'number' && <span>Total: {Math.round(session.total_time_sec / 60)} min</span>}
                    </div>
                  </div>
                );
              })()}
              <div className="space-y-2 max-h-64 overflow-auto pr-1 mb-4">
                {logExercises.length > 0 ? logExercises.map((ex: any) => (
                  <div key={ex.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                    <span className="font-medium text-gray-800">{ex.name}</span>
                    <span className="text-gray-600">{ex.sets || '-'} x {ex.reps || '-'} {ex.weight_kg ? `@ ${ex.weight_kg}kg` : ''}</span>
                  </div>
                )) : <div className="text-gray-500 text-sm">No exercise details</div>}
              </div>
              <button onClick={() => setShowLog(null)} className="w-full py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700">Close</button>
            </div>
          </div>
        )}

        {/* Exercise View (Screen 13 scaffold) */}
        {showExerciseView && activeSessionId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-semibold">{showExerciseView.title}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">{evExercises.length > 0 ? `${exerciseIdx + 1}/${evExercises.length}` : '0/0'}</span>
                  <button onClick={() => { setShowExerciseView(null); setActiveSessionId(null); }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">Step through each exercise and log your sets.</p>
              {evExercises.length > 0 ? (
                <>
                  <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium text-gray-900 flex items-center justify-between gap-3">
                      <span>{evExercises[exerciseIdx]?.name}</span>
                      {(() => {
                        const url = getExerciseVideoUrl(evExercises[exerciseIdx]?.name);
                        return url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-sm underline"
                          >
                            Demo
                          </a>
                        ) : null;
                      })()}
                    </div>
                    <div className="text-sm text-gray-600">Set {setIdx} of {evExercises[exerciseIdx]?.sets || '-'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Reps</label>
                      <input type="number" value={repsInput as any} onChange={(e) => setRepsInput(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full p-2 border border-gray-200 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Weight (kg)</label>
                      <input type="number" step="0.5" value={weightInput as any} onChange={(e) => setWeightInput(e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-full p-2 border border-gray-200 rounded-lg" />
                    </div>
                  </div>
                  <div className="mb-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-700">Rest timer: {restSeconds}s</div>
                    <button onClick={() => setIsResting((v) => !v)} className="py-1 px-3 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-100">{isResting ? 'Stop' : 'Start'}</button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={async () => {
                        // log set
                        await logSet(activeSessionId, evExercises[exerciseIdx].id, setIdx, typeof repsInput === 'number' ? repsInput : undefined, typeof weightInput === 'number' ? weightInput : undefined, true);
                        setLoggedSets((arr) => [...arr, { reps: typeof repsInput === 'number' ? repsInput : undefined, weightKg: typeof weightInput === 'number' ? weightInput : undefined }]);
                        // advance
                        const totalSets = evExercises[exerciseIdx]?.sets || 1;
                        if (setIdx < totalSets) {
                          setSetIdx(setIdx + 1);
                        } else if (exerciseIdx < evExercises.length - 1) {
                          const nextIdx = exerciseIdx + 1;
                          setExerciseIdx(nextIdx);
                          setSetIdx(1);
                          setRepsInput(evExercises[nextIdx]?.reps ?? '');
                          setWeightInput(evExercises[nextIdx]?.weight_kg ?? '');
                          setRestSeconds(0);
                          setIsResting(false);
                        } else {
                          // finish -> open summary
                          const total = sessionStartMs ? Math.floor((Date.now() - sessionStartMs) / 1000) : 0;
                          const vol = [...loggedSets, { reps: typeof repsInput === 'number' ? repsInput : undefined, weightKg: typeof weightInput === 'number' ? weightInput : undefined }]
                            .reduce((acc, s) => acc + ((s.reps || 0) * (s.weightKg || 0)), 0);
                          setSummaryVolume(vol);
                          setShowExerciseView(null);
                          setSummaryWorkoutId(showExerciseView.id);
                          setShowSummary(true);
                          setRestSeconds(0);
                          setIsResting(false);
                        }
                      }}
                      className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                    >
                      Log Set & Next
                    </button>
                    <button
                      onClick={() => {
                        if (exerciseIdx < evExercises.length - 1) {
                          const nextIdx = exerciseIdx + 1;
                          setExerciseIdx(nextIdx);
                          setSetIdx(1);
                          setRepsInput(evExercises[nextIdx]?.reps ?? '');
                          setWeightInput(evExercises[nextIdx]?.weight_kg ?? '');
                          setRestSeconds(0);
                          setIsResting(false);
                        } else {
                          setShowExerciseView(null);
                        }
                      }}
                      className="py-2 px-4 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50"
                    >
                      Skip Exercise
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-gray-600">No exercises to run.</div>
              )}
            </div>
          </div>
        )}

        {/* Workout Summary & Log (Screen 14) */}
        {showSummary && activeSessionId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
              <h3 className="text-xl font-semibold mb-2">Workout Complete!</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-600">Total Time</div>
                  <div className="text-lg font-semibold">{sessionStartMs ? Math.floor((Date.now() - sessionStartMs) / 60000) : 0} min</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-600">Total Volume</div>
                  <div className="text-lg font-semibold">{Math.round(summaryVolume)} kg-reps</div>
                </div>
              </div>
              {summaryLogs.length > 0 && (
                <div className="mb-4 max-h-40 overflow-auto">
                  <div className="text-sm font-medium text-gray-900 mb-2">Exercises</div>
                  <div className="space-y-2">
                    {Object.entries(
                      summaryLogs.reduce((map: Record<string, { name: string; sets: { reps?: number; weight?: number }[] }>, log: any) => {
                        const ex = (summaryExercises || []).find((e: any) => e.id === log.exercise_id);
                        const entry = map[log.exercise_id] || { name: ex?.name || 'Exercise', sets: [] };
                        entry.sets.push({ reps: log.reps ?? undefined, weight: log.weight_kg ?? undefined });
                        map[log.exercise_id] = entry;
                        return map;
                      }, {})
                    ).map(([exId, val]: any) => (
                      <div key={exId} className="bg-gray-50 rounded-lg p-2 text-sm">
                        <div className="font-medium text-gray-800">{val.name}</div>
                        <div className="text-gray-600">{val.sets.map((s: any, i: number) => `${s.reps || '-'}x${s.weight || 0}kg`).join(', ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">RPE: {rpe}</label>
                <input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(parseInt(e.target.value))} className="w-full" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} rows={3} className="w-full p-3 border border-gray-200 rounded-xl" placeholder="How did it go?" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <button onClick={() => { setShowSummary(false); setActiveSessionId(null); }} className="flex-1 py-2 px-4 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50">Return to Dashboard</button>
                <button
                  onClick={async () => {
                    const totalSec = sessionStartMs ? Math.floor((Date.now() - sessionStartMs) / 1000) : undefined;
                    await completeSession(activeSessionId, sessionNotes, rpe, totalSec);
                    await updateWorkout(showExerciseView?.id || (selectedWorkout?.id || ''), { status: 'completed' });
                    setShowSummary(false);
                    setActiveSessionId(null);
                    setLoggedSets([]);
                    setSummaryWorkoutId(null);
                    setSummaryLogs([]);
                  }}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                >
                  Log Workout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}