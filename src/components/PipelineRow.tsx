import { useState } from 'react';

interface PipelineEntry {
  id: string;
  first_name: string;
  last_initial: string;
  eval_date: string;
  contacted: boolean;
  converted: boolean | null;
  program: string | null;
  notes: string | null;
  month: number;
  year: number;
}

interface Props {
  entry: PipelineEntry;
  onToggleContacted: () => void;
  onToggleConverted: () => void;
  onUpdateProgram: (program: string | null) => void;
}

const PROGRAMS = [
  'MANA 6', 'MANA 10', 'MANA 20',
  'BK Weekly', 'BK Bi-Weekly', 'BK Monthly',
  'NAHL Weekly', 'NAHL Bi-Weekly', 'NAHL Monthly',
  'Cobblestone',
];

function getDaysSince(dateStr: string): number {
  const evalDate = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  return Math.floor((now.getTime() - evalDate.getTime()) / (1000 * 60 * 60 * 24));
}

function formatEvalDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export default function PipelineRow({ entry, onToggleContacted, onToggleConverted, onUpdateProgram }: Props) {
  const [editingProgram, setEditingProgram] = useState(false);
  const daysSince = getDaysSince(entry.eval_date);
  const patientLabel = `${entry.first_name} ${entry.last_initial}.`;

  // Row background color
  let bgColor = 'transparent';
  if (entry.converted === true) {
    bgColor = 'rgba(16,185,129,0.06)';
  } else if (entry.converted === false || (entry.converted === null && daysSince >= 4)) {
    if (daysSince >= 8) {
      bgColor = 'rgba(239,68,68,0.06)';
    } else if (daysSince >= 4) {
      bgColor = 'rgba(245,158,11,0.06)';
    }
  }

  // Days color
  let daysColor = 'var(--white)';
  let daysIcon = '';
  if (daysSince >= 8) { daysColor = 'var(--danger)'; daysIcon = '🔴'; }
  else if (daysSince >= 4) { daysColor = 'var(--warning)'; daysIcon = '⚠️'; }

  return (
    <div
      className="card"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.5fr 40px 40px 1fr 50px',
        gap: 6,
        alignItems: 'center',
        padding: '10px 8px',
        background: bgColor,
        fontSize: 13,
      }}
    >
      {/* Date */}
      <span style={{ color: 'var(--gray)', fontSize: 12 }}>
        {formatEvalDate(entry.eval_date)}
      </span>

      {/* Patient */}
      <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {patientLabel}
      </span>

      {/* Contacted toggle */}
      <button
        className={`checkbox-toggle ${entry.contacted ? 'checked' : ''}`}
        onClick={onToggleContacted}
        title="Toggle contacted"
      >
        {entry.contacted ? '✓' : ''}
      </button>

      {/* Converted three-state toggle */}
      <button
        className={`three-state-btn ${
          entry.converted === null ? 'unknown' :
          entry.converted === true ? 'yes' : 'no'
        }`}
        onClick={onToggleConverted}
        title="Toggle conversion status"
      >
        {entry.converted === null ? '?' :
         entry.converted === true ? '✓' : '✗'}
      </button>

      {/* Program dropdown */}
      <div>
        {editingProgram && entry.converted === true ? (
          <select
            className="select"
            style={{ fontSize: 11, padding: '4px 6px' }}
            value={entry.program || ''}
            onChange={(e) => {
              onUpdateProgram(e.target.value || null);
              setEditingProgram(false);
            }}
            onBlur={() => setEditingProgram(false)}
            autoFocus
          >
            <option value="">None</option>
            {PROGRAMS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        ) : (
          <span
            style={{
              fontSize: 11,
              color: entry.program ? 'var(--white)' : 'var(--gray)',
              cursor: entry.converted === true ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            }}
            onClick={() => entry.converted === true && setEditingProgram(true)}
          >
            {entry.program || '—'}
          </span>
        )}
      </div>

      {/* Days */}
      <span style={{
        textAlign: 'center',
        fontSize: 12,
        fontWeight: 700,
        color: daysColor,
      }}>
        {daysIcon} {daysSince}
      </span>
    </div>
  );
}
