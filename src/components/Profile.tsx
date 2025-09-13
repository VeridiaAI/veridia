import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export function ProfileScreen({ user, onNavigate }: { user: any; onNavigate: (screen: string) => void }) {
  const { changePassword, signOut } = useAuth();
  const [pwd, setPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [fullName, setFullName] = useState(user.user_metadata?.full_name || '');
  const [goal, setGoal] = useState<'lose_weight' | 'build_muscle' | 'endurance' | 'general_health'>('general_health');

  // Load current goal from onboarding
  useState(() => {
    (async () => {
      setLoadingProfile(true);
      try {
        const { data } = await supabase.from('profiles').select('full_name,onboarding').eq('id', user.id).single();
        if (data?.full_name) setFullName(data.full_name);
        const g = (data as any)?.onboarding?.goal;
        if (g) setGoal(g);
      } catch {}
      setLoadingProfile(false);
    })();
  });

  const exportData = async () => {
    const payload: any = {};
    const tables = ['profiles','workouts','exercises','workout_sessions','set_logs','user_stats','coach_notes'];
    for (const t of tables) {
      try {
        let data: any = [];
        if (t === 'profiles') {
          const res = await supabase.from(t as any).select('*').eq('id', user.id);
          data = res.data || [];
        } else {
          const res = await supabase.from(t as any).select('*').eq('user_id', user.id);
          data = res.data || [];
        }
        (payload as any)[t] = data;
      } catch {
        (payload as any)[t] = [];
      }
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'veridia-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile</h2>
          <div className="mb-6">
            <div className="text-sm text-gray-600">Email</div>
            <div className="text-gray-900 font-medium">{user.email}</div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Personal Details & Goals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Full Name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="w-full p-3 border border-gray-200 rounded-xl" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Main Goal</label>
                <select value={goal} onChange={(e) => setGoal(e.target.value as any)} className="w-full p-3 border border-gray-200 rounded-xl">
                  <option value="lose_weight">Lose Weight</option>
                  <option value="build_muscle">Build Muscle</option>
                  <option value="endurance">Improve Endurance</option>
                  <option value="general_health">General Health</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                disabled={loadingProfile}
                onClick={async () => {
                  setProfileMsg('');
                  setLoadingProfile(true);
                  try {
                    // Fetch existing onboarding to merge
                    const { data } = await supabase.from('profiles').select('onboarding').eq('id', user.id).single();
                    const onboarding = { ...(data?.onboarding || {}), goal };
                    await supabase.from('profiles').update({ full_name: fullName || null, onboarding }).eq('id', user.id);
                    setProfileMsg('Saved');
                  } catch (e: any) {
                    setProfileMsg('Failed to save');
                  } finally {
                    setLoadingProfile(false);
                  }
                }}
                className="py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60"
              >
                Save
              </button>
              {profileMsg && <div className="text-sm text-gray-600 self-center">{profileMsg}</div>}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Change Password</h3>
            <div className="flex gap-2">
              <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="New password" className="flex-1 p-3 border border-gray-200 rounded-xl" />
              <button onClick={async () => { const { error } = await changePassword(pwd); setPwdMsg(error ? error.message : 'Password updated'); setPwd(''); }} className="py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700">Update</button>
            </div>
            {pwdMsg && <div className="text-sm text-gray-600 mt-2">{pwdMsg}</div>}
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Data</h3>
            <div className="flex gap-2">
              <button onClick={exportData} className="py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700">Export JSON</button>
              <label className="py-2 px-4 border border-gray-200 rounded-xl text-gray-700 cursor-pointer">
                Import JSON
                <input type="file" accept="application/json" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  try {
                    const parsed = JSON.parse(text);
                    // basic import for coach_notes only for safety in MVP
                    if (Array.isArray(parsed.coach_notes)) {
                      for (const n of parsed.coach_notes) {
                        await supabase.from('coach_notes').insert([{ user_id: user.id, title: n.title || 'Imported', content: n.content || '', mood: n.mood || null, energy: n.energy || null }]);
                      }
                    }
                    alert('Import completed');
                  } catch {
                    alert('Invalid JSON');
                  }
                }} />
              </label>
              <button onClick={() => onNavigate('data')} className="py-2 px-4 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50">Open Data Export/Import</button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={async () => { await signOut(); }} className="py-2 px-4 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50">Log Out</button>
            <div className="text-sm text-gray-500">More settings coming soon.</div>
          </div>
        </div>
      </div>
    </div>
  );
}


