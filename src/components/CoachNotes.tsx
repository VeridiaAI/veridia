import { useState } from 'react';
import { useNotes } from '../hooks/useNotes';

export function CoachNotes({ user }: { user: any }) {
  const { notes, loading, fetchNotes, createNote, updateNote, deleteNote } = useNotes(user.id);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', content: '', mood: 3, energy: 3 });
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Coach Notes</h2>
            <div className="flex gap-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes..." className="p-2 border border-gray-200 rounded-xl" />
              <button onClick={() => fetchNotes({ search })} className="py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700">Filter</button>
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (editingId) {
                await updateNote(editingId, { title: form.title, content: form.content, mood: form.mood, energy: form.energy });
                setEditingId(null);
              } else {
                await createNote({ title: form.title, content: form.content, mood: form.mood, energy: form.energy });
              }
              setForm({ title: '', content: '', mood: 3, energy: 3 });
            }}
            className="bg-gray-50 p-4 rounded-xl mb-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="p-3 border border-gray-200 rounded-xl" required />
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Mood {form.mood}</label>
                <input type="range" min={1} max={5} value={form.mood} onChange={(e) => setForm({ ...form, mood: parseInt(e.target.value) })} />
                <label className="text-sm text-gray-600">Energy {form.energy}</label>
                <input type="range" min={1} max={5} value={form.energy} onChange={(e) => setForm({ ...form, energy: parseInt(e.target.value) })} />
              </div>
            </div>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Content" rows={3} className="w-full mt-3 p-3 border border-gray-200 rounded-xl" />
            <div className="flex gap-3 mt-3">
              <button type="submit" className="py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700">{editingId ? 'Update' : 'Save Note'}</button>
              {editingId && (
                <button type="button" onClick={() => { setEditingId(null); setForm({ title: '', content: '', mood: 3, energy: 3 }); }} className="py-2 px-4 border border-gray-200 rounded-xl text-gray-700">Cancel</button>
              )}
            </div>
          </form>

          <div className="space-y-3">
            {notes.map((n) => (
              <div key={n.id} className="p-4 bg-gray-50 rounded-xl flex items-start justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{n.title}</div>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap">{n.content}</div>
                  <div className="text-xs text-gray-500 mt-1">Mood {n.mood ?? '-'} • Energy {n.energy ?? '-'}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingId(n.id); setForm({ title: n.title, content: n.content || '', mood: n.mood || 3, energy: n.energy || 3 }); }} className="py-1 px-3 border border-gray-200 rounded-lg text-gray-700">Edit</button>
                  <button onClick={() => deleteNote(n.id)} className="py-1 px-3 border border-red-200 text-red-600 rounded-lg">Delete</button>
                </div>
              </div>
            ))}
            {notes.length === 0 && <div className="text-gray-500">No notes found</div>}
          </div>
        </div>
      </div>
    </div>
  );
}


