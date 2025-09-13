import { useEffect, useState } from 'react';
import { supabase, Database } from '../lib/supabase';

type Note = Database['public']['Tables']['coach_notes']['Row'];
type NoteInsert = Database['public']['Tables']['coach_notes']['Insert'];
type NoteUpdate = Database['public']['Tables']['coach_notes']['Update'];

export function useNotes(userId: string) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetchNotes();
  }, [userId]);

  const fetchNotes = async (opts?: { search?: string; from?: string; to?: string }) => {
    try {
      let q = supabase.from('coach_notes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (opts?.search) q = q.ilike('title', `%${opts.search}%`);
      // date range can be added later
      const { data, error } = await q;
      if (error) throw error;
      setNotes(data || []);
    } catch (e) {
      console.error('Error fetching notes', e);
    } finally {
      setLoading(false);
    }
  };

  const createNote = async (payload: Omit<NoteInsert, 'user_id'>) => {
    const { data, error } = await supabase.from('coach_notes').insert([{ ...payload, user_id: userId }]).select().single();
    if (!error) await fetchNotes();
    return { data, error } as const;
  };

  const updateNote = async (id: string, payload: NoteUpdate) => {
    const { data, error } = await supabase.from('coach_notes').update(payload).eq('id', id).select().single();
    if (!error) await fetchNotes();
    return { data, error } as const;
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from('coach_notes').delete().eq('id', id);
    if (!error) await fetchNotes();
    return { error } as const;
  };

  return { notes, loading, fetchNotes, createNote, updateNote, deleteNote };
}


