import { useState } from 'react';
import { SquatAnalyzer } from './SquatAnalyzer';
import { LungeAnalyzer } from './LungeAnalyzer';
import { DeadliftAnalyzer } from './DeadliftAnalyzer';
import { PlankAnalyzer } from './PlankAnalyzer';
import { PushupAnalyzer } from './PushupAnalyzer';

type TabKey = 'squat' | 'lunge' | 'deadlift' | 'plank' | 'pushup';

export function Analyzer() {
  const [tab, setTab] = useState<TabKey>('squat');

  const TabButton = ({ k, label }: { k: TabKey; label: string }) => (
    <button
      onClick={() => setTab(k)}
      className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
        tab === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-2 mb-4">
          <TabButton k="squat" label="Squat" />
          <TabButton k="lunge" label="Lunge" />
          <TabButton k="deadlift" label="Deadlift" />
          <TabButton k="plank" label="Plank" />
          <TabButton k="pushup" label="Push-up" />
        </div>
      </div>
      {tab === 'squat' && <SquatAnalyzer />}
      {tab === 'lunge' && <LungeAnalyzer />}
      {tab === 'deadlift' && <DeadliftAnalyzer />}
      {tab === 'plank' && <PlankAnalyzer />}
      {tab === 'pushup' && <PushupAnalyzer />}
    </div>
  );
}

export default Analyzer;


