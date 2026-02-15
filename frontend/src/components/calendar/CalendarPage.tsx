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

  const closeModal = () => {
    setModalMode(null);
    setEditEvent(null);
  };

  if (!activeBand) {
    return <div>Select a band to view the calendar.</div>;
  }

  // Upcoming events (from today forward)
  const upcoming = events.filter((e) => e.start >= today).slice(0, 5);

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
