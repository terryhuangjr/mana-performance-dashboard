import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Task {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
}

interface Props {
  task: Task;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditTaskModal({ task, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || '');
  const [dueDate, setDueDate] = useState(task.due_date || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(task.priority);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);

    const { error } = await supabase
      .from('mana_tasks')
      .update({
        title: title.trim(),
        notes: notes.trim() || null,
        due_date: dueDate || null,
        priority,
      })
      .eq('id', task.id);

    setSaving(false);
    if (error) {
      console.error('Failed to update:', error);
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Edit Task</h3>

        <div className="form-group">
          <label>Title</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        </div>

        <div className="form-group">
          <label>Notes</label>
          <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
        </div>

        <div className="form-group">
          <label>Due Date</label>
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
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
