import { supabase } from '../lib/supabase';

export function DataExportImport({ user }: { user: any }) {
  const exportAll = async () => {
    const payload: any = {};
    // Export profile
    const { data: profile } = await supabase.from('profiles' as any).select('*').eq('id', user.id).single().catch(() => ({ data: null } as any));
    payload.profiles = profile ? [profile] : [];

    // Export workouts for user
    const { data: workouts } = await supabase.from('workouts' as any).select('*').eq('user_id', user.id).catch(() => ({ data: [] } as any));
    payload.workouts = workouts || [];

    // Export exercises linked to those workouts
    const workoutIds = (workouts || []).map((w: any) => w.id);
    if (workoutIds.length > 0) {
      const { data: exercises } = await supabase.from('exercises' as any).select('*').in('workout_id', workoutIds).catch(() => ({ data: [] } as any));
      payload.exercises = exercises || [];
    } else {
      payload.exercises = [];
    }

    // Export sessions and set logs for this user
    const { data: sessions } = await supabase.from('workout_sessions' as any).select('*').eq('user_id', user.id).catch(() => ({ data: [] } as any));
    payload.workout_sessions = sessions || [];
    const sessionIds = (sessions || []).map((s: any) => s.id);
    if (sessionIds.length > 0) {
      const { data: setLogs } = await supabase.from('set_logs' as any).select('*').in('session_id', sessionIds).catch(() => ({ data: [] } as any));
      payload.set_logs = setLogs || [];
    } else {
      payload.set_logs = [];
    }

    // Other tables with user_id
    const { data: stats } = await supabase.from('user_stats' as any).select('*').eq('user_id', user.id).catch(() => ({ data: [] } as any));
    payload.user_stats = stats || [];
    const { data: notes } = await supabase.from('coach_notes' as any).select('*').eq('user_id', user.id).catch(() => ({ data: [] } as any));
    payload.coach_notes = notes || [];

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'veridia-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importNotes = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.coach_notes)) {
      for (const n of parsed.coach_notes) {
        await supabase.from('coach_notes').insert([{ user_id: user.id, title: n.title || 'Imported', content: n.content || '', mood: n.mood || null, energy: n.energy || null }]).catch(() => null);
      }
    }
    alert('Import completed');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Export/Import</h2>
          <p className="text-gray-600 mb-4">This is a local feature; no third-party integrations.</p>
          <div className="flex gap-3 mb-4">
            <button onClick={exportAll} className="py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700">Export JSON</button>
            <label className="py-2 px-4 border border-gray-200 rounded-xl text-gray-700 cursor-pointer">
              Import JSON
              <input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importNotes(f); }} />
            </label>
          </div>
          <div className="text-sm text-gray-500">Currently supports notes import; other tables coming soon.</div>
        </div>
      </div>
    </div>
  );
}


