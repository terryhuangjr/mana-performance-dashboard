import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface BoardEntry {
  id: string;
  patient_code?: string | null;
  first_name: string;
  last_initial: string;
  eval_date: string;
  contacted: boolean;
  contacted_at?: string | null;
  converted: boolean | null;
  program: string | null;
  notes: string | null;
  needs_followup: boolean;
  month: number;
  year: number;
}

export function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000);
}

export function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Auto-escalating follow-up tier, anchored on contacted_at (7/14/21d ladder). */
export function followupTier(contactedAt: string | null | undefined): { label: string; cls: string } | null {
  if (!contactedAt) return null;
  const d = daysSince(contactedAt.slice(0, 10));
  if (d >= 21) return { label: 'Final attempt', cls: 'tier-final' };
  if (d >= 14) return { label: 'Follow-up 2', cls: 'tier-2' };
  if (d >= 7) return { label: 'Follow-up 1', cls: 'tier-1' };
  return null;
}

interface Props {
  entry: BoardEntry;
  stageColor: string;
  readOnly: boolean;
  onOpen: (entry: BoardEntry) => void;
}

export default function PipelineCard({ entry, stageColor, readOnly, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
    disabled: readOnly,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    borderLeftColor: stageColor,
  };

  const days = daysSince(entry.eval_date);
  const label = entry.patient_code || (entry.first_name ? `${entry.first_name} ${entry.last_initial}.` : 'Unknown');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`pipeline-card ${isDragging ? 'dragging' : ''}`}
      onClick={() => !readOnly && onOpen(entry)}
      title={readOnly ? undefined : 'Click to edit · drag to move stage'}
    >
      <div className="pipeline-card-top">
        <span className="pipeline-card-name">{label}</span>
        <span className={`days-badge ${days >= 8 ? 'urgent' : days >= 4 ? 'warn' : ''}`}>{days}d</span>
      </div>
      <div className="pipeline-card-meta">
        <span>Eval {fmtDate(entry.eval_date)}</span>
        {entry.converted === true && entry.program && <span className="program-pill">{entry.program}</span>}
        {entry.needs_followup && <span className="fu-pill">Follow-up</span>}
        {(() => { const tier = followupTier(entry.contacted_at); return tier ? <span className={`tier-pill ${tier.cls}`}>{tier.label}</span> : null; })()}
      </div>
      {entry.notes && <div className="pipeline-card-notes">{entry.notes}</div>}
    </div>
  );
}
