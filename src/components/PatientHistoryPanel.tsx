import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Appointment {
  id: string;
  patient_name: string;
  appointment_type: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: string;
}

interface PipelineEntry {
  first_name: string;
  last_initial: string;
  eval_date: string;
  contacted: boolean;
  converted: boolean | null;
  program: string | null;
  notes: string | null;
}

interface Props {
  patientName: string;
  appointments: Appointment[];
  pipeline: PipelineEntry | null;
  onClose: () => void;
}

function formatTime(time: string): string {
  if (!time) return '--';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function PatientHistoryPanel({ patientName, appointments, pipeline, onClose }: Props) {
  const nameParts = patientName.split(' ');
  const firstName = nameParts[0];

  // Fetch all pipeline entries that could match
  const [allPipeline, setAllPipeline] = useState<PipelineEntry[]>([]);

  useEffect(() => {
    supabase
      .from('mana_pipeline')
      .select('*')
      .ilike('first_name', `%${firstName}%`)
      .order('eval_date', { ascending: false })
      .then(({ data }) => setAllPipeline(data as PipelineEntry[] || []));
  }, [firstName]);

  const converted = pipeline?.converted === true;
  const declined = pipeline?.converted === false;
  const pending = pipeline?.converted === null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{patientName}</h3>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
            background: converted ? '#D1FAE5' : declined ? '#FEE2E2' : pending ? '#FEF3C7' : '#F3F4F6',
            color: converted ? '#065F46' : declined ? '#991B1B' : pending ? '#92400E' : 'var(--gray-500)',
          }}>
            {converted ? 'Converted' : declined ? 'Declined' : pending ? 'Pending' : 'Unknown'}
          </span>
        </div>

        {/* Pipeline status summary */}
        {pipeline ? (
          <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pipeline Status</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              <div>
                <span style={{ color: 'var(--gray-500)' }}>Eval Date: </span>
                <span style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{new Date(pipeline.eval_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div>
                <span style={{ color: 'var(--gray-500)' }}>Contacted: </span>
                <span style={{ fontWeight: 600, color: pipeline.contacted ? 'var(--success)' : 'var(--gray-400)' }}>{pipeline.contacted ? 'Yes' : 'No'}</span>
              </div>
              {pipeline.program && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--gray-500)' }}>Program: </span>
                  <span style={{ fontWeight: 600, color: 'var(--blue-600)' }}>{pipeline.program}</span>
                </div>
              )}
              {pipeline.notes && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--gray-500)' }}>Notes: </span>
                  <span>{pipeline.notes}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--gray-500)', textAlign: 'center' }}>
            No pipeline record found for {patientName}
          </div>
        )}

        {/* All matching pipeline entries */}
        {allPipeline.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pipeline History ({allPipeline.length})
            </div>
            {allPipeline.map((p, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                borderBottom: i < allPipeline.length - 1 ? '1px solid var(--gray-100)' : 'none',
                fontSize: 12, color: 'var(--gray-600)',
              }}>
                <span>{p.eval_date}</span>
                <span>{p.contacted ? 'Contacted' : 'Not contacted'}</span>
                <span>{p.converted === true ? '✓' : p.converted === false ? '✗' : '?'}</span>
                <span>{p.program || '—'}</span>
              </div>
            ))}
          </div>
        )}

        {/* Appointment history */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Appointment History ({appointments.length})
          </div>
          {appointments.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-400)', textAlign: 'center', padding: 12 }}>
              No appointments found for this patient.
            </div>
          ) : (
            appointments
              .sort((a, b) => (b.appointment_date || '').localeCompare(a.appointment_date || ''))
              .slice(0, 20)
              .map((a, i) => (
                <div key={a.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 0', borderBottom: i < Math.min(appointments.length, 20) - 1 ? '1px solid var(--gray-100)' : 'none',
                  fontSize: 12,
                  opacity: a.status === 'cancelled' ? 0.5 : 1,
                }}>
                  <span style={{ color: 'var(--gray-500)' }}>
                    {new Date(a.appointment_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span style={{ color: 'var(--gray-400)' }}>{formatTime(a.appointment_time)}</span>
                  <span style={{ fontWeight: 500, color: 'var(--gray-700)', flex: 1, marginLeft: 8 }}>
                    {a.appointment_type || 'Session'}
                  </span>
                  <span className={`badge ${a.status === 'cancelled' ? 'badge-red' : a.status === 'confirmed' ? 'badge-green' : 'badge-gray'}`}>
                    {a.status === 'cancelled' ? 'Cancelled' : a.status === 'confirmed' ? 'Done' : a.status}
                  </span>
                </div>
              ))
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Close</button>
        </div>
      </div>
    </div>
  );
}
