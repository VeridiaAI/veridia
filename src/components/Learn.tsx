import { useEffect, useMemo, useState } from 'react';

type LearnItem = {
  id: string;
  type: 'article' | 'video';
  category: string;
  title: string;
  description: string;
  source: string;
  author?: string;
  content?: string;
};

export function LearnScreen() {
  const STORAGE_KEY = 'veridia_learn_state';
  const [items, setItems] = useState<LearnItem[]>([]);
  const [search, setSearch] = useState<string>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return (JSON.parse(raw).search as string) || '';
    } catch {}
    return '';
  });
  const [category, setCategory] = useState<string>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return (JSON.parse(raw).category as string) || 'All';
    } catch {}
    return 'All';
  });
  const [selected, setSelected] = useState<LearnItem | null>(null);

  useEffect(() => {
    import('../content/learn.json').then((m) => setItems(m.default as any));
  }, []);

  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map(i => i.category)))], [items]);

  const filtered = items.filter(i => (
    (category === 'All' || i.category === category) &&
    (i.title.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()))
  ));

  // persist state
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ search, category })); } catch {}
  }, [search, category]);

  // ensure restored category is valid once items load
  useEffect(() => {
    if (!categories.includes(category)) setCategory('All');
  }, [categories.join('|')]);

  if (selected) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <button onClick={() => setSelected(null)} className="text-sm text-blue-600 hover:underline mb-4">← Back</button>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{selected.title}</h2>
            <div className="text-xs text-gray-500 mb-4">{selected.category} • {selected.source}{selected.author ? ` • ${selected.author}` : ''}</div>
            <div className="prose max-w-none text-gray-800 whitespace-pre-wrap">{selected.content || selected.description}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Learn</h2>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="flex-1 p-3 border border-gray-200 rounded-xl" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="p-3 border border-gray-200 rounded-xl">
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {/* Featured Content */}
          {filtered.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-blue-700 mb-1">Featured</div>
                  <h3 className="text-xl font-semibold text-gray-900">{filtered[0].title}</h3>
                  <p className="text-gray-600 mt-1">{filtered[0].description}</p>
                  <div className="text-xs text-gray-500 mt-2">{filtered[0].category} • {filtered[0].source}</div>
                </div>
                <button
                  onClick={() => setSelected(filtered[0])}
                  className="shrink-0 py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                >
                  Read
                </button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {filtered.map(it => (
              <button onClick={() => setSelected(it)} key={it.id} id={`learn-item-${it.id}`} className="p-4 bg-gray-50 rounded-xl text-left w-full hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{it.title}</h3>
                    <p className="text-gray-600 text-sm">{it.description}</p>
                  </div>
                  <span className="text-xs text-gray-500">{it.category}</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-gray-500">No content found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


