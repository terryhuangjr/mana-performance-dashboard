import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import HeaderStats from '../components/HeaderStats';
import PipelineBoard from '../components/PipelineBoard';
import type { StageKey } from '../components/PipelineBoard';
import EditEvalModal from '../components/EditEvalModal';

interface PipelineEntry {
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
  month: number;
  year: number;
  needs_followup: boolean;
}

type FilterType = 'all' | 'new' | 'contacted' | 'followup' | 'converted' | 'not-converted' | 'expired';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getPipelineStage(e: PipelineEntry, _daysSince: number): string {
  if (e.converted === true) return 'converted';
  if (e.converted === false) return 'declined';
  if (_daysSince >= 60) return 'expired';
  if (e.needs_followup) return 'followup';
  if (e.contacted && e.contacted_at) {
    const d = Math.floor((Date.now() - new Date(e.contacted_at.slice(0, 10) + 'T12:00:00').getTime()) / 86400000);
    if (d >= 7) return 'followup';
  }
  if (e.contacted) return 'contacted-pending';
  return 'new';
}

const STAGE_ORDER: Record<string, number> = {
  'new': 0,
  'contacted-pending': 1,
  'followup': 2,
  'converted': 3,
  'declined': 4,
  'expired': 5,
};

export default function PipelinePage() {
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [editingEntry, setEditingEntry] = useState<PipelineEntry | null>(null);

  const isFuture = currentYear > now.getFullYear() || (currentYear === now.getFullYear() && currentMonth > now.getMonth() + 1);

  useEffect(() => { fetchPipeline(); }, [currentMonth, currentYear]);

  async function fetchPipeline() {
    setLoading(true);
    try {
      // Open cards are pipeline-wide — they survive month rollover (only resolved
      // cards get archived at month end). Resolved cards are shown for the
      // selected month only (that month's record) until the archive job picks them up.
      const [openRes, resolvedRes] = await Promise.all([
        supabase
          .from('mana_pipeline')
          .select('*')
          .is('converted', null)
          .order('eval_date', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('mana_pipeline')
          .select('*')
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .not('converted', 'is', null)
          .order('eval_date', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);
      if (openRes.error) throw openRes.error;
      if (resolvedRes.error) throw resolvedRes.error;
      setEntries([...(openRes.data || []), ...(resolvedRes.data || [])]);
    } catch (err: any) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }

  /** Board drag → stage field write. Clears program whenever a card leaves converted. */
  async function updateStage(id: string, stage: StageKey) {
    if (stage === 'expired') return; // view-derived stage — no DB write; drag out to revive
    let updates: any;
    switch (stage) {
      case 'new':
        updates = { contacted: false, needs_followup: false, converted: null, program: null, contacted_at: null };
        break;
      case 'contacted-pending':
        updates = { contacted: true, needs_followup: false, converted: null, program: null, contacted_at: new Date().toISOString() };
        break;
      case 'followup':
        updates = { contacted: true, needs_followup: true, converted: null, program: null };
        break;
      case 'converted':
        updates = { contacted: true, needs_followup: false, converted: true };
        break;
      case 'declined':
        updates = { contacted: true, needs_followup: false, converted: false, program: null };
        break;
    }
    const { error } = await supabase.from('mana_pipeline').update(updates).eq('id', id);
    if (error) console.error('Stage update failed:', error);
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
      case 'expired': return e.converted === null && days >= 60;
      default: return true;
    }
  });

  const totalEvals = entries.length;
  const convertedCount = entries.filter(e => e.converted === true).length;
  const daysFor = (e: PipelineEntry) => Math.floor((Date.now() - new Date(e.eval_date + 'T12:00:00').getTime()) / 86400000);
  const newCount = entries.filter(e => getPipelineStage(e, daysFor(e)) === 'new').length;
  const conversionRate = totalEvals > 0 ? Math.round((convertedCount / totalEvals) * 100) : 0;
  const needsFollowup = entries.filter(e => getPipelineStage(e, daysFor(e)) === 'followup').length;

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
          <p>Track eval-to-conversion progress — open cards persist across months</p>
        </div>
      </div>

      <HeaderStats totalEvals={totalEvals} convertedCount={convertedCount} conversionRate={conversionRate} needsFollowup={needsFollowup} newCount={newCount} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigateMonth(-1)}>←</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-700)', minWidth: 100, textAlign: 'center' }}>
            {MONTHS[currentMonth - 1]} {currentYear}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigateMonth(1)} disabled={isFuture && currentMonth >= now.getMonth() + 1 && currentYear >= now.getFullYear()}>→</button>
          <span style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>all open cards shown · resolved = selected month</span>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {([
            { key: 'all' as FilterType, label: 'All' },
            { key: 'new' as FilterType, label: 'New' },
            { key: 'contacted' as FilterType, label: 'Contacted' },
            { key: 'followup' as FilterType, label: 'Follow-up' },
            { key: 'converted' as FilterType, label: 'Converted' },
            { key: 'expired' as FilterType, label: 'Expired' },
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
          <h3>No clients in the pipeline</h3>
          <p>Open cards stay on the board across months. New clients appear here once they sync from Jane.</p>
        </div>
      ) : (
        <PipelineBoard
          entries={filteredEntries}
          readOnly={false}
          onMove={async (entry, stage) => {
            await updateStage(entry.id, stage);
            if (stage === 'converted') setEditingEntry(entry);
          }}
          onOpen={(entry) => setEditingEntry(entry)}
        />
      )}

      {editingEntry && (
        <EditEvalModal entry={editingEntry} onClose={() => setEditingEntry(null)} onSaved={() => { setEditingEntry(null); fetchPipeline(); }} />
      )}
    </div>
  );
}
