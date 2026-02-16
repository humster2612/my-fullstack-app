// client/src/pages/BookProviderPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import "../styles/booking.css";
import {
  getProviderUnavailability,
  getProviderIdByUsername,
  createBookingByDate, // отправляем start/end + note
} from "../api";

type Busy = { id: number; startsAt: string; endsAt: string };
type Booking = {
  id: number;
  date: string;
  status: string;
  durationMinutes?: number;
};

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}
function addDays(d: Date, i: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + i);
  return x;
}

// helper: "2025-11-14" + "09:00" → Date
function combine(day: string, hm: string) {
  return new Date(`${day}T${hm}:00`);
}

export default function BookProviderPage() {
  const { username } = useParams();
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek());

  // данные календаря


  // форма брони
  const [day, setDay] = useState(""); // yyyy-mm-dd
  const [from, setFrom] = useState("09:00"); // HH:MM
  const [duration, setDuration] = useState(60); // minutes
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [busy, setBusy] = useState<Busy[] | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    (async () => {
      try {
        setErr(null);
        const cal = await getProviderUnavailability(username);
        setBusy(cal.busy || []);
        setBookings(cal.bookings || []);
      } catch (e: any) {
        setErr(e?.response?.data?.error || "Failed to load");
        setBusy([]);
        setBookings([]);
      }
    })();
  }, [username]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const items = useMemo(() => {
    const list: {
      type: "busy" | "booking";
      id?: number;
      from: Date;
      to: Date;
      status?: string;
    }[] = [];

    if (busy) {
      for (const b of busy) {
        list.push({
          type: "busy",
          id: b.id,
          from: new Date(b.startsAt),
          to: new Date(b.endsAt),
        });
      }
    }
    if (bookings) {
      for (const b of bookings) {
        const start = new Date(b.date);
        const dur = Math.max(1, b.durationMinutes ?? 60);
        const end = new Date(start.getTime() + dur * 60000);
        list.push({
          type: "booking",
          id: b.id,
          from: start,
          to: end,
          status: b.status,
        });
      }
    }
    return list.sort((a, b) => a.from.getTime() - b.from.getTime());
  }, [busy, bookings]);

  // клик по пустой ячейке — автозаполнить форму (start + duration 60)

  function pickSlot(d: Date, hour: number) {
    const dt = new Date(d);
    dt.setHours(hour, 0, 0, 0);

    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const da = String(dt.getDate()).padStart(2, "0");
    const hh = String(dt.getHours()).padStart(2, "0");

    setDay(`${y}-${m}-${da}`);
    setFrom(`${hh}:00`);
    setDuration(60); 
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    if (!username || !day || !from || !duration) {
      setErr(" Proszę wypełnić wszystkie pola");
      return;
    }

    const start = combine(day, from);
    const end = new Date(start.getTime() + duration * 60000);

    if (!(start < end)) {
      setErr("Nieprawidłowy interwał");
      return;
    }

    try {
      setSubmitting(true);
      const { id } = await getProviderIdByUsername(username);
      
      await createBookingByDate(id, start.toISOString(), end.toISOString(), note);
      setMsg("  Wyslano!");
      setNote("");
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bookLayout">
      <div className="bookLeft">
        <div className="bookHeaderRow">
          <h2 className="bookTitle">@{username} — Schedule</h2>
  
          <div className="weekNav">
            <button className="btn" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              ← Prev
            </button>
  
            <div className="weekRange">
              {weekDays[0].toLocaleDateString()} — {weekDays[6].toLocaleDateString()}
            </div>
  
            <button className="btn" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Next →
            </button>
          </div>
        </div>
  
        <div className="calendarWrap">
          <div className="calendarGrid">
            {/* header пустой слева */}
            <div className="calHead calHeadEmpty" />
  
            {weekDays.map((d) => (
              <div key={d.toDateString()} className="calHead">
                <div className="calWeekday">
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className="calDay">{d.getDate()}</div>
              </div>
            ))}
  
            {/* часы + клетки */}
            {Array.from({ length: 12 }, (_, h) => h + 8).map((h) => (
              <div key={`row-${h}`} style={{ display: "contents" }}>
                <div className="calTime">{h}:00</div>
  
                {weekDays.map((d, i) => (
                  <HourCell
                    key={`${h}-${i}`}
                    day={d}
                    hour={h}
                    items={items}
                    onPick={() => pickSlot(d, h)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
  
        {err && <div className="errText">{err}</div>}
        {msg && <div className="okText">{msg}</div>}
      </div>
  
      {/* Правая панель */}
      <aside className="bookRight">
        <form onSubmit={submit} className="bookCard">
          <div className="bookCardTop">
            <h3 className="bookCardTitle">Book this spot</h3>
            {/* <div className="bookCardHint">Pick a slot in the calendar or fill the form.</div> */}
          </div>
  
          <div className="formGrid">
            <label className="field">
              <span className="label">Date</span>
              <input
                className="input"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                required
              />
            </label>
  
            <div className="row2">
              <label className="field">
                <span className="label">From</span>
                <input
                  className="input"
                  type="time"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  required
                />
              </label>
  
              <label className="field">
                <span className="label">Duration</span>
                <select
                  className="input"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                >
                  <option value={30}>30 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                </select>
              </label>
            </div>
  
            <label className="field">
              <span className="label">Add description</span>
              <input
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="write your type of event"
              />
            </label>
  
            <button className="btnPrimary" disabled={submitting} type="submit">
              {submitting ? "Booking…" : "BOOK THIS SPOT"}
            </button>
  
            <button
              className="btnGhost"
              type="button"
              onClick={() => {
                setDay("");
                setFrom("09:00");
                setDuration(60);
                setNote("");
                setMsg(null);
                setErr(null);
              }}
            >
              Cancel
            </button>
  
            {err && <div className="errText">{err}</div>}
            {msg && <div className="okText">{msg}</div>}
          </div>
        </form>
      </aside>
    </div>
  );
  

/* ---------- цвета статусов ---------- */

function getBookingColor(status?: string) {
  switch (status) {
    case "confirmed":
      return "#2e7d32"; // зелёный
    case "pending":
      return "#5b458a"; // фиолетовый
    case "declined":
    case "cancelled":
    case "canceled":
      return "#555555"; // серый
    case "done":
      return "#1976d2"; // синий
    default:
      return "#5b458a";
  }
}

/* ---------- ячейка часа ---------- */

function HourCell({
  day,
  hour,
  items,
  onPick,
}: {
  day: Date;
  hour: number;
  items: {
    type: "busy" | "booking";
    id?: number;
    from: Date;
    to: Date;
    status?: string;
  }[];
  onPick: () => void;
}) {
  const cellStart = new Date(day);
  cellStart.setHours(hour, 0, 0, 0);
  const cellEnd = new Date(day);
  cellEnd.setHours(hour + 1, 0, 0, 0);

  const inThisCell = items.filter(
    (it) => it.from < cellEnd && it.to > cellStart
  );

  return (
    <div
      onClick={onPick}
      title="Click to prefill form with this hour"
      style={{
        borderTop: "1px solid #333",
        borderLeft: "1px solid #333",
        minHeight: 48,
        padding: 4,
        cursor: "pointer",
      }}
    >
      {inThisCell.map((it, idx) => {
        const bg =
          it.type === "busy" ? "#444444" : getBookingColor(it.status);
        const faded =
          it.type === "booking" &&
          (it.status === "declined" ||
            it.status === "cancelled" ||
            it.status === "canceled");

        return (
          <span
            key={idx}
            style={{
              fontSize: 12,
              padding: "2px 6px",
              borderRadius: 8,
              background: bg,
              display: "inline-block",
              marginRight: 4,
              opacity: faded ? 0.5 : 1,
            }}
          >
            {it.type === "busy" ? "busy " : `${it.status} `}
            {it.from.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            –
            {it.to.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        );
      })}
    </div>
  );
}
}