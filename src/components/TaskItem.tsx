interface Task {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
}

interface Props {
  task: Task;
  onToggleComplete: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate + 'T23:59:59') < new Date();
}

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return '';
  const d = new Date(dueDate + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const PRIORITY_DOTS: Record<string, string> = { high: '#EF4444', medium: '#F59E0B', low: '#9CA3AF' };
const PRIORITY_LABELS: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export default function TaskItem({ task, onToggleComplete, onDelete, onEdit }: Props) {
  const overdue = !task.completed && isOverdue(task.due_date);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
      <button className={`checkbox-toggle ${task.completed ? 'checked' : ''}`} onClick={onToggleComplete}>
        {task.completed ? '✓' : ''}
      </button>

      {/* Clickable title area to edit */}
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={onEdit}>
        <div style={{
          fontSize: 14, fontWeight: 500,
          color: task.completed ? 'var(--gray-400)' : 'var(--gray-800)',
          textDecoration: task.completed ? 'line-through' : 'none',
        }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: PRIORITY_DOTS[task.priority] }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_DOTS[task.priority], display: 'inline-block' }} />
            {PRIORITY_LABELS[task.priority]}
          </span>
          {task.due_date && (
            <span style={{ fontSize: 11, color: overdue ? 'var(--danger)' : 'var(--gray-400)', fontWeight: overdue ? 600 : 400 }}>
              {overdue ? '🔴 ' : ''}{formatDueDate(task.due_date)}
            </span>
          )}
          {task.notes && (
            <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
              {task.notes.substring(0, 40)}{task.notes.length > 40 ? '...' : ''}
            </span>
          )}
        </div>
      </div>

      <button className="btn-icon" onClick={onDelete} title="Delete" style={{ fontSize: 14, flexShrink: 0 }}>
        🗑
      </button>
    </div>
  );
}
