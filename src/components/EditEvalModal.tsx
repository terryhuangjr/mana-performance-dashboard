import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Entry {
  id: string;
  first_name: string;
  last_initial: string;
  eval_date: string;
  contacted: boolean;
  converted: boolean | null;
  program: string | null;
  notes: string | null;
  needs_followup: boolean;
}

interface Props {
  entry: Entry;
  onClose: () => void;
  onSaved: () => void;
}

const PROGRAMS = ['MANA 6','MANA 10','MANA 20','BK Weekly','BK Bi-Weekly','BK Monthly','NAHL Weekly','NAHL Bi-Weekly','NAHL Monthly','Cobblestone'];

export default function EditEvalModal({ entry, onClose, onSaved }: Props) {
  const [firstName, setFirstName] = useState(entry.first_name);
  const [lastInitial, setLastInitial] = useState(entry.last_initial);
  const [notes, setNotes] = useState(entry.notes || '');
  const [program, setProgram] = useState(entry.program || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!firstName.trim() || !lastInitial.trim()) return;
    setSaving(true);

    const { error } = await supabase
      .from('mana_pipeline')
      .update({
        first_name: firstName.trim(),
        last_initial: lastInitial.trim().charAt(0).toUpperCase(),
        notes: notes.trim() || null,
        program: program || null,
      })
      .eq('id', entry.id);

    setSaving(false);
    if (error) {
      console.error('Failed to update:', error);
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h3>Edit Eval — {entry.first_name} {entry.last_initial}.</h3>

        <div className="form-group">
          <label>First Name</label>
          <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} />
        </div>

        <div className="form-group">
          <label>Last Initial</label>
          <input className="input" value={lastInitial} onChange={e => setLastInitial(e.target.value.toUpperCase().slice(0,1))} maxLength={1} style={{ width: 60, textAlign: 'center', fontSize: 16, fontWeight: 700 }} />
        </div>

        <div className="form-group">
          <label>Program</label>
          <select className="input" value={program} onChange={e => setProgram(e.target.value)}>
            <option value="">No program</option>
            {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Notes</label>
          <textarea className="input" placeholder="Add notes about this eval..."
            value={notes} onChange={e => setNotes(e.target.value)} rows={4} />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!firstName.trim() || !lastInitial.trim() || saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
