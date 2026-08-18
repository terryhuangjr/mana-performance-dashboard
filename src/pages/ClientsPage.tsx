import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ApptRow {
  patient_code: string | null;
  appointment_type: string;
  appointment_date: string;
  status: string;
}

interface PipelineRow {
  patient_code: string | null;
  converted: boolean | null;
  program: string | null;
}

interface Client {
  code: string;
  program: string;            // derived from appointments, or pipeline program if converted
  visits: number;
  first_visit: string | null;
  last_visit: string | null;
  next_visit: string | null;
  status: 'Active' | 'Slowing' | 'Lapsed' | 'Scheduled';
}

const TYPE_PROGRAM: Record<string, string> = {
  'Training Session': 'Training',
  'Restorative Care': 'Restorative',
  'Golf Performance Assessment': 'Golf',
  'Initial Evaluation': 'Eval',
  'Follow-Up Visit': 'Therapy / Rehab',
};

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type SortKey = 'next' | 'last' | 'code' | 'program';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('next');

  useEffect(() => {
    (async () => {
      try {
        const [apptRes, pipeRes] = await Promise.all([
          supabase
            .from('mana_appointments')
            .select('patient_code, appointment_type, appointment_date, status')
            .not('patient_code', 'is', null),
          supabase
            .from('mana_pipeline')
            .select('patient_code, converted, program')
            .eq('converted', true),
        ]);
        if (apptRes.error) throw apptRes.error;
        if (pipeRes.error) throw pipeRes.error;

        const appts = (apptRes.data || []) as ApptRow[];
        const pipes = (pipeRes.data || []) as PipelineRow[];
        const pipeByCode = new Map<string, string>();
        for (const p of pipes) {
          if (p.patient_code && p.program) pipeByCode.set(p.patient_code, p.program);
        }

        const today = new Date().toISOString().slice(0, 10);
        const byCode = new Map<string, Client>();
        for (const a of appts) {
          if (!a.patient_code) continue;
          let c = byCode.get(a.patient_code);
          if (!c) {
            c = { code: a.patient_code, program: '—', visits: 0, first_visit: null, last_visit: null, next_visit: null, status: 'Active' };
            byCode.set(a.patient_code, c);
          }
          c.visits++;
          if (a.appointment_date <= today) {
            if (!c.first_visit || a.appointment_date < c.first_visit) c.first_visit = a.appointment_date;
            if (!c.last_visit || a.appointment_date > c.last_visit) {
              c.last_visit = a.appointment_date;
              c.program = pipeByCode.get(a.patient_code) || TYPE_PROGRAM[a.appointment_type] || '—';
            }
          } else {
            if (!c.next_visit || a.appointment_date < c.next_visit) c.next_visit = a.appointment_date;
          }
        }

        for (const c of byCode.values()) {
          if (c.next_visit) c.status = 'Scheduled';
          else if (!c.last_visit) c.status = 'Active';
          else {
            const d = daysAgo(c.last_visit);
            c.status = d > 60 ? 'Lapsed' : d > 30 ? 'Slowing' : 'Active';
          }
        }

        setClients([...byCode.values()]);
      } catch (err: any) {
        setError(err.message || 'Failed to load clients');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const programs = useMemo(() => {
    const s = new Set(clients.map(c => c.program).filter(p => p && p !== '—'));
    return [...s].sort();
  }, [clients]);

  const visible = useMemo(() => {
    let list = clients;
    if (query.trim()) {
      const q = query.trim().toUpperCase();
      list = list.filter(c => c.code.includes(q));
    }
    if (programFilter !== 'all') list = list.filter(c => c.program === programFilter);
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter);

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'code':
          return a.code.localeCompare(b.code);
        case 'program':
          return a.program.localeCompare(b.program) || a.code.localeCompare(b.code);
        case 'last':
          return (b.last_visit || '').localeCompare(a.last_visit || '');
        case 'next':
        default: {
          const na = a.next_visit ? 0 : 1;
          const nb = b.next_visit ? 0 : 1;
          if (na !== nb) return na - nb;
          return (a.next_visit || b.last_visit || '').localeCompare(b.next_visit || a.last_visit || '');
        }
      }
    });
  }, [clients, query, programFilter, statusFilter, sortBy]);

  const stats = useMemo(() => {
    const active = clients.filter(c => c.status === 'Active' || c.status === 'Scheduled').length;
    const scheduled = clients.filter(c => c.status === 'Scheduled').length;
    const lapsed = clients.filter(c => c.status === 'Lapsed').length;
    return { total: clients.length, active, scheduled, lapsed };
  }, [clients]);

  if (loading) return <div className="spinner" style={{ marginTop: 40 }} />;

  return (
    <div>
      <div className="page-header">
        <h1>Clients</h1>
        <p>Active roster — derived from Jane appointments</p>
      </div>

      {/* Compact single-row summary */}
      <div className="clients-summary">
        <span><strong>{stats.total}</strong> total</span>
        <span className="dot-sep">·</span>
        <span><strong>{stats.active}</strong> active</span>
        <span className="dot-sep">·</span>
        <span><strong>{stats.scheduled}</strong> with next visit</span>
        <span className="dot-sep">·</span>
        <span style={{ color: stats.lapsed ? 'var(--danger)' : undefined }}><strong>{stats.lapsed}</strong> lapsed 60d+</span>
      </div>

      {/* Toolbar: search + filters + sort */}
      <div className="clients-toolbar">
        <input
          className="input"
          placeholder="Search MANA code…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ maxWidth: 200 }}
        />
        <select className="input" value={programFilter} onChange={e => setProgramFilter(e.target.value)} style={{ maxWidth: 170 }}>
          <option value="all">All programs</option>
          {programs.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: 150 }}>
          <option value="all">All statuses</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Active">Active</option>
          <option value="Slowing">Slowing</option>
          <option value="Lapsed">Lapsed</option>
        </select>
        <select className="input" value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} style={{ maxWidth: 160 }}>
          <option value="next">Sort: Next visit</option>
          <option value="last">Sort: Last visit</option>
          <option value="code">Sort: MANA code</option>
          <option value="program">Sort: Program</option>
        </select>
      </div>

      {error && <div className="empty-state" style={{ marginTop: 20 }}><p style={{ color: 'var(--danger)' }}>{error}</p></div>}

      {!error && visible.length === 0 && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <h3>No clients found</h3>
          <p>{clients.length === 0 ? 'Clients appear here once they have appointments in Jane.' : 'Try adjusting your filters.'}</p>
        </div>
      )}

      {!error && visible.length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '130px 1.4fr 110px 110px 70px 90px',
            gap: 6, padding: '10px 16px', background: 'var(--gray-50)',
            borderBottom: '1px solid var(--gray-200)', fontSize: 11, fontWeight: 600,
            color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            <span>Client</span>
            <span>Program</span>
            <span>Last Visit</span>
            <span>Next Visit</span>
            <span style={{ textAlign: 'center' }}>Visits</span>
            <span style={{ textAlign: 'center' }}>Status</span>
          </div>
          {visible.map(c => (
            <div key={c.code} style={{
              display: 'grid', gridTemplateColumns: '130px 1.4fr 110px 110px 70px 90px',
              gap: 6, padding: '9px 16px', alignItems: 'center', fontSize: 13,
              borderBottom: '1px solid var(--gray-100)',
            }}>
              <span style={{ fontWeight: 700, color: 'var(--gray-800)', letterSpacing: '-0.2px' }}>{c.code}</span>
              <span style={{ fontSize: 12, color: c.program === '—' ? 'var(--gray-400)' : 'var(--gray-700)' }}>{c.program}</span>
              <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{fmtDate(c.last_visit)}</span>
              <span style={{ fontSize: 12, color: c.next_visit ? 'var(--blue-700)' : 'var(--gray-400)', fontWeight: c.next_visit ? 600 : 400 }}>{fmtDate(c.next_visit)}</span>
              <span style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-600)', fontVariantNumeric: 'tabular-nums' }}>{c.visits}</span>
              <span style={{ textAlign: 'center' }}>
                <span className={`badge ${c.status === 'Active' ? 'badge-green' : c.status === 'Scheduled' ? 'badge-blue' : c.status === 'Slowing' ? 'badge-yellow' : 'badge-red'}`}>
                  {c.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
