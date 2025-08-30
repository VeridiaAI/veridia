import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

type OnboardingFlowProps = {
  user: any;
  onComplete: () => void;
};

type OnboardingData = {
  goal?: 'lose_weight' | 'build_muscle' | 'endurance' | 'general_health';
  age?: number;
  gender?: 'prefer_not' | 'male' | 'female' | 'other';
  height?: { unit: 'cm' | 'ftin'; value: string };
  weight?: { unit: 'kg' | 'lb'; value: string };
  fitness_level?: 'beginner' | 'intermediate' | 'advanced';
  medical?: { issues: string[]; notes?: string };
  preferences?: { activities: string[]; equipment: 'home_none' | 'home_light' | 'full_gym' | 'outdoor' };
  diet?: { tags: string[]; allergies?: string };
  lifestyle?: { days_per_week?: number; minutes_per_session?: number; stress?: number; sleep?: number };
};

const goalOptions = [
  { key: 'lose_weight', label: 'Lose Weight', desc: 'Reduce body fat and slim down' },
  { key: 'build_muscle', label: 'Build Muscle', desc: 'Gain strength and size' },
  { key: 'endurance', label: 'Improve Endurance', desc: 'Boost cardiovascular fitness' },
  { key: 'general_health', label: 'General Health', desc: 'Feel better and move more' },
] as const;

export function OnboardingFlow({ user, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(2); // Start at Screen 2 per spec
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({});
  const [showConfirm, setShowConfirm] = useState(false);

  const next = () => setStep((s) => Math.min(9, s + 1));
  const back = () => setStep((s) => Math.max(2, s - 1));

  const saveAndComplete = async () => {
    try {
      setSaving(true);
      await supabase.from('profiles').update({ onboarding: data as any, onboarding_complete: true, updated_at: new Date().toISOString() }).eq('id', user.id);
      try { sessionStorage.setItem('veridia_onboarding_summary', JSON.stringify(data)); } catch {}
      setShowConfirm(true);
    } catch (e) {
      // soft fail
      try { sessionStorage.setItem('veridia_onboarding_summary', JSON.stringify(data)); } catch {}
      setShowConfirm(true);
    } finally {
      setSaving(false);
    }
  };

  // step 9 is rendered within the main return so the confirmation modal can appear on top

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {showConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                <h3 className="text-xl font-semibold mb-3">You're all set!</h3>
                <p className="text-gray-600 mb-4">Here’s a quick summary of your choices:</p>
                <div className="text-sm text-gray-700 space-y-1 mb-6">
                  <div><span className="font-medium">Goal:</span> {data.goal}</div>
                  <div><span className="font-medium">Age/Gender:</span> {data.age} / {data.gender}</div>
                  <div><span className="font-medium">Height/Weight:</span> {data.height?.value} {data.height?.unit} / {data.weight?.value} {data.weight?.unit}</div>
                  <div><span className="font-medium">Level:</span> {data.fitness_level}</div>
                  <div><span className="font-medium">Medical:</span> {(data.medical?.issues || []).join(', ') || 'None'}</div>
                  <div><span className="font-medium">Activities:</span> {(data.preferences?.activities || []).join(', ') || '—'}</div>
                  <div><span className="font-medium">Equipment:</span> {data.preferences?.equipment}</div>
                  <div><span className="font-medium">Diet:</span> {(data.diet?.tags || []).join(', ') || '—'}</div>
                  <div><span className="font-medium">Allergies:</span> {data.diet?.allergies || '—'}</div>
                  <div><span className="font-medium">Availability:</span> {data.lifestyle?.days_per_week} days, {data.lifestyle?.minutes_per_session} min</div>
                </div>
                <button
                  onClick={() => { setShowConfirm(false); onComplete(); }}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                >
                  Continue to Dashboard
                </button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">What's Your Main Fitness Goal?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {goalOptions.map((opt) => {
                  const selected = data.goal === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setData((d) => ({ ...d, goal: opt.key }))}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-lg font-semibold">{opt.label}</div>
                      <div className="text-sm text-gray-600">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={back} className="px-4 py-2 rounded-lg border border-gray-200">Back</button>
                <button
                  onClick={next}
                  disabled={!data.goal}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Tell Us a Bit About Yourself</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={data.age ?? ''}
                    onChange={(e) => setData((d) => ({ ...d, age: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full p-3 border border-gray-200 rounded-xl"
                    placeholder="e.g., 28"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'prefer_not', label: 'Prefer not to say' },
                      { key: 'male', label: 'Male' },
                      { key: 'female', label: 'Female' },
                      { key: 'other', label: 'Other' },
                    ].map((g: any) => (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() => setData((d) => ({ ...d, gender: g.key }))}
                        className={`p-3 rounded-xl border text-sm ${
                          data.gender === g.key ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Height</label>
                  <div className="flex gap-2">
                    <select
                      value={data.height?.unit ?? 'cm'}
                      onChange={(e) => setData((d) => ({ ...d, height: { unit: e.target.value as any, value: d.height?.value ?? '' } }))}
                      className="p-3 border border-gray-200 rounded-xl"
                    >
                      <option value="cm">cm</option>
                      <option value="ftin">ft'in"</option>
                    </select>
                    <input
                      type="text"
                      value={data.height?.value ?? ''}
                      onChange={(e) => setData((d) => ({ ...d, height: { unit: d.height?.unit ?? 'cm', value: e.target.value } }))}
                      className="flex-1 p-3 border border-gray-200 rounded-xl"
                      placeholder={data.height?.unit === 'ftin' ? `e.g., 5'11"` : 'e.g., 180'}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Weight</label>
                  <div className="flex gap-2">
                    <select
                      value={data.weight?.unit ?? 'kg'}
                      onChange={(e) => setData((d) => ({ ...d, weight: { unit: e.target.value as any, value: d.weight?.value ?? '' } }))}
                      className="p-3 border border-gray-200 rounded-xl"
                    >
                      <option value="kg">kg</option>
                      <option value="lb">lb</option>
                    </select>
                    <input
                      type="number"
                      min={20}
                      max={400}
                      step="0.1"
                      value={data.weight?.value ?? ''}
                      onChange={(e) => setData((d) => ({ ...d, weight: { unit: d.weight?.unit ?? 'kg', value: e.target.value } }))}
                      className="flex-1 p-3 border border-gray-200 rounded-xl"
                      placeholder="e.g., 75"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={back} className="px-4 py-2 rounded-lg border border-gray-200">Back</button>
                <button
                  onClick={next}
                  disabled={!data.age || !data.gender || !data.height?.value || !data.weight?.value}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">What's Your Current Fitness Level?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                  { key: 'beginner', label: 'Beginner', desc: 'Just starting out' },
                  { key: 'intermediate', label: 'Intermediate', desc: 'Active occasionally' },
                  { key: 'advanced', label: 'Advanced', desc: 'Consistent training' },
                ].map((lvl: any) => (
                  <button
                    key={lvl.key}
                    onClick={() => setData((d) => ({ ...d, fitness_level: lvl.key }))}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      data.fitness_level === lvl.key ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-lg font-semibold">{lvl.label}</div>
                    <div className="text-sm text-gray-600">{lvl.desc}</div>
                  </button>
                ))}
              </div>
              <div className="mb-6">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm"
                  onClick={() => alert('Quick test coming soon!')}
                >
                  Take a 5-Min Fitness Test
                </button>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={back} className="px-4 py-2 rounded-lg border border-gray-200">Back</button>
                <button
                  onClick={next}
                  disabled={!data.fitness_level}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Any Medical Conditions or Past Injuries?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {['Back Pain', 'Knee Issues', 'Shoulder Injury', 'Heart Condition', 'Diabetes'].map((issue) => {
                  const selected = data.medical?.issues?.includes(issue) ?? false;
                  return (
                    <button
                      key={issue}
                      type="button"
                      onClick={() =>
                        setData((d) => {
                          const current = new Set(d.medical?.issues ?? []);
                          if (current.has(issue)) current.delete(issue); else current.add(issue);
                          return { ...d, medical: { issues: Array.from(current), notes: d.medical?.notes } };
                        })
                      }
                      className={`p-3 rounded-xl border text-left ${selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      {issue}
                    </button>
                  );
                })}
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Other relevant conditions or limitations</label>
                <textarea
                  rows={4}
                  value={data.medical?.notes ?? ''}
                  onChange={(e) => setData((d) => ({ ...d, medical: { issues: d.medical?.issues ?? [], notes: e.target.value } }))}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                  placeholder="Optional"
                />
                <p className="text-xs text-gray-500 mt-2">Always consult your doctor for serious medical conditions.</p>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={back} className="px-4 py-2 rounded-lg border border-gray-200">Back</button>
                <button onClick={next} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Next</button>
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">How Do You Like to Train?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {['Weightlifting', 'Cardio', 'Yoga', 'Pilates', 'Bodyweight', 'Running', 'Cycling', 'Swimming'].map((act) => {
                  const selected = data.preferences?.activities?.includes(act) ?? false;
                  return (
                    <button
                      key={act}
                      type="button"
                      onClick={() =>
                        setData((d) => {
                          const current = new Set(d.preferences?.activities ?? []);
                          if (current.has(act)) current.delete(act); else current.add(act);
                          return { ...d, preferences: { activities: Array.from(current), equipment: d.preferences?.equipment } };
                        })
                      }
                      className={`p-3 rounded-xl border text-left text-sm ${selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      {act}
                    </button>
                  );
                })}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">What Equipment Do You Have Access To?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {[
                  { key: 'home_none', label: 'Home (No Equipment)' },
                  { key: 'home_light', label: 'Home (Dumbbells/Bands)' },
                  { key: 'full_gym', label: 'Full Gym Access' },
                  { key: 'outdoor', label: 'Outdoor Space Only' },
                ].map((e: any) => (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() => setData((d) => ({ ...d, preferences: { activities: d.preferences?.activities ?? [], equipment: e.key } }))}
                    className={`p-3 rounded-xl border text-left ${
                      data.preferences?.equipment === e.key ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={back} className="px-4 py-2 rounded-lg border border-gray-200">Back</button>
                <button
                  onClick={next}
                  disabled={!data.preferences?.equipment}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 7 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Any Dietary Preferences or Restrictions?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo'].map((tag) => {
                  const selected = data.diet?.tags?.includes(tag) ?? false;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setData((d) => {
                          const current = new Set(d.diet?.tags ?? []);
                          if (current.has(tag)) current.delete(tag); else current.add(tag);
                          return { ...d, diet: { tags: Array.from(current), allergies: d.diet?.alergies ?? d.diet?.allergies } as any };
                        })
                      }
                      className={`p-3 rounded-xl border text-left text-sm ${selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Allergies (optional)</label>
                <input
                  type="text"
                  value={data.diet?.allergies ?? ''}
                  onChange={(e) => setData((d) => ({ ...d, diet: { tags: d.diet?.tags ?? [], allergies: e.target.value } }))}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                  placeholder="e.g., peanuts, shellfish"
                />
              </div>
              <div className="flex items-center justify-between">
                <button onClick={back} className="px-4 py-2 rounded-lg border border-gray-200">Back</button>
                <button onClick={next} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Next</button>
              </div>
            </div>
          )}

          {step === 8 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Availability & Lifestyle</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Days per week</label>
                  <select
                    value={data.lifestyle?.days_per_week ?? ''}
                    onChange={(e) => setData((d) => ({ ...d, lifestyle: { ...d.lifestyle, days_per_week: e.target.value ? Number(e.target.value) : undefined } }))}
                    className="w-full p-3 border border-gray-200 rounded-xl"
                  >
                    <option value="">Select</option>
                    {[1,2,3,4,5,6,7].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Minutes per session</label>
                  <select
                    value={data.lifestyle?.minutes_per_session ?? ''}
                    onChange={(e) => setData((d) => ({ ...d, lifestyle: { ...d.lifestyle, minutes_per_session: e.target.value ? Number(e.target.value) : undefined } }))}
                    className="w-full p-3 border border-gray-200 rounded-xl"
                  >
                    <option value="">Select</option>
                    {[20,30,40,45,50,60,75,90].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stress level (1-5)</label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={data.lifestyle?.stress ?? 3}
                    onChange={(e) => setData((d) => ({ ...d, lifestyle: { ...d.lifestyle, stress: Number(e.target.value) } }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sleep quality (1-5)</label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={data.lifestyle?.sleep ?? 3}
                    onChange={(e) => setData((d) => ({ ...d, lifestyle: { ...d.lifestyle, sleep: Number(e.target.value) } }))}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={back} className="px-4 py-2 rounded-lg border border-gray-200">Back</button>
                <button
                  onClick={next}
                  disabled={!data.lifestyle?.days_per_week || !data.lifestyle?.minutes_per_session}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                >
                  Finish Assessment & Generate Plan
                </button>
              </div>
            </div>
          )}

          {step === 9 && (
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold mb-4">Crafting Your Truly Individualized Plan...</h2>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 mb-6">Leveraging scientific data and your unique profile.</p>
              <button
                onClick={saveAndComplete}
                disabled={saving}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Finalizing...' : 'Continue to Dashboard'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


