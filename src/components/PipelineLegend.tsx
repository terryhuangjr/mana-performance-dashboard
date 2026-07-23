interface Props {
  readOnly: boolean;
}

export default function PipelineLegend({ readOnly }: Props) {
  if (readOnly) return null;

  const items = [
    { label: 'New — Not contacted yet', border: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Contacted — Pending response', border: '#F59E0B', bg: '#FFFBEB' },
    { label: 'Follow-up needed — 8+ days or flagged', border: '#EF4444', bg: '#FEF2F2' },
    { label: 'Converted — Signed up for program', border: '#10B981', bg: '#F0FDF4' },
  ];

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, padding: '8px 0' }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--gray-500)' }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, borderLeft: `3px solid ${item.border}`, background: item.bg }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
