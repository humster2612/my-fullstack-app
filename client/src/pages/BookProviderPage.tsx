// client/src/pages/BookProviderPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getProviderUnavailability,
  getProviderIdByUsername,
  createBookingByDate,
} from "../api";
import CalendarGrid from "./CalendarGrid";

export default function BookProviderPage() {
  const { username } = useParams();
  const [busy, setBusy] = useState<
    { id: number; startsAt: string; endsAt: string }[] | null
  >(null);
  const [bookings, setBookings] = useState<
    { id: number; date: string; status: string }[] | null
  >(null);

  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // week start = понедельник
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = (d.getDay() + 6) % 7; // Mon=0
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d;
  });

  // загрузка календаря провайдера
  useEffect(() => {
    (async () => {
      if (!username) return;
      try {
        const cal = await getProviderUnavailability(username);
        setBusy(cal.busy);
        setBookings(cal.bookings);
      } catch (e: any) {
        setErr(e?.response?.data?.error || "Failed to load");
      }
    })();
  }, [username]);

  // элементы для сетки
  const items = useMemo(() => {
    const list: Array<
      | { type: "busy"; id?: number; from: Date; to: Date }
      | { type: "booking"; id?: number; from: Date; status: string }
    > = [];
    if (busy)
      busy.forEach((b) =>
        list.push({
          type: "busy",
          id: b.id,
          from: new Date(b.startsAt),
          to: new Date(b.endsAt),
        })
      );
    if (bookings)
      bookings.forEach((b) =>
        list.push({
          type: "booking",
          id: b.id,
          from: new Date(b.date),
          status: b.status,
        })
      );
    return list.sort((a, b) => a.from.getTime() - b.from.getTime());
  }, [busy, bookings]);

  // отправка брони на произвольную дату/время
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!date || !username) {
      setErr("Выберите дату/время");
      return;
    }
    try {
      const { id } = await getProviderIdByUsername(username);
      await createBookingByDate(id, new Date(date).toISOString(), note);
      setMsg("Запрос отправлен!");
      setDate("");
      setNote("");
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Booking failed");
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        gap: 24,
        maxWidth: 1000,
        margin: "0 auto",
      }}
    >
      {/* Левая колонка — календарь провайдера (только чтение) */}
      <div>
        <h2>@{username} — Schedule</h2>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => {
              const d = new Date(weekStart);
              d.setDate(d.getDate() - 7);
              setWeekStart(d);
            }}
          >
            ← Prev
          </button>
          <div style={{ opacity: 0.8 }}>
            {new Date(weekStart).toLocaleDateString()} —{" "}
            {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString()}
          </div>
          <button
            onClick={() => {
              const d = new Date(weekStart);
              d.setDate(d.getDate() + 7);
              setWeekStart(d);
            }}
          >
            Next →
          </button>
        </div>

        {!busy && !bookings ? (
          <div>Loading...</div>
        ) : (
          <CalendarGrid weekStart={weekStart} items={items} readOnly />
        )}
      </div>

      {/* Правая колонка — карточка брони */}
      <form
        onSubmit={submit}
        style={{ display: "grid", gap: 8, alignSelf: "start" }}
      >
        <h3>Book this spot</h3>

        <label>
          Date & time
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label>
          Add description
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="type of shoot…"
          />
        </label>

        <button>BOOK THIS SPOT</button>
        <div style={{ fontSize: 12, opacity: 0.7, textAlign: "center" }}>
          Cancel
        </div>

        {msg && <div style={{ color: "limegreen" }}>{msg}</div>}
        {err && <div style={{ color: "crimson" }}>{err}</div>}
      </form>
    </div>
  );
}
