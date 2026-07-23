interface Appointment {
  id: string;
  patient_name: string;
  appointment_type: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: string;
  source?: string;
  title?: string;
}

interface Props {
  appointment: Appointment;
  onPatientClick: (name: string) => void;
}

function isEvalType(type: string): boolean {
  const lower = type.toLowerCase();
  return lower.includes('initial') || lower.includes('eval') || lower.includes('evaluation');
}

function formatTime(time: string): string {
  if (!time) return '--';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function AppointmentCard({ appointment, onPatientClick }: Props) {
  const { patient_name, appointment_type, appointment_time, duration_minutes, status, source, title } = appointment;
  const isCancelled = status === 'cancelled';
  const isManual = source === 'manual';
  const isEval = !isManual && isEvalType(appointment_type);

  const displayName = isManual ? (title || patient_name) : (patient_name || 'Unknown');

  let accentColor: string;
  let badgeClass: string;
  let badgeText: string;

  if (isCancelled) {
    accentColor = '#EF4444';
    badgeClass = 'badge-red';
    badgeText = 'Cancelled';
  } else if (isManual) {
    accentColor = '#7C3AED';
    badgeClass = 'badge-purple';
    badgeText = '📌 Event';
  } else if (isEval) {
    accentColor = '#2563EB';
    badgeClass = 'badge-blue';
    badgeText = appointment_type || 'Evaluation';
  } else {
    accentColor = '#D1D5DB';
    badgeClass = 'badge-gray';
    badgeText = appointment_type || 'Session';
  }

  return (
    <div className="appt-card" style={{
      borderLeft: `3px solid ${accentColor}`,
      opacity: isCancelled ? 0.5 : 1,
      background: isCancelled ? 'var(--gray-25)' : 'transparent',
    }}>
      <div style={{ minWidth: 52, flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)', lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(appointment_time)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1, fontWeight: 500 }}>
          {duration_minutes}m
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          onClick={e => { e.stopPropagation(); if (!isManual) onPatientClick(patient_name || ''); }}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: isCancelled ? 'var(--gray-400)' : (isManual ? 'var(--gray-800)' : 'var(--blue-600)'),
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.4,
            cursor: isManual ? 'default' : 'pointer',
          }}
          title={isManual ? '' : 'View patient history'}
        >
          {displayName}
        </div>
        <div style={{ marginTop: 2, display: 'flex', gap: 4, alignItems: 'center' }}>
          <span className={`badge ${badgeClass}`}>{badgeText}</span>
          {isManual && <span className="badge badge-purple" style={{ fontSize: 10 }}>📌</span>}
        </div>
      </div>
    </div>
  );
}
