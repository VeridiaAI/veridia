import React, { useState, useEffect } from 'react';
import { useWorkouts } from '../hooks/useWorkouts';
import { useStats } from '../hooks/useStats';
import { format } from 'date-fns';
import { 
  Play, 
  TrendingUp, 
  Calendar, 
  Zap, 
  Weight,
  Smile,
  Plus
} from 'lucide-react';

interface DashboardProps {
  user: any;
  onNavigate: (screen: string) => void;
}

export function Dashboard({ user, onNavigate }: DashboardProps) {
  const { getTodaysWorkout, getWeeklyWorkouts } = useWorkouts(user.id);
  const { logStat, getCurrentStreak, getWeeklyWorkouts: getWeeklyWorkoutCount } = useStats(user.id);
  
  const [todaysWorkout, setTodaysWorkout] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(0);
  const [showQuickLog, setShowQuickLog] = useState<'weight' | 'mood' | null>(null);
  const [weight, setWeight] = useState('');
  const [mood, setMood] = useState(5);

  useEffect(() => {
    const loadDashboardData = async () => {
      setTodaysWorkout(getTodaysWorkout());
      setStreak(await getCurrentStreak());
      setWeeklyWorkouts(await getWeeklyWorkoutCount());
    };

    loadDashboardData();
  }, [user.id]);

  const handleQuickLog = async (type: 'weight' | 'mood') => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    if (type === 'weight' && weight) {
      await logStat(today, parseFloat(weight), undefined);
      setWeight('');
    } else if (type === 'mood') {
      await logStat(today, undefined, mood);
    }
    
    setShowQuickLog(null);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {getGreeting()}, {user.user_metadata?.full_name?.split(' ')[0] || 'Champion'}! 💪
          </h1>
          <p className="text-gray-600 mt-2">Ready to crush your fitness goals today?</p>
        </div>

        {/* Today's Workout Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Today's Workout</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onNavigate('workouts')}
                className="text-sm text-blue-600 hover:underline"
              >
                View Full Plan
              </button>
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          
          {todaysWorkout ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{todaysWorkout.title}</h3>
                <p className="text-gray-600">{todaysWorkout.description}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span>🕒 {todaysWorkout.duration_minutes} min</span>
                  <span>🎯 {todaysWorkout.focus_area}</span>
                </div>
              </div>
              
              <button
                onClick={() => onNavigate('workouts')}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Start Today's Workout
              </button>
              <button
                onClick={() => onNavigate('workouts')}
                className="w-full text-blue-600 hover:underline text-sm mt-2"
              >
                View Full Plan
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No workout scheduled for today</p>
              <button
                onClick={() => onNavigate('workouts')}
                className="bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Schedule Workout
              </button>
              <button
                onClick={() => onNavigate('workouts')}
                className="block mx-auto text-blue-600 hover:underline text-sm mt-3"
              >
                View Full Plan
              </button>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Current Streak</h3>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-green-600">{streak}</div>
            <p className="text-gray-600 text-sm">consecutive days</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">This Week</h3>
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-3xl font-bold text-orange-600">{weeklyWorkouts}</div>
            <p className="text-gray-600 text-sm">workouts completed</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setShowQuickLog('weight')}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Weight className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-gray-700">Log Weight</span>
            </button>
            
            <button
              onClick={() => setShowQuickLog('mood')}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Smile className="w-5 h-5 text-green-600" />
              <span className="font-medium text-gray-700">Log Mood & Energy</span>
            </button>

            <button
              onClick={() => onNavigate('workouts')}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-gray-700">Create Workout</span>
            </button>
          </div>
        </div>

        {/* Quick Log Modals */}
        {showQuickLog === 'weight' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-semibold mb-4">Log Weight</h3>
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Weight (kg)"
                className="w-full p-3 border border-gray-200 rounded-xl mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowQuickLog(null)}
                  className="flex-1 py-2 px-4 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleQuickLog('weight')}
                  disabled={!weight}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {showQuickLog === 'mood' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-semibold mb-4">Log Mood & Energy</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Energy Level: {mood}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={mood}
                  onChange={(e) => setMood(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowQuickLog(null)}
                  className="flex-1 py-2 px-4 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleQuickLog('mood')}
                  className="flex-1 py-2 px-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}