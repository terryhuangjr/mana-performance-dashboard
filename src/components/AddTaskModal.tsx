import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function AddTaskModal({ onClose, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);

    const { error } = await supabase
      .from('mana_tasks')
      .insert({ title: title.trim(), notes: notes.trim() || null, due_date: dueDate || null, priority });

    setSaving(false);
    if (error) {
      console.error('Failed to save task:', error);
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>+ Add Task</h3>

        <div className="form-group">
          <label>Title</label>
          <input className="input" placeholder="What needs to be done?" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        </div>

        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea className="input" placeholder="Any details..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="form-group">
          <label>Due Date (optional)</label>
          <input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>

        <div className="form-group">
          <label>Priority</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['low', 'medium', 'high'] as const).map(p => (
              <button key={p} className={`btn btn-sm ${priority === p ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPriority(p)} style={{ flex: 1 }}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? 'Saving...' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
