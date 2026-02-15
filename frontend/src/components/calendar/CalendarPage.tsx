import { useState, useCallback } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth";
import { useBand } from "../../hooks/useBand";
import { EventModal } from "./EventModal";
import styles from "./CalendarPage.module.css";

export interface CalendarEvent {
  id: string;
  title: string;
  type: "gig" | "rehearsal" | "studio" | "deadline" | "other";
  start: string; // ISO date string
  end?: string;
  location?: string;
  description?: string;
  rsvp: Record<string, "going" | "maybe" | "not_going">;
  createdBy: string;
  door?: number;
  merch?: number;
  expenses?: number;
}

export const EVENT_TYPE_COLORS: Record<string, string> = {
  gig: "#ff6b6b",
  rehearsal: "#6c63ff",
  studio: "#ffd93d",
  deadline: "#ff9944",
  other: "#4488ff",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarPage() {
  const { user } = useAuth();
  const { activeBand } = useBand(user?.uid);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modalMode, setModalMode] = useState<"create" | "view" | null>(null);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewDayEvents, setViewDayEvents] = useState<CalendarEvent[]>([]);

  const { data: events } = useCollection<CalendarEvent>({
    path: activeBand ? `bands/${activeBand.id}/events` : "",
    constraints: [orderBy("start", "asc")],
    enabled: !!activeBand,
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const getDateStr = (day: number) => {
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  };

  const getEventsForDay = (day: number) => {
    const dateStr = getDateStr(day);
    return events.filter((e) => e.start.startsWith(dateStr));
  };

  const handleDayClick = (day: number) => {
    const dateStr = getDateStr(day);
    const dayEvents = getEventsForDay(day);

    if (dayEvents.length > 0) {
      // Show day detail view
      setSelectedDate(dateStr);
      setViewDayEvents(dayEvents);
      setEditEvent(null);
      setModalMode("view");
    } else {
      // No events — open create form
      setSelectedDate(dateStr);
      setEditEvent(null);
      setModalMode("create");
    }
  };

  const handleCreateFromView = () => {
    setEditEvent(null);
    setModalMode("create");
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditEvent(event);
    setSelectedDate(event.start.split("T")[0]);
    setModalMode("create");
  };

  const handleSave = useCallback(
    async (data: Omit<CalendarEvent, "id" | "rsvp" | "createdBy">) => {
      if (!activeBand || !user || !db) return;
      const colPath = `bands/${activeBand.id}/events`;

      if (editEvent) {
        await updateDoc(doc(db, colPath, editEvent.id), { ...data });
      } else {
        await addDoc(collection(db, colPath), {
          ...data,
          rsvp: { [user.uid]: "going" },
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        });
      }
      setModalMode(null);
      setEditEvent(null);
    },
    [activeBand, user, editEvent]
  );

  const handleDelete = useCallback(
    async (eventId: string) => {
      if (!activeBand || !db) return;
      await deleteDoc(doc(db, `bands/${activeBand.id}/events`, eventId));
      setModalMode(null);
      setEditEvent(null);
    },
    [activeBand]
  );

  const handleRsvp = useCallback(
    async (eventId: string, status: "going" | "maybe" | "not_going") => {
      if (!activeBand || !user || !db) return;
      await updateDoc(doc(db, `bands/${activeBand.id}/events`, eventId), {
        [`rsvp.${user.uid}`]: status,
      });
    },
    [activeBand, user]
  );

  const handleUpdateMoney = useCallback(
    async (eventId: string, field: "door" | "merch" | "expenses", value: number) => {
      if (!activeBand || !db) return;
      await updateDoc(doc(db, `bands/${activeBand.id}/events`, eventId), {
        [field]: value || 0,
      });
    },
    [activeBand]
  );

  const closeModal = () => {
    setModalMode(null);
    setEditEvent(null);
  };

  if (!activeBand) {
    return <div>Select a band to view the calendar.</div>;
  }

  // Upcoming events (from today forward)
  const upcoming = events.filter((e) => e.start >= today).slice(0, 5);

  // Events with money data for the graph
  const moneyEvents = events
    .filter((e) => (e.door || 0) + (e.merch || 0) + (e.expenses || 0) > 0)
    .sort((a, b) => a.start.localeCompare(b.start));

  const totalDoor = moneyEvents.reduce((s, e) => s + (e.door || 0), 0);
  const totalMerch = moneyEvents.reduce((s, e) => s + (e.merch || 0), 0);
  const totalExpenses = moneyEvents.reduce((s, e) => s + (e.expenses || 0), 0);
  const totalNet = totalDoor + totalMerch - totalExpenses;

  // Chart dimensions
  const chartW = 600;
  const chartH = 200;
  const barPad = 8;
  const maxVal = moneyEvents.length > 0
    ? Math.max(...moneyEvents.map((e) => Math.max((e.door || 0) + (e.merch || 0), e.expenses || 0)), 1)
    : 1;
  const barGroupWidth = moneyEvents.length > 0
    ? Math.min(80, (chartW - 40) / moneyEvents.length)
    : 80;

  return (
    <div className={styles.page}>
      <div className={styles.calendarSection}>
        <div className={styles.header}>
          <button className="btn btn-secondary" onClick={prevMonth}>&lt;</button>
          <h2 className={styles.monthTitle}>
            {MONTHS[month]} {year}
          </h2>
          <button className="btn btn-secondary" onClick={goToday}>Today</button>
          <button className="btn btn-secondary" onClick={nextMonth}>&gt;</button>
        </div>

        <div className={styles.grid}>
          {DAYS.map((d) => (
            <div key={d} className={styles.dayHeader}>{d}</div>
          ))}
          {calendarDays.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className={styles.emptyCell} />;
            }
            const dateStr = getDateStr(day);
            const dayEvents = getEventsForDay(day);
            const isToday = dateStr === today;
            const hasEvents = dayEvents.length > 0;

            return (
              <div
                key={day}
                className={`${styles.dayCell} ${isToday ? styles.today : ""} ${hasEvents ? styles.hasEvents : ""}`}
                onClick={() => handleDayClick(day)}
              >
                <span className={styles.dayNumber}>{day}</span>
                {hasEvents && (
                  <div className={styles.dotRow}>
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        className={styles.dot}
                        style={{ background: EVENT_TYPE_COLORS[ev.type] || EVENT_TYPE_COLORS.other }}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className={styles.dotMore}>+{dayEvents.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Earnings graph */}
        {moneyEvents.length > 0 && (
          <div className={styles.earningsSection}>
            <h3 className={styles.earningsTitle}>Earnings</h3>
            <div className={styles.earningsTotals}>
              <span className={styles.earningsStat}>
                <span className={styles.earningsDot} style={{ background: "#4caf50" }} />
                Door: ${totalDoor}
              </span>
              <span className={styles.earningsStat}>
                <span className={styles.earningsDot} style={{ background: "#ff9800" }} />
                Merch: ${totalMerch}
              </span>
              <span className={styles.earningsStat}>
                <span className={styles.earningsDot} style={{ background: "#f44336" }} />
                Expenses: ${totalExpenses}
              </span>
              <span className={`${styles.earningsStat} ${styles.earningsNet}`}>
                Net: <strong style={{ color: totalNet >= 0 ? "#4caf50" : "#f44336" }}>${totalNet}</strong>
              </span>
            </div>
            <div className={styles.chartWrap}>
              <svg viewBox={`0 0 ${chartW} ${chartH + 30}`} className={styles.chart}>
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                  const y = chartH - frac * chartH;
                  return (
                    <g key={frac}>
                      <line x1={30} y1={y} x2={chartW} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                      <text x={26} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize={9}>
                        ${Math.round(maxVal * frac)}
                      </text>
                    </g>
                  );
                })}
                {/* Bars */}
                {moneyEvents.map((ev, i) => {
                  const x = 35 + i * barGroupWidth;
                  const doorH = ((ev.door || 0) / maxVal) * chartH;
                  const merchH = ((ev.merch || 0) / maxVal) * chartH;
                  const expH = ((ev.expenses || 0) / maxVal) * chartH;
                  const halfBar = (barGroupWidth - barPad * 2) / 2;
                  return (
                    <g key={ev.id}>
                      {/* Door (bottom of income stack) */}
                      <rect
                        x={x + barPad}
                        y={chartH - doorH - merchH}
                        width={halfBar}
                        height={doorH}
                        fill="#4caf50"
                        rx={2}
                      />
                      {/* Merch (top of income stack) */}
                      <rect
                        x={x + barPad}
                        y={chartH - doorH - merchH}
                        width={halfBar}
                        height={merchH}
                        fill="#ff9800"
                        rx={2}
                      />
                      {/* Door below merch - re-draw door at bottom */}
                      <rect
                        x={x + barPad}
                        y={chartH - doorH}
                        width={halfBar}
                        height={doorH}
                        fill="#4caf50"
                        rx={2}
                      />
                      {/* Expenses bar */}
                      <rect
                        x={x + barPad + halfBar + 2}
                        y={chartH - expH}
                        width={halfBar}
                        height={expH}
                        fill="#f44336"
                        opacity={0.8}
                        rx={2}
                      />
                      {/* Label */}
                      <text
                        x={x + barGroupWidth / 2}
                        y={chartH + 14}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.5)"
                        fontSize={9}
                      >
                        {new Date(ev.start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </text>
                      <text
                        x={x + barGroupWidth / 2}
                        y={chartH + 26}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.3)"
                        fontSize={8}
                      >
                        {ev.title.length > 8 ? ev.title.slice(0, 7) + "..." : ev.title}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>

      <div className={styles.sidebar}>
        <h3 className={styles.sidebarTitle}>Upcoming</h3>
        {upcoming.length === 0 ? (
          <p className={styles.empty}>No upcoming events. Click a day to add one!</p>
        ) : (
          upcoming.map((ev) => (
            <div
              key={ev.id}
              className={styles.upcomingCard}
              onClick={() => {
                setSelectedDate(ev.start.split("T")[0]);
                setViewDayEvents([ev]);
                setEditEvent(null);
                setModalMode("view");
              }}
            >
              <div
                className={styles.typeBadge}
                style={{ background: EVENT_TYPE_COLORS[ev.type] || EVENT_TYPE_COLORS.other }}
              >
                {ev.type}
              </div>
              <div className={styles.upcomingInfo}>
                <strong>{ev.title}</strong>
                <span className={styles.upcomingDate}>
                  {new Date(ev.start).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                  {ev.start.includes("T") && (
                    <> at {new Date(ev.start).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}</>
                  )}
                </span>
                {ev.location && (
                  <span className={styles.upcomingLocation}>{ev.location}</span>
                )}
              </div>
              <div className={styles.rsvpButtons}>
                {(["going", "maybe", "not_going"] as const).map((status) => (
                  <button
                    key={status}
                    className={`${styles.rsvpBtn} ${
                      user && ev.rsvp[user.uid] === status ? styles.rsvpActive : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (user) handleRsvp(ev.id, status);
                    }}
                    title={status.replace("_", " ")}
                  >
                    {status === "going" ? "Y" : status === "maybe" ? "?" : "N"}
                  </button>
                ))}
              </div>
              {(() => {
                const goingNames = Object.entries(ev.rsvp)
                  .filter(([, s]) => s === "going")
                  .map(([uid]) => activeBand?.members[uid]?.displayName ?? "?")
                  .filter(Boolean);
                return goingNames.length > 0 ? (
                  <div className={styles.rsvpNames}>{goingNames.join(", ")}</div>
                ) : null;
              })()}
            </div>
          ))
        )}
      </div>

      {/* Day detail modal (view events) */}
      {modalMode === "view" && selectedDate && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.dayModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dayModalHeader}>
              <h3>
                {new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <button className={styles.closeBtn} onClick={closeModal}>&times;</button>
            </div>
            <div className={styles.dayModalEvents}>
              {viewDayEvents.map((ev) => {
                const isCreator = user?.uid === ev.createdBy;
                return (
                  <div key={ev.id} className={styles.eventCard}>
                    <div className={styles.eventCardHeader}>
                      <span
                        className={styles.eventTypeBadge}
                        style={{ background: EVENT_TYPE_COLORS[ev.type] || EVENT_TYPE_COLORS.other }}
                      >
                        {ev.type}
                      </span>
                      <h4 className={styles.eventTitle}>{ev.title}</h4>
                      {isCreator && (
                        <button
                          className={styles.editBtn}
                          onClick={() => handleEditEvent(ev)}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {ev.start.includes("T") && (
                      <div className={styles.eventDetail}>
                        Time: {new Date(ev.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </div>
                    )}
                    {ev.location && (
                      <div className={styles.eventDetail}>Location: {ev.location}</div>
                    )}
                    {ev.description && (
                      <div className={styles.eventDescription}>{ev.description}</div>
                    )}
                    <div className={styles.eventRsvp}>
                      {(["going", "maybe", "not_going"] as const).map((status) => (
                        <button
                          key={status}
                          className={`${styles.rsvpBtn} ${
                            user && ev.rsvp[user.uid] === status ? styles.rsvpActive : ""
                          }`}
                          onClick={() => { if (user) handleRsvp(ev.id, status); }}
                        >
                          {status === "going" ? "Going" : status === "maybe" ? "Maybe" : "Can't go"}
                        </button>
                      ))}
                    </div>
                    {/* CHA-CHING: income tracking for past events */}
                    {ev.start.split("T")[0] <= today && (
                      <div className={styles.chaChingSection}>
                        <div className={styles.chaChingTitle}>CHA-CHING</div>
                        <div className={styles.chaChingRow}>
                          <label className={styles.chaChingLabel}>Door $</label>
                          <input
                            type="number"
                            className={styles.chaChingInput}
                            defaultValue={ev.door || 0}
                            min={0}
                            onBlur={(e) => handleUpdateMoney(ev.id, "door", Number(e.target.value))}
                          />
                        </div>
                        <div className={styles.chaChingRow}>
                          <label className={styles.chaChingLabel}>Merch $</label>
                          <input
                            type="number"
                            className={styles.chaChingInput}
                            defaultValue={ev.merch || 0}
                            min={0}
                            onBlur={(e) => handleUpdateMoney(ev.id, "merch", Number(e.target.value))}
                          />
                        </div>
                        <div className={styles.chaChingRow}>
                          <label className={styles.chaChingLabel}>Expenses $</label>
                          <input
                            type="number"
                            className={styles.chaChingInput}
                            defaultValue={ev.expenses || 0}
                            min={0}
                            onBlur={(e) => handleUpdateMoney(ev.id, "expenses", Number(e.target.value))}
                          />
                        </div>
                        {((ev.door || 0) + (ev.merch || 0) - (ev.expenses || 0)) !== 0 && (
                          <div className={styles.chaChingNet}>
                            Net: ${(ev.door || 0) + (ev.merch || 0) - (ev.expenses || 0)}
                          </div>
                        )}
                      </div>
                    )}
                    {isCreator && (
                      <button
                        className={styles.deleteEventBtn}
                        onClick={() => handleDelete(ev.id)}
                      >
                        Delete Event
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button className="btn btn-primary" onClick={handleCreateFromView}>
              Add Event
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {modalMode === "create" && (
        <EventModal
          date={selectedDate ?? today}
          event={editEvent}
          onSave={handleSave}
          onDelete={editEvent ? () => handleDelete(editEvent.id) : undefined}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
