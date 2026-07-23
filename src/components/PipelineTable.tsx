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
  entries: Entry[];
  readOnly: boolean;
  onToggleContacted: (id: string, current: boolean) => void;
  onToggleConverted: (id: string, current: boolean | null) => void;
  onUpdateProgram: (id: string, program: string | null) => void;
  onToggleFollowup: (id: string, current: boolean) => void;
  onRowClick: (entry: Entry) => void;
}

const PROGRAMS = ['MANA 6','MANA 10','MANA 20','BK Weekly','BK Bi-Weekly','BK Monthly','NAHL Weekly','NAHL Bi-Weekly','NAHL Monthly','Cobblestone'];

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000);
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Determine which color/highlight a row gets based on pipeline stage */
function getStageInfo(entry: Entry, days: number) {
  if (entry.converted === true) {
    return {
      bg: '#F0FDF4',        // green tint
      label: 'Converted',
      border: '#10B981',
    };
  }
  if (entry.converted === false) {
    return {
      bg: '#FEF2F2',        // red tint
      label: 'Declined',
      border: '#EF4444',
    };
  }
  if (entry.needs_followup || days >= 8) {
    return {
      bg: '#FEF2F2',        // red tint — urgent
      label: 'Follow-up needed',
      border: '#EF4444',
    };
  }
  if (entry.contacted) {
    return {
      bg: '#FFFBEB',        // yellow tint — pending
      label: 'Pending response',
      border: '#F59E0B',
    };
  }
  return {
    bg: '#EFF6FF',          // blue tint — new
    label: 'New — needs contact',
    border: '#3B82F6',
  };
}

export default function PipelineTable({ entries, readOnly, onToggleContacted, onToggleConverted, onUpdateProgram, onToggleFollowup, onRowClick }: Props) {
  return (
    <div className="card pipeline-table-wrap" style={{ marginTop: 16, padding: 0 }}>
      {/* Column headers — crystal clear */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '80px 1.3fr 75px 75px 1.2fr 65px 90px 1.2fr',
        gap: 6,
        padding: '10px 16px',
        background: 'var(--gray-50)',
        borderBottom: '1px solid var(--gray-200)',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--gray-500)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        <span>Eval Date</span>
        <span>Patient</span>
        <span style={{ textAlign: 'center' }}>Contacted</span>
        <span style={{ textAlign: 'center' }}>Converted</span>
        <span>Program</span>
        <span style={{ textAlign: 'center' }}>Days Since</span>
        <span style={{ textAlign: 'center' }}>Need F/U</span>
        <span style={{ textAlign: 'center' }}>Notes</span>
      </div>

      {entries.map(entry => {
        const days = daysSince(entry.eval_date);
        const stage = getStageInfo(entry, days);

        return (
          <div
            key={entry.id}
            onClick={() => !readOnly && onRowClick(entry)}
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1.3fr 75px 75px 1.2fr 65px 90px 1.2fr',
              gap: 6,
              padding: '9px 16px',
              alignItems: 'center',
              fontSize: 13,
              borderBottom: '1px solid var(--gray-100)',
              background: stage.bg,
              borderLeft: `3px solid ${stage.border}`,
              cursor: readOnly ? 'default' : 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => !readOnly && (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => e.currentTarget.style.background = stage.bg}
          >
            <span style={{ color: 'var(--gray-500)', fontSize: 12 }}>{fmtDate(entry.eval_date)}</span>

            <span style={{ fontWeight: 600, color: 'var(--gray-800)' }}>
              {entry.first_name} {entry.last_initial}.
            </span>

            {/* Contacted — checkbox */}
            {readOnly ? (
              <span style={{ textAlign: 'center', fontSize: 14, color: entry.contacted ? 'var(--success)' : 'var(--gray-300)' }}>
                {entry.contacted ? '✓' : '○'}
              </span>
            ) : (
              <button className={`checkbox-toggle ${entry.contacted ? 'checked' : ''}`}
                onClick={e => { e.stopPropagation(); onToggleContacted(entry.id, entry.contacted); }}
                style={{ margin: '0 auto' }}
              >
                {entry.contacted ? '✓' : ''}
              </button>
            )}

            {/* Converted — 3-state */}
            {readOnly ? (
              <span style={{ textAlign: 'center', fontSize: 14 }}>
                {entry.converted === null ? '—' : entry.converted ? '✓' : '✗'}
              </span>
            ) : (
              <button className={`three-state-btn ${entry.converted === null ? 'unknown' : entry.converted === true ? 'yes' : 'no'}`}
                onClick={e => { e.stopPropagation(); onToggleConverted(entry.id, entry.converted); }}
                style={{ margin: '0 auto' }}
              >
                {entry.converted === null ? '?' : entry.converted === true ? '✓' : '✗'}
              </button>
            )}

            {/* Program */}
            <div>
              {entry.converted === true && !readOnly ? (
                <select className="input" style={{ fontSize: 11, padding: '3px 6px', width: '100%' }}
                  value={entry.program || ''}
                  onClick={e => e.stopPropagation()}
                  onChange={e => onUpdateProgram(entry.id, e.target.value || null)}
                >
                  <option value="">Select...</option>
                  {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <span style={{ color: entry.program ? 'var(--gray-800)' : 'var(--gray-400)', fontSize: 12 }}>
                  {entry.program || '—'}
                </span>
              )}
            </div>

            {/* Days since eval */}
            <span style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: days >= 8 ? 'var(--danger)' : days >= 4 ? 'var(--warning)' : 'var(--gray-600)' }}>
              {days}
            </span>

            {/* Needs Follow-up */}
            {readOnly ? (
              <span style={{ textAlign: 'center', fontSize: 13 }}>{entry.needs_followup ? 'Yes' : '—'}</span>
            ) : (
              <button
                className="btn btn-sm"
                style={{
                  margin: '0 auto',
                  padding: '2px 8px',
                  fontSize: 11,
                  background: entry.needs_followup ? '#FEF3C7' : 'transparent',
                  border: entry.needs_followup ? '1px solid #F59E0B' : '1px solid var(--gray-200)',
                  color: entry.needs_followup ? '#92400E' : 'var(--gray-400)',
                  minHeight: 24,
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
                onClick={e => { e.stopPropagation(); onToggleFollowup(entry.id, entry.needs_followup); }}
              >
                {entry.needs_followup ? 'Yes' : 'No'}
              </button>
            )}

            {/* Notes */}
            <span style={{ color: 'var(--gray-400)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: !readOnly ? 'pointer' : 'default' }}
              onClick={e => { if (!readOnly) { e.stopPropagation(); onRowClick(entry); }}}>
              {entry.notes || '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
