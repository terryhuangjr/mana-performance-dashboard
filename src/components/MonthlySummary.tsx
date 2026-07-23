import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface MonthlyStats {
  month: number;
  year: number;
  totalAppointments: number;
  totalEvals: number;
  totalFollowUps: number;
  totalVisits: number;
  totalCancels: number;
  pipelineConverted: number;
  pipelineTotal: number;
  byProgram: { program: string; evals: number; visits: number; followUps: number; cancels: number }[];
}

interface Props {
  month: number;
  year: number;
  pipelineEvals: number;
  pipelineConverted: number;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function MonthlySummary({ month, year, pipelineEvals, pipelineConverted }: Props) {
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, [month, year]);

  async function fetchStats() {
    setLoading(true);
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayNum = new Date(year, month, 0).getDate();
    const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

    try {
      const { data: apptData, error: apptErr } = await supabase
        .from('mana_appointments')
        .select('appointment_type, status, duration_minutes')
        .gte('appointment_date', firstDay)
        .lte('appointment_date', lastDay);

      if (apptErr) throw apptErr;

      const appts = apptData || [];
      const totalAppointments = appts.length;
      const cancels = appts.filter(a => a.status === 'cancelled').length;

      const evals = appts.filter(a =>
        a.status !== 'cancelled' && (
          (a.appointment_type || '').toLowerCase().includes('eval') ||
          (a.appointment_type || '').toLowerCase().includes('initial')
        )
      ).length;

      const followUps = appts.filter(a =>
        a.status !== 'cancelled' &&
        (a.appointment_type || '').toLowerCase().includes('follow')
      ).length;

      const visits = totalAppointments - cancels - evals - followUps;

      const programMap = new Map<string, { evals: number; visits: number; followUps: number; cancels: number }>();

      for (const a of appts) {
        const type = a.appointment_type || 'Other';
        let prog = 'Therapy';
        if (type.toLowerCase().includes('training')) prog = 'Training';
        else if (type.toLowerCase().includes('golf')) prog = 'Golf';
        else if (type.toLowerCase().includes('restorative')) prog = 'Restorative';
        else if (type.toLowerCase().includes('open')) prog = 'Other';

        if (!programMap.has(prog)) programMap.set(prog, { evals: 0, visits: 0, followUps: 0, cancels: 0 });
        const p = programMap.get(prog)!;
        if (a.status === 'cancelled') p.cancels++;
        else if (type.toLowerCase().includes('eval') || type.toLowerCase().includes('initial')) p.evals++;
        else if (type.toLowerCase().includes('follow')) p.followUps++;
        else p.visits++;
      }

      setStats({
        month, year,
        totalAppointments, totalEvals: evals, totalFollowUps: followUps,
        totalVisits: visits, totalCancels: cancels,
        pipelineConverted, pipelineTotal: pipelineEvals,
        byProgram: Array.from(programMap.entries()).map(([program, counts]) => ({ program, ...counts })),
      });
    } catch (err) {
      console.error('Failed to load monthly stats:', err);
    } finally { setLoading(false); }
  }

  const conversionRate = stats?.pipelineTotal ? Math.round((stats.pipelineConverted / stats.pipelineTotal) * 100) : 0;

  return (
    <div className="card" style={{ padding: '20px', marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Monthly Summary — {MONTHS[month - 1]} {year}
      </div>

      {loading ? (
        <div className="spinner" style={{ margin: '16px auto' }} />
      ) : stats ? (
        <>
          {/* Main stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total Appts', value: stats.totalAppointments, desc: 'All bookings in Jane', color: 'var(--blue-600)', bg: 'var(--blue-50)' },
              { label: 'Evals', value: stats.totalEvals, desc: 'First-time visits', color: 'var(--blue-600)', bg: 'var(--blue-50)' },
              { label: 'Follow-ups', value: stats.totalFollowUps, desc: 'Return sessions', color: '#065F46', bg: '#D1FAE5' },
              { label: 'Visits', value: stats.totalVisits, desc: 'Other appts', color: '#1E40AF', bg: '#EFF6FF' },
              { label: 'Cancelled', value: stats.totalCancels, desc: 'From total appts', color: '#991B1B', bg: '#FEE2E2' },
              { label: 'Pipeline Evals', value: stats.pipelineTotal, desc: 'Tracked in pipeline', color: 'var(--blue-600)', bg: 'var(--blue-50)' },
              { label: 'Converted', value: stats.pipelineConverted, desc: `${conversionRate}% conversion`, color: '#065F46', bg: '#D1FAE5' },
            ].map(stat => (
              <div key={stat.label} style={{ background: stat.bg, borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4, fontWeight: 600, letterSpacing: '0.02em' }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 1 }}>
                  {stat.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Program breakdown */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              By Program (from Jane appointment types)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              {stats.byProgram.map(p => (
                <div key={p.program} style={{ background: 'var(--gray-50)', borderRadius: 6, padding: '10px 12px', fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>{p.program}</div>
                  <div style={{ display: 'flex', gap: 10, color: 'var(--gray-500)', flexWrap: 'wrap' }}>
                    <span>{p.evals} eval{p.evals !== 1 ? 's' : ''}</span>
                    <span>{p.followUps} follow-up{p.followUps !== 1 ? 's' : ''}</span>
                    <span>{p.visits} visit{p.visits !== 1 ? 's' : ''}</span>
                    {p.cancels > 0 && <span style={{ color: 'var(--danger)' }}>{p.cancels} cancel{p.cancels !== 1 ? 's' : ''}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: 13, padding: 16 }}>
          Could not load monthly data.
        </div>
      )}
    </div>
  );
}
