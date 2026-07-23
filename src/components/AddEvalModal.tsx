import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  month: number;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddEvalModal({ month, year, onClose, onSaved }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [evalDate, setEvalDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!firstName.trim() || !lastInitial.trim()) return;
    setSaving(true);

    const { error } = await supabase
      .from('mana_pipeline')
      .insert({
        first_name: firstName.trim(),
        last_initial: lastInitial.trim().charAt(0).toUpperCase(),
        eval_date: evalDate,
        notes: notes.trim() || null,
        month,
        year,
      });

    setSaving(false);
    if (error) {
      console.error('Failed to save:', error);
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>+ Add Eval</h3>

        <div className="form-group">
          <label>First Name</label>
          <input
            className="input"
            placeholder="e.g. Sarah"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Last Initial</label>
          <input
            className="input"
            placeholder="e.g. J"
            value={lastInitial}
            onChange={e => setLastInitial(e.target.value.toUpperCase().slice(0, 1))}
            maxLength={1}
            style={{ width: 60, textAlign: 'center', fontSize: 18, fontWeight: 700 }}
          />
        </div>

        <div className="form-group">
          <label>Eval Date</label>
          <input
            className="input"
            type="date"
            value={evalDate}
            onChange={e => setEvalDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea
            className="input"
            placeholder="Any notes about this eval..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!firstName.trim() || !lastInitial.trim() || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
