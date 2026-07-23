interface Props {
  totalEvals: number;
  convertedCount: number;
  conversionRate: number;
  needsFollowup: number;
  newCount: number;
}

export default function HeaderStats({ totalEvals, convertedCount, conversionRate, needsFollowup, newCount }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 4 }}>
      {[
        { label: 'Total Evals', value: totalEvals, color: 'var(--blue)', bg: '#DBEAFE' },
        { label: 'New', value: newCount, color: '#1E40AF', bg: '#EFF6FF' },
        { label: 'Converted', value: convertedCount, color: '#065F46', bg: '#D1FAE5' },
        { label: 'Rate', value: `${conversionRate}%`, color: 'var(--blue)', bg: '#DBEAFE' },
        { label: 'Follow-up', value: needsFollowup, color: needsFollowup > 0 ? '#92400E' : 'var(--gray-500)', bg: needsFollowup > 0 ? '#FEF3C7' : '#F3F4F6' },
      ].map(stat => (
        <div key={stat.label} className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: stat.color, lineHeight: 1.1 }}>{stat.value}</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4, fontWeight: 500 }}>{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
