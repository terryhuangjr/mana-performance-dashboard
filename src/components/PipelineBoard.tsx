import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import PipelineCard, { daysSince } from './PipelineCard';
import type { BoardEntry } from './PipelineCard';

export type StageKey = 'new' | 'contacted-pending' | 'followup' | 'converted' | 'declined';

export const STAGE_COLORS: Record<StageKey, { dot: string; border: string }> = {
  'new':               { dot: '#3B82F6', border: '#3B82F6' },
  'contacted-pending': { dot: '#F59E0B', border: '#F59E0B' },
  'followup':          { dot: '#EF4444', border: '#EF4444' },
  'converted':         { dot: '#10B981', border: '#10B981' },
  'declined':          { dot: '#9CA3AF', border: '#9CA3AF' },
};

const COLUMNS: { key: StageKey; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'contacted-pending', label: 'Contacted' },
  { key: 'followup', label: 'Follow-up' },
  { key: 'converted', label: 'Converted' },
  { key: 'declined', label: 'Declined' },
];

const STAGE_INFO: Record<StageKey, string> = {
  'new': 'Client had their eval/first booking and hasn\'t been pitched yet. Goal: reach out with the plan + pricing. The card turns red as days since eval pass (8d+).',
  'contacted-pending': 'Russ reached out with the plan/pricing — waiting on the client\'s decision. If no reply after 7 days, the card auto-moves to Follow-up.',
  'followup': 'Needs another nudge. Auto-escalates by time since first contact: Follow-up 1 (7-13d, amber) → Follow-up 2 (14-20d, orange) → Final attempt (21d+, red pulse). Can be flagged manually anytime.',
  'converted': 'Client signed up — program assigned. They graduate from the pipeline here.',
  'declined': 'Client said no or didn\'t move forward. Funnel closed.',
};

export function getStage(entry: BoardEntry, _days: number): StageKey {
  if (entry.converted === true) return 'converted';
  if (entry.converted === false) return 'declined';
  if (entry.needs_followup) return 'followup';
  if (entry.contacted && entry.contacted_at && daysSince(entry.contacted_at.slice(0, 10)) >= 7) return 'followup';
  if (entry.contacted) return 'contacted-pending';
  return 'new';
}

interface ColumnProps {
  colKey: StageKey;
  label: string;
  dot: string;
  entries: BoardEntry[];
  readOnly: boolean;
  onOpen: (entry: BoardEntry) => void;
  infoOpen: boolean;
  onInfoToggle: (key: StageKey) => void;
}

function BoardColumn({ colKey, label, dot, entries, readOnly, onOpen, infoOpen, onInfoToggle }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey, disabled: readOnly });
  return (
    <div ref={setNodeRef} className={`board-column ${isOver ? 'drag-over' : ''}`}>
      {infoOpen && <div className="stage-info-backdrop" onClick={() => onInfoToggle(colKey)} />}
      <div className="board-column-header">
        <span className="stage-dot" style={{ background: dot }} />
        <span className="board-column-label">{label}</span>
        <span className="count-pill">{entries.length}</span>
        <button
          className="stage-info-btn"
          onClick={e => { e.stopPropagation(); onInfoToggle(colKey); }}
          title="What does this stage mean?"
          aria-label={`Info about ${label}`}
        >i</button>
      </div>
      {infoOpen && (
        <div className="stage-info-popover" onClick={e => e.stopPropagation()}>
          {STAGE_INFO[colKey]}
        </div>
      )}
      <div className="board-column-body">
        <SortableContext items={entries.map(e => e.id)} strategy={verticalListSortingStrategy}>
          {entries.length === 0 ? (
            <div className="board-empty">{readOnly ? 'No clients' : 'No clients — drag here'}</div>
          ) : (
            entries.map(e => (
              <PipelineCard key={e.id} entry={e} stageColor={STAGE_COLORS[colKey].border} readOnly={readOnly} onOpen={onOpen} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

interface Props {
  entries: BoardEntry[];
  readOnly: boolean;
  onMove: (entry: BoardEntry, stage: StageKey) => void;
  onOpen: (entry: BoardEntry) => void;
}

export default function PipelineBoard({ entries, readOnly, onMove, onOpen }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeEntry, setActiveEntry] = useState<BoardEntry | null>(null);
  const [infoStage, setInfoStage] = useState<StageKey | null>(null);

  const grouped = useMemo(() => {
    const g: Record<StageKey, BoardEntry[]> = {
      'new': [], 'contacted-pending': [], 'followup': [], 'converted': [], 'declined': [],
    };
    for (const e of entries) {
      g[getStage(e, daysSince(e.eval_date))].push(e);
    }
    return g;
  }, [entries]);

  function handleDragStart(event: any) {
    setActiveEntry(entries.find(e => e.id === event.active.id) || null);
  }

  function handleDragEnd(event: any) {
    setActiveEntry(null);
    if (readOnly || !event.over) return;
    const entry = entries.find(e => e.id === event.active.id);
    if (!entry) return;

    const overId = event.over.id;
    let target: StageKey | null = null;
    if (COLUMNS.some(c => c.key === overId)) {
      target = overId as StageKey;
    } else {
      const overEntry = entries.find(e => e.id === overId);
      if (overEntry) target = getStage(overEntry, daysSince(overEntry.eval_date));
    }
    if (!target) return;

    const source = getStage(entry, daysSince(entry.eval_date));
    if (target !== source) onMove(entry, target);
  }

  return (
    <div className="board-wrap">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {COLUMNS.map(col => (
          <BoardColumn
            key={col.key}
            colKey={col.key}
            label={col.label}
            dot={STAGE_COLORS[col.key].dot}
            entries={grouped[col.key]}
            readOnly={readOnly}
            onOpen={onOpen}
            infoOpen={infoStage === col.key}
            onInfoToggle={(key) => setInfoStage(infoStage === key ? null : key)}
          />
        ))}
        <DragOverlay>
          {activeEntry ? (
            <div className="pipeline-card drag-overlay-card" style={{ borderLeftColor: STAGE_COLORS[getStage(activeEntry, daysSince(activeEntry.eval_date))].border }}>
              <div className="pipeline-card-top">
                <span className="pipeline-card-name">{activeEntry.patient_code || `${activeEntry.first_name} ${activeEntry.last_initial}.`}</span>
                <span className="days-badge">{daysSince(activeEntry.eval_date)}d</span>
              </div>
              <div className="pipeline-card-meta"><span>Eval {new Date(activeEntry.eval_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
