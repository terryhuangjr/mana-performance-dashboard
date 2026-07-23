import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Appointment {
  id: string;
  patient_name: string;
  appointment_type: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: string;
  source?: string;
  notes?: string;
}

interface Props {
  appointment: Appointment;
  onClose: () => void;
  onPatientClick: (name: string) => void;
  onSaved: () => void;
}

function formatTime(time: string): string {
  if (!time) return '--';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function AppointmentDetail({ appointment, onClose, onPatientClick, onSaved }: Props) {
  const [notes, setNotes] = useState(appointment.notes || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isManual = appointment.source === 'manual';

  async function saveNotes() {
    setSaving(true);
    const { error } = await supabase
      .from('mana_appointments')
      .update({ notes: notes.trim() || null })
      .eq('id', appointment.id);
    setSaving(false);
    if (!error) onSaved();
  }

  async function deleteEvent() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    const { error } = await supabase
      .from('mana_appointments')
      .delete()
      .eq('id', appointment.id);
    setDeleting(false);
    if (!error) { onSaved(); onClose(); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h3>Appointment Details</h3>

        <div style={{ marginBottom: 20 }}>
          {/* Patient name */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Patient</div>
            <span
              onClick={() => { onPatientClick(appointment.patient_name || ''); onClose(); }}
              style={{ fontSize: 18, fontWeight: 700, color: 'var(--blue-600)', cursor: 'pointer' }}
            >
              {appointment.patient_name || 'Unknown'} →
            </span>
          </div>

          {/* Type */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</div>
            <span className={`badge ${appointment.status === 'cancelled' ? 'badge-red' : 'badge-blue'}`}>
              {appointment.appointment_type || 'Session'}
            </span>
            {appointment.status === 'cancelled' && (
              <span className="badge badge-red" style={{ marginLeft: 6 }}>Cancelled</span>
            )}
          </div>

          {/* Detail rows */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--gray-800)' }}>
                {new Date(appointment.appointment_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Time</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--gray-800)' }}>
                {formatTime(appointment.appointment_time)} ({appointment.duration_minutes}m)
              </div>
            </div>
          </div>
        </div>

        {/* Internal notes */}
        <div className="form-group">
          <label>Internal Notes</label>
          <textarea
            className="input"
            placeholder="Add internal notes about this appointment..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
          />
        </div>

        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          <div>
            {isManual && (
              <button
                className="btn btn-danger"
                onClick={deleteEvent}
                disabled={deleting}
                style={{ fontSize: 13 }}
              >
                {deleting ? 'Deleting...' : confirmDelete ? 'Confirm Delete?' : 'Delete Event'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
            <button className="btn btn-primary" onClick={saveNotes} disabled={saving}>
              {saving ? 'Saving...' : notes !== (appointment.notes || '') ? 'Save Notes' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
