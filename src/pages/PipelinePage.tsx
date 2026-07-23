import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import HeaderStats from '../components/HeaderStats';
import PipelineTable from '../components/PipelineTable';
import AddEvalModal from '../components/AddEvalModal';
import EditEvalModal from '../components/EditEvalModal';

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
  needs_followup: boolean;
}

type FilterType = 'all' | 'new' | 'contacted' | 'followup' | 'converted' | 'not-converted';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getPipelineStage(e: PipelineEntry, daysSince: number): string {
  if (e.converted === true) return 'converted';
  if (e.converted === false) return 'declined';
  if (e.needs_followup || daysSince >= 8) return 'followup';
  if (e.contacted) return 'contacted-pending';
  return 'new';
}

const STAGE_ORDER: Record<string, number> = {
  'new': 0,
  'contacted-pending': 1,
  'followup': 2,
  'converted': 3,
  'declined': 4,
};

export default function PipelinePage() {
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PipelineEntry | null>(null);

  const isCurrentMonth = currentMonth === now.getMonth() + 1 && currentYear === now.getFullYear();
  const isFuture = currentYear > now.getFullYear() || (currentYear === now.getFullYear() && currentMonth > now.getMonth() + 1);
  const isReadOnly = !isCurrentMonth && !isFuture;

  useEffect(() => { fetchPipeline(); }, [currentMonth, currentYear]);

  async function fetchPipeline() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mana_pipeline')
        .select('*')
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .order('eval_date', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      setEntries(data || []);
    } catch (err: any) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleContacted(id: string, current: boolean) {
    await supabase.from('mana_pipeline').update({ contacted: !current }).eq('id', id);
    fetchPipeline();
  }

  async function toggleConverted(id: string, current: boolean | null) {
    let newVal: boolean | null;
    if (current === null) newVal = true;
    else if (current === true) newVal = false;
    else newVal = null;
    const updates: any = { converted: newVal };
    if (newVal !== true) updates.program = null;
    await supabase.from('mana_pipeline').update(updates).eq('id', id);
    fetchPipeline();
  }

  async function updateProgram(id: string, program: string | null) {
    await supabase.from('mana_pipeline').update({ program }).eq('id', id);
    fetchPipeline();
  }

  async function toggleFollowup(id: string, current: boolean) {
    await supabase.from('mana_pipeline').update({ needs_followup: !current }).eq('id', id);
    fetchPipeline();
  }

  // Sort entries by pipeline stage, then by eval date within stage
  const sortedEntries = [...entries].sort((a, b) => {
    const daysA = Math.floor((Date.now() - new Date(a.eval_date + 'T12:00:00').getTime()) / 86400000);
    const daysB = Math.floor((Date.now() - new Date(b.eval_date + 'T12:00:00').getTime()) / 86400000);
    const stageA = STAGE_ORDER[getPipelineStage(a, daysA)] ?? 99;
    const stageB = STAGE_ORDER[getPipelineStage(b, daysB)] ?? 99;
    if (stageA !== stageB) return stageA - stageB;
    // Within same stage, oldest eval first (most urgent)
    return new Date(a.eval_date).getTime() - new Date(b.eval_date).getTime();
  });

  const filteredEntries = sortedEntries.filter(e => {
    const days = Math.floor((Date.now() - new Date(e.eval_date + 'T12:00:00').getTime()) / 86400000);
    switch (filter) {
      case 'new': return !e.contacted;
      case 'contacted': return e.contacted && e.converted !== true;
      case 'followup': return e.converted !== true && (e.needs_followup || days >= 4);
      case 'converted': return e.converted === true;
      case 'not-converted': return e.converted === false;
      default: return true;
    }
  });

  const totalEvals = entries.length;
  const convertedCount = entries.filter(e => e.converted === true).length;
  const newCount = entries.filter(e => !e.contacted).length;
  const conversionRate = totalEvals > 0 ? Math.round((convertedCount / totalEvals) * 100) : 0;
  const needsFollowup = entries.filter(e => e.converted !== true && e.needs_followup).length;

  function navigateMonth(dir: number) {
    let m = currentMonth + dir;
    let y = currentYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setCurrentMonth(m);
    setCurrentYear(y);
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Pipeline</h1>
          <p>Track eval-to-conversion progress</p>
        </div>
        {!isReadOnly && (
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Eval
          </button>
        )}
      </div>

      <HeaderStats totalEvals={totalEvals} convertedCount={convertedCount} conversionRate={conversionRate} needsFollowup={needsFollowup} newCount={newCount} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigateMonth(-1)}>←</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-700)', minWidth: 100, textAlign: 'center' }}>
            {MONTHS[currentMonth - 1]} {currentYear}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigateMonth(1)} disabled={isFuture && currentMonth >= now.getMonth() + 1 && currentYear >= now.getFullYear()}>→</button>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {([
            { key: 'all' as FilterType, label: 'All' },
            { key: 'new' as FilterType, label: 'New' },
            { key: 'contacted' as FilterType, label: 'Contacted' },
            { key: 'followup' as FilterType, label: 'Follow-up' },
            { key: 'converted' as FilterType, label: 'Converted' },
          ]).map(f => (
            <button key={f.key} className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : filteredEntries.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <h3>No evals found</h3>
          <p>{isReadOnly ? 'No data for this month.' : 'Add your first eval to start tracking.'}</p>
        </div>
      ) : (
        <PipelineTable
          entries={filteredEntries}
          readOnly={isReadOnly}
          onToggleContacted={toggleContacted}
          onToggleConverted={toggleConverted}
          onUpdateProgram={updateProgram}
          onToggleFollowup={toggleFollowup}
          onRowClick={(entry: any) => setEditingEntry(entry)}
        />
      )}

      {showAddModal && (
        <AddEvalModal month={currentMonth} year={currentYear} onClose={() => setShowAddModal(false)} onSaved={() => { setShowAddModal(false); fetchPipeline(); }} />
      )}

      {editingEntry && (
        <EditEvalModal entry={editingEntry} onClose={() => setEditingEntry(null)} onSaved={() => { setEditingEntry(null); fetchPipeline(); }} />
      )}
    </div>
  );
}
