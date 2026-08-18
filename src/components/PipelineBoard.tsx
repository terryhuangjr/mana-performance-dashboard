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

export function getStage(entry: BoardEntry, days: number): StageKey {
  if (entry.converted === true) return 'converted';
  if (entry.converted === false) return 'declined';
  if (entry.needs_followup || days >= 8) return 'followup';
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
}

function BoardColumn({ colKey, label, dot, entries, readOnly, onOpen }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey, disabled: readOnly });
  return (
    <div ref={setNodeRef} className={`board-column ${isOver ? 'drag-over' : ''}`}>
      <div className="board-column-header">
        <span className="stage-dot" style={{ background: dot }} />
        <span className="board-column-label">{label}</span>
        <span className="count-pill">{entries.length}</span>
      </div>
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
