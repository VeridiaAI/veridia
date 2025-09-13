import { useEffect, useMemo, useState } from 'react';
import { useStats } from '../hooks/useStats';
import { supabase } from '../lib/supabase';

export function ProgressScreen({ user }: { user: any }) {
  const { getCurrentStreak } = useStats(user.id);
  const [activeTab, setActiveTab] = useState<'overview' | 'strength' | 'cardio' | 'body' | 'well'>('overview');
  const [streak, setStreak] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [avgDuration, setAvgDuration] = useState(0);
  const [weights, setWeights] = useState<any[]>([]);
  const [strengthRows, setStrengthRows] = useState<{ exercise: string; volume: number }[]>([]);

  useEffect(() => {
    (async () => {
      setStreak(await getCurrentStreak());
      const { data: w } = await supabase.from('workouts').select('duration_minutes,status').eq('user_id', user.id);
      const completed = (w || []).filter((x) => x.status === 'completed');
      setTotalWorkouts(completed.length);
      setAvgDuration(Math.round((completed.reduce((a, b) => a + (b.duration_minutes || 0), 0) / (completed.length || 1))));

      const { data: stats } = await supabase.from('user_stats').select('*').eq('user_id', user.id).order('date', { ascending: false });
      setWeights((stats || []).filter((s) => s.weight_kg !== null));

      const { data: setLogs } = await supabase.from('set_logs').select('exercise_id,reps,weight_kg');
      const { data: exs } = await supabase.from('exercises').select('id,name');
      const idToName = new Map((exs || []).map((e) => [e.id, e.name]));
      const volumeByExercise = new Map<string, number>();
      (setLogs || []).forEach((l) => {
        const key = idToName.get(l.exercise_id || '') || 'Exercise';
        const vol = (l.reps || 0) * (Number(l.weight_kg) || 0);
        volumeByExercise.set(key, (volumeByExercise.get(key) || 0) + vol);
      });
      setStrengthRows(Array.from(volumeByExercise.entries()).map(([exercise, volume]) => ({ exercise, volume: Math.round(volume) })));
    })();
  }, [user.id]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Progress</h2>
          <div className="flex space-x-1 bg-gray-100 rounded-xl p-1 mb-6">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'strength', label: 'Strength' },
              { key: 'cardio', label: 'Cardio' },
              { key: 'body', label: 'Body Metrics' },
              { key: 'well', label: 'Well-being' },
            ].map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key as any)} className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${activeTab === t.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>{t.label}</button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm text-gray-600">Total Workouts</div>
                <div className="text-3xl font-bold text-gray-900">{totalWorkouts}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm text-gray-600">Avg. Duration</div>
                <div className="text-3xl font-bold text-gray-900">{avgDuration} min</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm text-gray-600">Current Streak</div>
                <div className="text-3xl font-bold text-gray-900">{streak}</div>
              </div>
            </div>
          )}

          {activeTab === 'cardio' && (
            <div className="text-gray-600 text-sm">Cardio tables coming soon.</div>
          )}

          {activeTab === 'strength' && (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-600">
                    <th className="py-2">Exercise</th>
                    <th className="py-2">Total Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {strengthRows.length === 0 && (
                    <tr><td colSpan={2} className="py-4 text-gray-500">No strength data yet</td></tr>
                  )}
                  {strengthRows.map((r) => (
                    <tr key={r.exercise} className="border-t border-gray-100">
                      <td className="py-2">{r.exercise}</td>
                      <td className="py-2">{r.volume}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'body' && (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-600"><th className="py-2">Date</th><th className="py-2">Weight (kg)</th></tr>
                </thead>
                <tbody>
                  {weights.length === 0 && (<tr><td colSpan={2} className="py-4 text-gray-500">No entries yet</td></tr>)}
                  {weights.map((w) => (<tr key={w.id} className="border-top border-gray-100"><td className="py-2">{w.date}</td><td className="py-2">{w.weight_kg}</td></tr>))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'well' && (
            <div className="text-gray-600 text-sm">Coming soon: sleep/stress tables.</div>
          )}

          <div className="mt-6">
            <button
              onClick={async () => {
                const payload: any = {};
                const tables = ['profiles','workouts','exercises','workout_sessions','set_logs','user_stats'];
                for (const t of tables) {
                  const { data } = await supabase.from(t as any).select('*').eq('user_id', user.id).catch(() => ({ data: [] } as any));
                  (payload as any)[t] = data || [];
                }
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'veridia-export.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              Export Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


