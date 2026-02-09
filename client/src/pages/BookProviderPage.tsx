// client/src/pages/BookProviderPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        gap: 24,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <div>
        <h2 style={{ marginTop: 0 }}>@{username} — Schedule</h2>

        {/* Навигация по неделям */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <button onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ← Prev
          </button>
          <div style={{ opacity: 0.8 }}>
            {weekDays[0].toLocaleDateString()} —{" "}
            {weekDays[6].toLocaleDateString()}
          </div>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Next →
          </button>
        </div>

        {/* Календарь недели (read-only) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px repeat(7, 1fr)",
            border: "1px solid #333",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {/* Заголовок дней */}
          <div style={{ background: "#151515" }} />
          {weekDays.map((d) => (
            <div
              key={d.toDateString()}
              style={{ padding: 8, background: "#151515", textAlign: "center" }}
            >
              <b>{d.toLocaleDateString(undefined, { weekday: "short" })}</b>
              <br />
              {d.getDate()}
            </div>
          ))}

          {/* Часы + клетки */}
          {Array.from({ length: 12 }, (_, h) => h + 8).map((h) => (
            <div key={`row-${h}`} style={{ display: "contents" }}>
              <div style={{ padding: 8, borderTop: "1px solid #333" }}>
                {h}:00
              </div>
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

        {err && (
          <div style={{ color: "crimson", marginTop: 8 }}>
            {err}
          </div>
        )}
      </div>

      {/* Панель бронирования */}
      <form
        onSubmit={submit}
        style={{ display: "grid", gap: 10, alignSelf: "start" }}
      >
        <h3 style={{ marginTop: 0 }}>Book this spot</h3>

        <label>
          Date
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            required
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ flex: 1 }}>
            From
            <input
              type="time"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              required
            />
          </label>
          <label style={{ flex: 1 }}>
            Duration
            <select
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10))}
            >
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
            </select>
          </label>
        </div>

        <label>
          Add description
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="type of shoot…"
          />
        </label>

        <button disabled={submitting}>
          {submitting ? "Booking…" : "BOOK THIS SPOT"}
        </button>
        <div
          style={{ fontSize: 12, opacity: 0.7, textAlign: "center" }}
        >
          Cancel
        </div>

        {msg && <div style={{ color: "limegreen" }}>{msg}</div>}
        {err && <div style={{ color: "crimson" }}>{err}</div>}
      </form>
    </div>
  );
}

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
