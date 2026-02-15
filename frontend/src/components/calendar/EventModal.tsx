import { useState } from "react";
import type { CalendarEvent } from "./CalendarPage";
import styles from "./EventModal.module.css";

interface EventModalProps {
  date: string;
  event: CalendarEvent | null;
  onSave: (data: Omit<CalendarEvent, "id" | "rsvp" | "createdBy">) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const EVENT_TYPES: CalendarEvent["type"][] = [
  "rehearsal", "gig", "studio", "deadline", "other",
];

export function EventModal({ date, event, onSave, onDelete, onClose }: EventModalProps) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState<CalendarEvent["type"]>(event?.type ?? "rehearsal");
  const [start, setStart] = useState(event?.start ?? date);
  const [time, setTime] = useState(
    event?.start.includes("T")
      ? event.start.split("T")[1].substring(0, 5)
      : ""
  );
  const [location, setLocation] = useState(event?.location ?? "");
  const [description, setDescription] = useState(event?.description ?? "");

  const handleSubmit = () => {
    if (!title.trim()) return;
    const startDate = time ? `${start.split("T")[0]}T${time}` : start.split("T")[0];
    onSave({
      title: title.trim(),
      type,
      start: startDate,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>{event ? "Edit Event" : "New Event"}</h3>

        <label className={styles.label}>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Practice, gig, studio session..."
          className={styles.input}
          autoFocus
        />

        <label className={styles.label}>Type</label>
        <div className={styles.typeRow}>
          {EVENT_TYPES.map((t) => (
            <button
              key={t}
              className={`${styles.typeBtn} ${type === t ? styles.typeActive : ""}`}
              onClick={() => setType(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Date</label>
            <input
              type="date"
              value={start.split("T")[0]}
              onChange={(e) => setStart(e.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Time (optional)</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={styles.input}
            />
          </div>
        </div>

        <label className={styles.label}>Location</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Studio, venue, address..."
          className={styles.input}
        />

        <label className={styles.label}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notes, setlist, what to bring..."
          className={styles.textarea}
          rows={3}
        />

        <div className={styles.actions}>
          {onDelete && (
            <button className={`btn btn-secondary ${styles.deleteBtn}`} onClick={onDelete}>
              Delete
            </button>
          )}
          <div className={styles.spacer} />
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!title.trim()}
          >
            {event ? "Save" : "Create Event"}
          </button>
        </div>
      </div>
    </div>
  );
}
