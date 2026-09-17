import React, { useState, useEffect } from 'react';
import {
  StickyNote,
  Plus,
  Trash2,
  RefreshCw,
  User,
  Calendar,
  Tag
} from 'lucide-react';
import { fetchNotes, createNote, deleteNote } from '../services/api';

export default function NotesView({ activeCase, graphData }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [targetEntityId, setTargetEntityId] = useState('');

  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await fetchNotes(activeCase?.case_id);
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [activeCase?.case_id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setLoading(true);
    try {
      await createNote(activeCase?.case_id, noteText.trim(), targetEntityId || null);
      setIsModalOpen(false);
      setNoteText('');
      setTargetEntityId('');
      await loadNotes();
    } catch (err) {
      alert('Failed to save note: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm('Delete this field note?')) return;
    setLoading(true);
    try {
      await deleteNote(activeCase?.case_id, noteId);
      await loadNotes();
    } catch (err) {
      alert('Failed to delete note: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <StickyNote className="w-6 h-6 text-amber-400" />
            <span>Investigative Field Notes</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Attach qualitative annotations, intelligence leads, and team observations to the case or specific targets.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadNotes}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Field Note</span>
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 font-mono text-xs">
            No notes logged for this case yet. Click "Add Field Note" to record observations.
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.note_id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>{note.note_id}</span>
                  {note.entity_id ? (
                    <span className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold">
                      Target: {note.entity_id}
                    </span>
                  ) : (
                    <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                      Case-Wide
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-200 mt-3 whitespace-pre-wrap leading-relaxed">
                  {note.note_text}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {note.created_by}
                </span>
                <button
                  onClick={() => handleDelete(note.note_id)}
                  className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                  title="Delete Note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Note Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-amber-400" />
              <span>Record Investigative Field Note</span>
            </h2>
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Attach to Target Entity (Optional)</label>
                <select
                  value={targetEntityId}
                  onChange={(e) => setTargetEntityId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- General Case-Wide Note --</option>
                  {(graphData.nodes || []).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Observation / Field Note</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Record surveillance sighting, tactical lead, informant claim, or hypothesis..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !noteText.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 cursor-pointer"
                >
                  Save Field Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
