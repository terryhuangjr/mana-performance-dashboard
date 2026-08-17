import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface LedgerEntry {
  id: string;
  task_description: string;
  category: string;
  completed_at: string;
  time_saved_minutes: number;
  hourly_rate: number | null;
  dollar_value: number | null;
  verified: boolean;
  notes: string | null;
  source: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  admin: 'Admin & Filing',
  operations: 'Operations & Pipeline',
  communication: 'Communication & Briefs',
  inventory: 'Inventory & Alerts',
  reporting: 'Reports & Analysis',
  content: 'Content & Marketing',
  sync: 'Syncing & Scheduling',
};

const CATEGORY_COLORS: Record<string, string> = {
  admin: '#64748b', operations: '#0ea5e9', communication: '#8b5cf6',
  inventory: '#f59e0b', reporting: '#10b981', content: '#ec4899', sync: '#14b8a6',
};

function weekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = (day === 0 ? 6 : day - 1); // Monday start
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  const end = new Date(monday);
  end.setDate(monday.getDate() + 7);
  return { start: monday.toISOString(), end: end.toISOString() };
}

function fmtHours(min: number): string {
  const h = min / 60;
  return h >= 1 ? `${h % 1 ? h.toFixed(1) : h} hrs` : `${min} min`;
}

export default function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { start, end } = useMemo(weekBounds, []);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('value_ledger_entries')
          .select('*')
          .eq('client', 'mana')
          .order('completed_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        setEntries(data || []);
      } catch (err: any) {
        console.error('Failed to load ledger:', err);
      } finally { setLoading(false); }
    })();
  }, [start, end]);

  const weekEntries = useMemo(
    () => entries.filter(e => e.completed_at >= start && e.completed_at < end),
    [entries, start, end]
  );

  // Lifetime totals (all entries)
  const totalTasks = entries.length;
  const totalMinutes = entries.reduce((s, e) => s + (e.time_saved_minutes || 0), 0);
  const totalValue = entries.reduce((s, e) => s + (e.dollar_value || 0), 0);
  const unpriced = entries.filter(e => !e.dollar_value).length;

  // 8-week trend (Mon-start buckets)
  const trend = useMemo(() => {
    const weeks: { label: string; minutes: number; value: number }[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) - i * 7);
      monday.setHours(0, 0, 0, 0);
      const next = new Date(monday);
      next.setDate(monday.getDate() + 7);
      const isoStart = monday.toISOString();
      const isoEnd = next.toISOString();
      let minutes = 0, value = 0;
      for (const e of entries) {
        if (e.completed_at >= isoStart && e.completed_at < isoEnd) {
          minutes += e.time_saved_minutes || 0;
          value += e.dollar_value || 0;
        }
      }
      weeks.push({
        label: monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        minutes, value,
      });
    }
    return weeks;
  }, [entries]);
  const maxTrendMin = Math.max(1, ...trend.map(w => w.minutes));
  const fmtMoney = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Category rollup
  const byCat = useMemo(() => {
    const map: Record<string, { tasks: number; minutes: number; value: number }> = {};
    for (const e of entries) {
      const c = map[e.category] || { tasks: 0, minutes: 0, value: 0 };
      c.tasks += 1;
      c.minutes += e.time_saved_minutes || 0;
      c.value += e.dollar_value || 0;
      map[e.category] = c;
    }
    return Object.entries(map).sort((a, b) => b[1].minutes - a[1].minutes);
  }, [entries]);

  const maxCatMinutes = Math.max(1, ...byCat.map(([, v]) => v.minutes));

  const cardStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
    padding: '18px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' };
  const valueStyle: React.CSSProperties = { fontSize: 26, fontWeight: 700, color: '#111827', marginTop: 6 };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🤖 Agent Tracker — Value Saved</h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Week of {new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#6b7280' }}>Loading ledger…</div>
      ) : (
        <>
          {/* Agent impact — lifetime */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div style={{ ...cardStyle, background: '#0f172a', borderColor: '#0f172a' }}>
              <div style={{ ...labelStyle, color: '#94a3b8' }}>Agent time saved (all time)</div>
              <div style={{ ...valueStyle, color: '#fff' }}>~{fmtHours(totalMinutes)}</div>
            </div>
            <div style={{ ...cardStyle, background: '#0f172a', borderColor: '#0f172a' }}>
              <div style={{ ...labelStyle, color: '#94a3b8' }}>Money saved (all time)</div>
              <div style={{ ...valueStyle, color: '#34d399' }}>{fmtMoney(totalValue)}</div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>Automations run</div>
              <div style={valueStyle}>{totalTasks}</div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>Unpriced (verify)</div>
              <div style={{ ...valueStyle, color: unpriced ? '#d97706' : '#111827' }}>{unpriced}</div>
            </div>
          </div>

          {/* 8-week trend */}
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <div style={{ ...labelStyle, marginBottom: 12 }}>Time saved — last 8 weeks</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 110 }}>
              {trend.map((w, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{w.minutes > 0 ? `${Math.round(w.minutes / 60 * 10) / 10}h` : ''}</div>
                  <div style={{
                    width: '100%', maxWidth: 44, height: `${Math.max(4, (w.minutes / maxTrendMin) * 76)}px`,
                    background: w.minutes > 0 ? '#0ea5e9' : '#e5e7eb', borderRadius: '6px 6px 0 0',
                  }} />
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{w.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary cards — this week */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div style={cardStyle}>
              <div style={labelStyle}>Tasks completed</div>
              <div style={valueStyle}>{weekEntries.length}</div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>Time saved</div>
              <div style={valueStyle}>~{fmtHours(weekEntries.reduce((s, e) => s + (e.time_saved_minutes || 0), 0))}</div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>Value delivered</div>
              <div style={{ ...valueStyle, color: '#059669' }}>{fmtMoney(weekEntries.reduce((s, e) => s + (e.dollar_value || 0), 0))}</div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>This week</div>
              <div style={valueStyle}>{weekEntries.filter(e => e.verified).length}/{weekEntries.length} ✓</div>
            </div>
          </div>

          {/* Category breakdown */}
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <div style={{ ...labelStyle, marginBottom: 12 }}>By category</div>
            {byCat.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: 14 }}>No entries this week yet.</div>
            ) : byCat.map(([cat, v]) => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{CATEGORY_LABELS[cat] || cat}</span>
                  <span style={{ color: '#6b7280' }}>{v.tasks} tasks · {fmtHours(v.minutes)} · ${v.value.toFixed(2)}</span>
                </div>
                <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(v.minutes / maxCatMinutes) * 100}%`, background: CATEGORY_COLORS[cat] || '#6366f1', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Entries table */}
          <div style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: 12 }}>Entries this week</div>
            {weekEntries.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: 14 }}>Quiet week — no tasks logged.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '8px 10px' }}>Task</th>
                    <th style={{ padding: '8px 10px' }}>Category</th>
                    <th style={{ padding: '8px 10px' }}>When</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Time</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Value</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>✓</th>
                  </tr>
                </thead>
                <tbody>
                  {weekEntries.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 10px', color: '#111827' }}>{e.task_description}</td>
                      <td style={{ padding: '8px 10px', color: '#374151' }}>{CATEGORY_LABELS[e.category] || e.category}</td>
                      <td style={{ padding: '8px 10px', color: '#6b7280' }}>
                        {new Date(e.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#374151' }}>{e.time_saved_minutes} min</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: e.dollar_value ? '#059669' : '#d97706' }}>
                        {e.dollar_value ? `$${e.dollar_value.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: e.verified ? '#059669' : '#9ca3af' }}>
                        {e.verified ? '✅' : '○'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
