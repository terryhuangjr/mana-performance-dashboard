import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}

function getDatesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + 'T12:00:00');
  const last = new Date(end + 'T12:00:00');
  while (current <= last) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export default function AddEventModal({ defaultDate, onClose, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState<'purple' | 'green' | 'orange' | 'pink'>('purple');
  const [saving, setSaving] = useState(false);

  const COLOR_MAP = {
    purple: '#7C3AED',
    green: '#059669',
    orange: '#D97706',
    pink: '#DB2777',
  } as const;

  const isMultiDay = endDate && endDate > eventDate;

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);

    const baseRow = {
      title: title.trim(),
      appointment_time: eventTime || null,
      duration_minutes: duration,
      notes: notes.trim() || null,
      source: 'manual',
      status: 'confirmed',
      patient_name: title.trim(),
      appointment_type: 'Manual',
    };

    if (isMultiDay) {
      const dates = getDatesBetween(eventDate, endDate);
      const rows = dates.map(d => ({ ...baseRow, appointment_date: d }));
      const { error } = await supabase.from('mana_appointments').insert(rows);
      setSaving(false);
      if (error) {
        console.error('Failed to save multi-day event:', error);
        return;
      }
    } else {
      const { error } = await supabase.from('mana_appointments').insert({
        ...baseRow,
        appointment_date: eventDate,
      });
      setSaving(false);
      if (error) {
        console.error('Failed to save event:', error);
        return;
      }
    }

    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>+ Add Event</h3>

        <div className="form-group">
          <label>Title</label>
          <input
            className="input"
            placeholder="Staff meeting, CE course, etc."
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Start Date</label>
          <input className="input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
        </div>

        <div className="form-group">
          <label>End Date <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(leave blank for single day)</span></label>
          <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={eventDate} />
          {isMultiDay && (
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
              Creates {getDatesBetween(eventDate, endDate).length} events (one per day)
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Time (optional)</label>
          <input className="input" type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} />
        </div>

        <div className="form-group">
          <label>Duration (minutes)</label>
          <input className="input" type="number" min={5} step={5} value={duration} onChange={e => setDuration(Number(e.target.value))} />
        </div>

        <div className="form-group">
          <label>Color</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(Object.entries(COLOR_MAP) as [string, string][]).map(([name, hex]) => (
              <button
                key={name}
                className={`btn btn-sm ${color === name ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setColor(name as typeof color)}
                style={{ flex: 1, borderLeft: `3px solid ${hex}` }}
              >
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea className="input" placeholder="Any details..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? 'Saving...' : isMultiDay ? `Add ${getDatesBetween(eventDate, endDate).length} Events` : 'Add Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
