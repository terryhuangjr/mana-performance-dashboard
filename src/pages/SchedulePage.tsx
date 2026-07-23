import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import AppointmentCard from '../components/AppointmentCard';
import AppointmentDetail from '../components/AppointmentDetail';
import PatientHistoryPanel from '../components/PatientHistoryPanel';
import AddEventModal from '../components/AddEventModal';

interface Appointment {
  id: string;
  patient_name: string;
  appointment_type: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: string;
  source?: string;
  raw_summary: string;
  notes?: string;
}

interface PipelineEntry {
  first_name: string;
  last_initial: string;
  eval_date: string;
  contacted: boolean;
  converted: boolean | null;
  program: string | null;
  notes: string | null;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getMonthDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

function getWeekDates(ref: Date): Date[] {
  const day = ref.getDay();
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function SchedulePage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'month' | 'week'>('month');
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [weekOffset, setWeekOffset] = useState(0);

  // Detail modal state
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  // Patient history panel state
  const [patientHistory, setPatientHistory] = useState<{ name: string; appointments: Appointment[]; pipeline: PipelineEntry | null } | null>(null);

  // Add Event modal state
  const [showAddEvent, setShowAddEvent] = useState(false);

  useEffect(() => { fetchAppointments(); }, []);

  async function fetchAppointments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mana_appointments')
        .select('*')
        .order('appointment_time', { ascending: true });
      if (error) throw error;
      setAppointments(data || []);
    } catch (err: any) {
      console.error('Failed to load:', err);
    } finally { setLoading(false); }
  }

  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;

  const hasAppts = (day: number) =>
    appointments.some(a => a.appointment_date === `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`);

  const monthDays = getMonthDays(year, month);
  const selectedDateStr = `${year}-${String(month).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`;
  const selectedAppts = appointments.filter(a => a.appointment_date === selectedDateStr);
  const confirmedAppts = selectedAppts.filter(a => a.status !== 'cancelled');
  const cancelledAppts = selectedAppts.filter(a => a.status === 'cancelled');

  // Week view
  const weekRef = new Date(today);
  weekRef.setDate(today.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(weekRef);

  const weekApptsByDay = weekDates.map(d => {
    const ds = d.toISOString().split('T')[0];
    return {
      date: d,
      appts: appointments.filter(a => a.appointment_date === ds),
    };
  });

  function handlePatientClick(name: string) {
    // Find pipeline entry for this patient
    const nameParts = name.split(' ');
    const firstName = nameParts[0];

    supabase
      .from('mana_pipeline')
      .select('*')
      .ilike('first_name', firstName)
      .then(({ data }) => {
        const pipeline = data && data.length > 0 ? data[0] as PipelineEntry : null;
        const patientAppts = appointments.filter(a =>
          a.patient_name?.toLowerCase().includes(firstName.toLowerCase())
        );
        setPatientHistory({ name, appointments: patientAppts, pipeline });
      });
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Schedule</h1>
          <p>View and manage daily appointments</p>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button className="btn btn-sm btn-primary" onClick={() => setShowAddEvent(true)}>+ Add Event</button>
          <button className={`btn btn-sm ${view === 'month' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('month')}>Month</button>
          <button className={`btn btn-sm ${view === 'week' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('week')}>Week</button>
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : view === 'month' ? (
        /* ───── MONTH VIEW ───── */
        <div className="schedule-month-wrap" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div className="card" style={{ flex: '1 1 460px', minWidth: 320, padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <button className="btn-icon" onClick={() => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }}>←</button>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-800)', letterSpacing: '-0.3px' }}>
                {MONTHS[month - 1]} {year}
              </span>
              <button className="btn-icon" onClick={() => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }}>→</button>
            </div>

            <div className="calendar-grid">
              {DAYS.map(d => <div key={d} className="calendar-day-header">{d}</div>)}
              {monthDays.map((day, i) => (
                <div key={i}
                  className={`calendar-day ${day === null ? 'other-month' : ''} ${day !== null && isToday(day) ? 'today' : ''} ${day === selectedDay ? 'selected' : ''} ${day !== null && hasAppts(day) ? 'has-appts' : ''}`}
                  onClick={() => day !== null && setSelectedDay(day)}
                >
                  {day !== null && <span>{day}</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ flex: '0 0 360px', padding: '24px', alignSelf: 'flex-start' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {new Date(selectedDateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>

            {confirmedAppts.length === 0 && cancelledAppts.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <h3>No appointments</h3>
                <p>Nothing scheduled for this day.</p>
              </div>
            ) : (
              <>
                {confirmedAppts.map(appt => (
                  <div key={appt.id} onClick={() => setSelectedAppt(appt)} style={{ cursor: 'pointer' }}>
                    <AppointmentCard appointment={appt} onPatientClick={handlePatientClick} />
                  </div>
                ))}
                {cancelledAppts.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cancelled</div>
                    {cancelledAppts.map(appt => (
                      <div key={appt.id} onClick={() => setSelectedAppt(appt)} style={{ cursor: 'pointer' }}>
                        <AppointmentCard appointment={appt} onPatientClick={handlePatientClick} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* ───── WEEK VIEW ───── */
        <div>
          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w - 1)}>← Prev Week</button>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-700)', textAlign: 'center' }}>
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w + 1)}>Next Week →</button>
          </div>

          {/* Day columns */}
          <div className="week-grid">
            {weekApptsByDay.map(({ date, appts }) => {
              const isToday = date.toDateString() === today.toDateString();
              const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');

              return (
                <div key={date.toISOString()} className="card" style={{
                  padding: '12px 8px',
                  minHeight: 200,
                  borderColor: isToday ? 'var(--blue-500)' : undefined,
                  borderWidth: isToday ? 2 : 1,
                }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: isToday ? 'var(--blue-600)' : 'var(--gray-500)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    marginBottom: 8,
                    textAlign: 'center',
                  }}>
                    {dayLabel}
                  </div>

                  {appts.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--gray-300)', textAlign: 'center', marginTop: 16 }}>
                      No appts
                    </div>
                  ) : (
                    appts
                      .sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''))
                      .map(appt => (
                        <div key={appt.id} onClick={() => setSelectedAppt(appt)} style={{
                          cursor: 'pointer',
                          fontSize: 11,
                          padding: '4px 6px',
                          marginBottom: 4,
                          borderRadius: 4,
                          background: appt.status === 'cancelled' ? '#F9FAFB' : '#EFF6FF',
                          borderLeft: `2px solid ${appt.status === 'cancelled' ? '#D1D5DB' : '#3B82F6'}`,
                          opacity: appt.status === 'cancelled' ? 0.5 : 1,
                        }}>
                          <div style={{ fontWeight: 600, color: 'var(--gray-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {appt.patient_name}
                          </div>
                          <div style={{ color: 'var(--gray-500)' }}>
                            {appt.appointment_time?.substring(0, 5)}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Appointment Detail Modal */}
      {selectedAppt && (
        <AppointmentDetail
          appointment={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onPatientClick={handlePatientClick}
          onSaved={fetchAppointments}
        />
      )}

      {/* Patient History Panel */}
      {patientHistory && (
        <PatientHistoryPanel
          patientName={patientHistory.name}
          appointments={patientHistory.appointments}
          pipeline={patientHistory.pipeline}
          onClose={() => setPatientHistory(null)}
        />
      )}

      {/* Add Event Modal */}
      {showAddEvent && (
        <AddEventModal
          defaultDate={selectedDateStr}
          onClose={() => setShowAddEvent(false)}
          onSaved={() => { setShowAddEvent(false); fetchAppointments(); }}
        />
      )}
    </div>
  );
}
