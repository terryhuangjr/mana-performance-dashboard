import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import TaskItem from '../components/TaskItem';
import AddTaskModal from '../components/AddTaskModal';
import EditTaskModal from '../components/EditTaskModal';

interface Task {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => { fetchTasks(); }, []);

  async function fetchTasks() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mana_tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTasks(data || []);
    } catch (err: any) {
      console.error('Failed to load:', err);
    } finally { setLoading(false); }
  }

  async function toggleComplete(id: string, current: boolean) {
    await supabase.from('mana_tasks').update({
      completed: !current,
      completed_at: !current ? new Date().toISOString() : null,
    }).eq('id', id);
    fetchTasks();
  }

  async function deleteTask(id: string) {
    await supabase.from('mana_tasks').delete().eq('id', id);
    fetchTasks();
  }

  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Tasks</h1>
          <p>Manage your to-do list</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + Add Task
        </button>
      </div>

      {activeTasks.length === 0 ? (
        <div className="empty-state">
          <h3>All caught up</h3>
          <p>No active tasks. Add one to get started.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {activeTasks.map((task, i) => (
            <div key={task.id}>
              <TaskItem
                task={task}
                onToggleComplete={() => toggleComplete(task.id, task.completed)}
                onDelete={() => deleteTask(task.id)}
                onEdit={() => setEditingTask(task)}
              />
              {i < activeTasks.length - 1 && <div style={{ height: 1, background: 'var(--gray-100)', margin: '0 16px' }} />}
            </div>
          ))}
        </div>
      )}

      {completedTasks.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'space-between', padding: '10px 16px' }}
            onClick={() => setShowCompleted(!showCompleted)}
          >
            <span style={{ fontWeight: 500 }}>Completed ({completedTasks.length})</span>
            <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{showCompleted ? '▲' : '▼'}</span>
          </button>

          {showCompleted && (
            <div className="card" style={{ marginTop: 8, padding: 0, overflow: 'hidden' }}>
              <div style={{ opacity: 0.55 }}>
                {completedTasks.map((task, i) => (
                  <div key={task.id}>
                    <TaskItem
                      task={task}
                      onToggleComplete={() => toggleComplete(task.id, task.completed)}
                      onDelete={() => deleteTask(task.id)}
                      onEdit={() => setEditingTask(task)}
                    />
                    {i < completedTasks.length - 1 && <div style={{ height: 1, background: 'var(--gray-100)', margin: '0 16px' }} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <AddTaskModal onClose={() => setShowAddModal(false)} onSaved={() => { setShowAddModal(false); fetchTasks(); }} />
      )}

      {editingTask && (
        <EditTaskModal task={editingTask} onClose={() => setEditingTask(null)} onSaved={() => { setEditingTask(null); fetchTasks(); }} />
      )}
    </div>
  );
}
