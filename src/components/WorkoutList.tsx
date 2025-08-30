import React, { useState, useEffect } from 'react';
import { useWorkouts, useExercises } from '../hooks/useWorkouts';
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
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'completed'>('today');
  const [selectedWorkout, setSelectedWorkout] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkout, setNewWorkout] = useState({
    title: '',
    description: '',
    duration_minutes: 30,
    focus_area: '',
    scheduled_date: format(new Date(), 'yyyy-MM-dd'),
  });

  const { 
    workouts, 
    loading, 
    createWorkout, 
    updateWorkout, 
    deleteWorkout,
    getTodaysWorkout,
    getUpcomingWorkouts,
    getCompletedWorkouts 
  } = useWorkouts(user.id);

  const { exercises, createExercise, updateExercise } = useExercises(selectedWorkout?.id || '');

  const [newExercise, setNewExercise] = useState({
    name: '',
    sets: 3,
    reps: 10,
    weight_kg: 0,
  });

  const getFilteredWorkouts = () => {
    switch (activeTab) {
      case 'today':
        const todaysWorkout = getTodaysWorkout();
        return todaysWorkout ? [todaysWorkout] : [];
      case 'upcoming':
        return getUpcomingWorkouts();
      case 'completed':
        return getCompletedWorkouts();
      default:
        return [];
    }
  };

  const handleCreateWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await createWorkout(newWorkout);
    if (!error) {
      setShowCreateForm(false);
      setNewWorkout({
        title: '',
        description: '',
        duration_minutes: 30,
        focus_area: '',
        scheduled_date: format(new Date(), 'yyyy-MM-dd'),
      });
    }
  };

  const handleStartWorkout = async (workout: any) => {
    await updateWorkout(workout.id, { status: 'in_progress' });
    setSelectedWorkout(workout);
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
            { key: 'today', label: 'Today', count: getTodaysWorkout() ? 1 : 0 },
            { key: 'upcoming', label: 'Upcoming', count: getUpcomingWorkouts().length },
            { key: 'completed', label: 'Completed', count: getCompletedWorkouts().length },
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

        {/* Workout List */}
        <div className="space-y-4">
          {getFilteredWorkouts().map((workout) => (
            <div key={workout.id} className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{workout.title}</h3>
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
                    className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}