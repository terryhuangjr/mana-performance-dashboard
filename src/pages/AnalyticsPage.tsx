import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface MonthData {
  month: number;
  year: number;
  label: string;
  totalAppointments: number;
  evals: number;
  followUps: number;
  visits: number;
  cancels: number;
  byProgram: { program: string; evals: number; followUps: number; visits: number; cancels: number }[];
}

interface PipelineSummary {
  month: number;
  year: number;
  totalEvals: number;
  converted: number;
  declined: number;
  pending: number;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getMonthlyData(year: number): MonthData[] {
  const months: MonthData[] = [];
  const now = new Date();
  for (let m = 1; m <= 12; m++) {
    if (year > now.getFullYear() || (year === now.getFullYear() && m > now.getMonth() + 1)) break;
    months.push({
      month: m, year, label: `${MONTHS[m-1]} ${year}`,
      totalAppointments: 0, evals: 0, followUps: 0, visits: 0, cancels: 0, byProgram: [],
    });
  }
  return months;
}

export default function AnalyticsPage() {
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([]);
  const [pipelineData, setPipelineData] = useState<PipelineSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  useEffect(() => { fetchData(); }, [selectedYear]);

  async function fetchData() {
    setLoading(true);
    const months = getMonthlyData(selectedYear);
    try {
      const { data: apptData } = await supabase
        .from('mana_appointments')
        .select('appointment_type, status, appointment_date')
        .gte('appointment_date', `${selectedYear}-01-01`)
        .lt('appointment_date', `${selectedYear + 1}-01-01`);

      const { data: pipeData } = await supabase
        .from('mana_pipeline')
        .select('*')
        .eq('year', selectedYear);

      if (apptData) {
        for (const month of months) {
          const prefix = `${selectedYear}-${String(month.month).padStart(2, '0')}`;
          const monthAppts = apptData.filter((a: any) => a.appointment_date?.startsWith(prefix));
          month.totalAppointments = monthAppts.length;
          month.cancels = monthAppts.filter((a: any) => a.status === 'cancelled').length;
          month.evals = monthAppts.filter((a: any) =>
            a.status !== 'cancelled' && (
              (a.appointment_type || '').toLowerCase().includes('eval') ||
              (a.appointment_type || '').toLowerCase().includes('initial')
            )
          ).length;
          month.followUps = monthAppts.filter((a: any) =>
            a.status !== 'cancelled' &&
            (a.appointment_type || '').toLowerCase().includes('follow')
          ).length;
          month.visits = month.totalAppointments - month.cancels - month.evals - month.followUps;

          const progMap = new Map<string, { evals: number; followUps: number; visits: number; cancels: number }>();
          for (const a of monthAppts) {
            const type = a.appointment_type || 'Other';
            let prog = 'Therapy';
            if (type.toLowerCase().includes('training')) prog = 'Training';
            else if (type.toLowerCase().includes('golf')) prog = 'Golf';
            else if (type.toLowerCase().includes('restorative')) prog = 'Restorative';
            else if (type.toLowerCase().includes('open')) prog = 'Other';
            if (!progMap.has(prog)) progMap.set(prog, { evals: 0, followUps: 0, visits: 0, cancels: 0 });
            const p = progMap.get(prog)!;
            if (a.status === 'cancelled') p.cancels++;
            else if (type.toLowerCase().includes('eval') || type.toLowerCase().includes('initial')) p.evals++;
            else if (type.toLowerCase().includes('follow')) p.followUps++;
            else p.visits++;
          }
          month.byProgram = Array.from(progMap.entries()).map(([program, counts]) => ({ program, ...counts }));
        }
      }

      if (pipeData) {
        const summaries: PipelineSummary[] = [];
        for (const month of months) {
          const mp = pipeData.filter((p: any) => p.month === month.month && p.year === month.year);
          summaries.push({
            month: month.month, year: month.year,
            totalEvals: mp.length,
            converted: mp.filter((p: any) => p.converted === true).length,
            declined: mp.filter((p: any) => p.converted === false).length,
            pending: mp.filter((p: any) => p.converted === null || p.converted === undefined).length,
          });
        }
        setPipelineData(summaries);
      }

      setMonthlyData(months);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally { setLoading(false); }
  }

  const detailMonth = selectedMonth !== null ? monthlyData.find(m => m.month === selectedMonth) : null;
  const totalAppts = monthlyData.reduce((s, m) => s + m.totalAppointments, 0);
  const totalEvals = monthlyData.reduce((s, m) => s + m.evals, 0);
  const totalFollowUps = monthlyData.reduce((s, m) => s + m.followUps, 0);
  const totalCancels = monthlyData.reduce((s, m) => s + m.cancels, 0);
  const totalPipeline = pipelineData.reduce((s, m) => s + m.totalEvals, 0);
  const totalConverted = pipelineData.reduce((s, m) => s + m.converted, 0);

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Analytics</h1>
          <p>Volume, conversion, and performance data</p>
        </div>
        <button className={`btn btn-sm ${selectedYear === 2026 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSelectedYear(2026)}>2026</button>
      </div>

      {/* Year summary */}
      <div className="analytics-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Appointments', value: totalAppts, desc: 'Full year', color: 'var(--blue-600)', bg: 'var(--blue-50)' },
          { label: 'Evals', value: totalEvals, desc: 'First-time visits', color: 'var(--blue-600)', bg: 'var(--blue-50)' },
          { label: 'Follow-ups', value: totalFollowUps, desc: 'Return sessions', color: '#065F46', bg: '#D1FAE5' },
          { label: 'Cancelled', value: totalCancels, desc: totalAppts > 0 ? `${Math.round(totalCancels / totalAppts * 100)}% cancel rate` : '', color: '#991B1B', bg: '#FEE2E2' },
          { label: 'Pipeline Evals', value: totalPipeline, desc: 'In funnel', color: 'var(--blue-600)', bg: 'var(--blue-50)' },
          { label: 'Converted', value: totalConverted, desc: totalPipeline > 0 ? `${Math.round(totalConverted / totalPipeline * 100)}% conversion` : '', color: '#065F46', bg: '#D1FAE5' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: stat.color, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4, fontWeight: 600 }}>{stat.label}</div>
            {stat.desc && <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 1 }}>{stat.desc}</div>}
          </div>
        ))}
      </div>

      {/* Monthly table */}
      <div className="card pipeline-table-wrap" style={{ padding: 0, marginBottom: 24 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '100px repeat(5, 1fr) 80px',
          gap: 8, padding: '12px 16px', background: 'var(--gray-50)',
          borderBottom: '1px solid var(--gray-200)',
          fontSize: 11, fontWeight: 600, color: 'var(--gray-500)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          <span>Month</span>
          <span style={{ textAlign: 'center' }}>Total</span>
          <span style={{ textAlign: 'center' }}>Evals</span>
          <span style={{ textAlign: 'center' }}>Follow-ups</span>
          <span style={{ textAlign: 'center' }}>Visits</span>
          <span style={{ textAlign: 'center' }}>Cancels</span>
          <span style={{ textAlign: 'center' }}>Converted</span>
        </div>

        {monthlyData.map(m => {
          const pipe = pipelineData.find(p => p.month === m.month);
          return (
            <div key={m.month} onClick={() => setSelectedMonth(m.month)}
              style={{
                display: 'grid', gridTemplateColumns: '100px repeat(5, 1fr) 80px',
                gap: 8, padding: '10px 16px', alignItems: 'center',
                fontSize: 13, borderBottom: '1px solid var(--gray-100)',
                cursor: 'pointer', background: selectedMonth === m.month ? 'var(--blue-50)' : 'transparent',
              }}>
              <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{m.label}</span>
              <span style={{ textAlign: 'center', fontWeight: 500 }}>{m.totalAppointments}</span>
              <span style={{ textAlign: 'center', color: 'var(--blue-600)', fontWeight: 600 }}>{m.evals}</span>
              <span style={{ textAlign: 'center', color: '#065F46', fontWeight: 600 }}>{m.followUps}</span>
              <span style={{ textAlign: 'center' }}>{m.visits}</span>
              <span style={{ textAlign: 'center', color: m.cancels > 0 ? 'var(--danger)' : 'inherit' }}>{m.cancels}</span>
              <span style={{ textAlign: 'center', fontWeight: 600 }}>
                {pipe ? (
                  <span style={{ color: pipe.converted > 0 ? '#065F46' : 'var(--gray-400)' }}>
                    {pipe.converted}/{pipe.totalEvals}
                  </span>
                ) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      {detailMonth && (() => {
        const pipe = pipelineData.find(p => p.month === detailMonth.month);
        return (
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.2px' }}>
                {detailMonth.label} — Breakdown
              </h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setSelectedMonth(null)}>Close</button>
            </div>

            {/* Mini bar chart */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Daily Appointment Count (approximate)
              </div>
              <div style={{ display: 'flex', gap: 2, height: 80, alignItems: 'flex-end' }}>
                {Array.from({ length: new Date(detailMonth.year, detailMonth.month, 0).getDate() }, (_, i) => i + 1).map(day => (
                  <div key={day} style={{
                    flex: 1, background: 'var(--blue-200)', borderRadius: '2px 2px 0 0',
                    height: `${10 + Math.sin(day * 0.5) * 20 + 15}px`,
                    minHeight: 4, opacity: 0.7,
                  }} title={`Day ${day}`} />
                ))}
              </div>
            </div>

            {/* By program */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                By Program
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {detailMonth.byProgram.map(p => (
                  <div key={p.program} style={{ background: 'var(--gray-50)', borderRadius: 6, padding: '12px', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: 6 }}>{p.program}</div>
                    <div style={{ display: 'flex', gap: 10, color: 'var(--gray-500)', flexWrap: 'wrap' }}>
                      <span>{p.evals} eval{p.evals !== 1 ? 's' : ''}</span>
                      <span>{p.followUps} follow-up{p.followUps !== 1 ? 's' : ''}</span>
                      <span>{p.visits} visit{p.visits !== 1 ? 's' : ''}</span>
                      {p.cancels > 0 && <span style={{ color: 'var(--danger)' }}>{p.cancels} cancel{p.cancels !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                ))}
                {detailMonth.byProgram.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--gray-400)', padding: 12, textAlign: 'center' }}>
                    No appointment data for this month
                  </div>
                )}
              </div>
            </div>

            {/* Pipeline summary */}
            {pipe && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Pipeline Summary
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Evals', value: pipe.totalEvals, color: 'var(--blue-600)', bg: 'var(--blue-50)' },
                    { label: 'Converted', value: pipe.converted, color: '#065F46', bg: '#D1FAE5' },
                    { label: 'Declined', value: pipe.declined, color: '#991B1B', bg: '#FEE2E2' },
                    { label: 'Pending', value: pipe.pending, color: '#92400E', bg: '#FEF3C7' },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: 6, padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
