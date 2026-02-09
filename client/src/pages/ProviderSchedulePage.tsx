// client/src/pages/ProviderSchedulePage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getMe,
  getProviderUnavailability,
  createUnavailability,
  deleteUnavailability,
  toMeBookings,
  updateBooking,
} from "../api";

/* ===== helper функции даты ===== */

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function addDays(d: Date, i: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + i);
  return x;
}

/* ===== типы ===== */

type Me = { id: number; username: string };

type Busy = { id: number; startsAt: string; endsAt: string };

type BookingCal = {
  id: number;
  date: string;
  status: string;
  durationMinutes?: number;
  note?: string | null;
  clientUsername?: string | null;
};

type BookingRequest = {
  id: number;
  date: string;
  status: string;
  note: string | null;
  durationMinutes?: number;
  client: { id: number; username: string; avatarUrl?: string | null };
};

/* ===== основной компонент ===== */

export default function ProviderSchedulePage() {
  const [me, setMe] = useState<Me | null>(null);

  const [weekStart, setWeekStart] = useState<Date>(startOfWeek());

  const [busy, setBusy] = useState<Busy[]>([]);
  const [bookings, setBookings] = useState<BookingCal[]>([]);
  const [errCal, setErrCal] = useState<string | null>(null);
  const [loadingCal, setLoadingCal] = useState(false);

  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [errReq, setErrReq] = useState<string | null>(null);
  const [loadingReq, setLoadingReq] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  /* ===== загрузка me ===== */

  useEffect(() => {
    (async () => {
      try {
        const meRes = await getMe();
        if (meRes?.user?.username) {
          setMe({ id: meRes.user.id, username: meRes.user.username });
        } else {
          setMe(null);
        }
      } catch {
        setMe(null);
      }
    })();
  }, []);

  /* ===== загрузка календаря ===== */

  async function loadCalendar(username: string) {
    try {
      setLoadingCal(true);
      setErrCal(null);
      const cal = await getProviderUnavailability(username);
      setBusy(cal.busy || []);
      setBookings(
        (cal.bookings || []).map((b: any) => ({
          id: b.id,
          date: b.date,
          status: b.status,
          durationMinutes: b.durationMinutes,
          note: b.note ?? null,
          clientUsername: b.client?.username ?? null,
        }))
      );
    } catch (e: any) {
      setErrCal(e?.response?.data?.error || "Failed to load calendar");
      setBusy([]);
      setBookings([]);
    } finally {
      setLoadingCal(false);
    }
  }

  useEffect(() => {
    if (!me?.username) return;
    loadCalendar(me.username);
  }, [me?.username]);

  /* ===== загрузка запросов ко мне ===== */

  async function loadRequests() {
    try {
      setLoadingReq(true);
      setErrReq(null);
      const data = await toMeBookings();
      setRequests((data.bookings || []) as BookingRequest[]);
    } catch {
      setErrReq("Failed to load booking requests");
      setRequests([]);
    } finally {
      setLoadingReq(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  /* ===== создание busy ===== */

  const [newFrom, setNewFrom] = useState("09:00");
  const [newTo, setNewTo] = useState("12:00");
  const [newDay, setNewDay] = useState<string>("");

  function combineDayTime(day: string, hm: string) {
    return new Date(`${day}T${hm}:00`);
  }

  async function createBusy(e: React.FormEvent) {
    e.preventDefault();
    if (!me?.username || !newDay || !newFrom || !newTo) return;

    const s = combineDayTime(newDay, newFrom);
    const eDate = combineDayTime(newDay, newTo);
    if (!(s < eDate)) return;

    try {
      await createUnavailability(s.toISOString(), eDate.toISOString());
      await loadCalendar(me.username);
      setToast("Busy interval created");
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Failed to create busy interval");
      setTimeout(() => setToast(null), 2500);
    }
  }

  async function handleDeleteBusy(id: number) {
    if (!me?.username) return;
    try {
      await deleteUnavailability(id);
      await loadCalendar(me.username);
      setToast("Busy deleted");
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Failed to delete busy");
      setTimeout(() => setToast(null), 2500);
    }
  }

  /* ===== элементы для ячеек календаря ===== */

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  type CalendarItem = {
    type: "busy" | "booking";
    id?: number;
    from: Date;
    to: Date;
    status?: string;
    note?: string | null;
    clientUsername?: string | null;
  };

  const items: CalendarItem[] = useMemo(() => {
    const list: CalendarItem[] = [];

    for (const b of busy) {
      list.push({
        type: "busy",
        id: b.id,
        from: new Date(b.startsAt),
        to: new Date(b.endsAt),
      });
    }

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
        note: b.note,
        clientUsername: b.clientUsername ?? null,
      });
    }

    return list.sort((a, b) => a.from.getTime() - b.from.getTime());
  }, [busy, bookings]);

  /* ===== изменение статуса брони (requests) ===== */

  async function changeStatus(id: number, action: "confirm" | "decline" | "done") {
    if (!me?.username) return;
    try {
      await updateBooking(id, action);
      await Promise.all([loadRequests(), loadCalendar(me.username)]);

      if (action === "confirm") setToast("Booking approved");
      else if (action === "decline") setToast("Booking rejected");
      else setToast("Marked as done");
      
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Failed to update booking");
      setTimeout(() => setToast(null), 2500);
    }
  }

  /* ===== рендер ===== */

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 0.9fr",
          gap: 24,
          alignItems: "flex-start",
        }}
      >
        {/* левая часть — календарь */}
        <div>
          <h2 style={{ marginTop: 0 }}>My schedule</h2>

          {/* навигация по неделям */}
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

          {/* календарь недели */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px repeat(7, 1fr)",
              border: "1px solid #333",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* заголовки дней */}
            <div style={{ background: "#151515" }} />
            {weekDays.map((d) => (
              <div
                key={d.toDateString()}
                style={{
                  padding: 8,
                  background: "#151515",
                  textAlign: "center",
                }}
              >
                <b>
                  {d.toLocaleDateString(undefined, {
                    weekday: "short",
                  })}
                </b>
                <br />
                {d.getDate()}
              </div>
            ))}

            {/* строки по часам */}
            {Array.from({ length: 12 }, (_, h) => h + 8).map((h) => (
              <div key={`row-${h}`} style={{ display: "contents" }}>
                <div
                  style={{
                    padding: 8,
                    borderTop: "1px solid #333",
                  }}
                >
                  {h}:00
                </div>
                {weekDays.map((d, i) => (
                  <HourCell
                    key={`${h}-${i}`}
                    day={d}
                    hour={h}
                    items={items}
                    onPick={() => {
                      // по клику просто сейчас ничего не делаем,
                      // можно потом добавить автозаполнение формы
                    }}
                    onDeleteBusy={handleDeleteBusy}
                  />
                ))}
              </div>
            ))}
          </div>

          {errCal && (
            <div style={{ color: "crimson", marginTop: 8 }}>{errCal}</div>
          )}
          {loadingCal && (
            <div style={{ marginTop: 8, opacity: 0.8 }}>Loading calendar…</div>
          )}
        </div>

        {/* правая часть — форма busy + подсказка */}
        <div style={{ display: "grid", gap: 14 }}>
          <h3 style={{ marginTop: 0 }}>Add busy interval</h3>

          <form onSubmit={createBusy} style={{ display: "grid", gap: 8 }}>
            <label>
              Day
              <input
                type="date"
                value={newDay}
                onChange={(e) => setNewDay(e.target.value)}
                required
              />
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <label>
                From
                <input
                  type="time"
                  value={newFrom}
                  onChange={(e) => setNewFrom(e.target.value)}
                  required
                />
              </label>
              <label>
                To
                <input
                  type="time"
                  value={newTo}
                  onChange={(e) => setNewTo(e.target.value)}
                  required
                />
              </label>
            </div>

            <button type="submit">Add busy</button>
          </form>

          <div style={{ fontSize: 13, opacity: 0.8 }}>
            Tip: click a cell to see booked intervals; hover a colored block to
            see details (status, type, client).
          </div>
        </div>
      </div>

      {/* блок запросов под календарём */}
      <div
        style={{
          maxWidth: 900,
          margin: "32px auto 0",
          display: "grid",
          gap: 12,
        }}
      >
        <h2>Requests to me</h2>
        {errReq && <div style={{ color: "crimson" }}>{errReq}</div>}
        {loadingReq && <div>Loading…</div>}

        {!loadingReq && requests.length === 0 && (
          <div style={{ opacity: 0.7 }}>No booking requests yet.</div>
        )}

        {requests.map((b) => (
          <div
            key={b.id}
            style={{
              padding: 12,
              borderRadius: 12,
              background: "#151515",
              display: "grid",
              gap: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  @{b.client?.username ?? "client"}
                </div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {formatInterval(b.date, b.durationMinutes)}
                </div>
              </div>
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 12,
                  background: getStatusColor(b.status),
                  textTransform: "uppercase",
                }}
              >
                {b.status}
              </div>
            </div>

            {b.note && (
              <div style={{ fontSize: 13, opacity: 0.9 }}>Note: {b.note}</div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {b.status === "pending" && (
                <>
                  <button
                    onClick={() => changeStatus(b.id, "confirm")}
                    style={{ flex: 1 }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => changeStatus(b.id, "decline")}
                    style={{ flex: 1 }}
                  >
                    Reject
                  </button>
                </>
              )}
              {b.status === "confirmed" && (
                <button
                  onClick={() => changeStatus(b.id, "done")}
                  style={{ flex: 1 }}
                >
                  Mark as done
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* тост снизу */}
      {toast && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            padding: "10px 16px",
            borderRadius: 999,
            background: "#222",
            color: "#fff",
            fontSize: 14,
            boxShadow: "0 6px 16px rgba(0,0,0,0.5)",
            zIndex: 9999,
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}

/* ===== вспомогательные штуки для отрисовки ===== */

type HourCellProps = {
  day: Date;
  hour: number;
  items: {
    type: "busy" | "booking";
    id?: number;
    from: Date;
    to: Date;
    status?: string;
    note?: string | null;
    clientUsername?: string | null;
  }[];
  onPick: () => void;
  onDeleteBusy: (id: number) => void;
};

function HourCell({ day, hour, items, onPick, onDeleteBusy }: HourCellProps) {
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
      style={{
        borderTop: "1px solid #333",
        borderLeft: "1px solid #333",
        minHeight: 52,
        padding: 4,
        cursor: "pointer",
      }}
    >
      {inThisCell.map((it, idx) => (
        <SlotChip key={idx} item={it} onDeleteBusy={onDeleteBusy} />
      ))}
    </div>
  );
}

type SlotChipProps = {
  item: {
    type: "busy" | "booking";
    id?: number;
    from: Date;
    to: Date;
    status?: string;
    note?: string | null;
    clientUsername?: string | null;
  };
  onDeleteBusy: (id: number) => void;
};

function SlotChip({ item: it, onDeleteBusy }: SlotChipProps) {
  const [hover, setHover] = useState(false);

  const isBusy = it.type === "busy";

  const timeRange =
    it.from.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
    "–" +
    it.to.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const faded =
    !isBusy &&
    (it.status === "declined" ||
      it.status === "cancelled" ||
      it.status === "canceled");

  const bg = isBusy ? "#444444" : getBookingColor(it.status);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "inline-block",
        marginRight: 4,
        marginBottom: 2,
        minWidth: 70,
      }}
    >
      {/* tooltip */}
      {hover && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translate(-50%, -8px)",
            background: "#111",
            color: "#fff",
            padding: "6px 10px",
            borderRadius: 8,
            fontSize: 11,
            whiteSpace: "nowrap",
            boxShadow: "0 6px 16px rgba(0,0,0,0.6)",
            zIndex: 10,
          }}
        >
          {!isBusy && it.status && (
            <div>
              <b>Status:</b> {it.status}
            </div>
          )}
          <div>
            <b>Time:</b> {timeRange}
          </div>
          {!isBusy && it.note && (
            <div>
              <b>Type:</b> {it.note}
            </div>
          )}
          {!isBusy && it.clientUsername && (
            <div>
              <b>Client:</b> @{it.clientUsername}
            </div>
          )}
        </div>
      )}

      {/* сама плашка */}
      <div
        style={{
          fontSize: 12,
          padding: "4px 6px",
          borderRadius: 10,
          background: bg,
          opacity: faded ? 0.5 : 1,
          position: "relative",
        }}
      >
        <div style={{ fontWeight: 600 }}>{isBusy ? "busy" : it.status}</div>
        <div>{timeRange}</div>

        {!isBusy && it.note && (
          <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>
            {it.note}
          </div>
        )}

        {!isBusy && it.clientUsername && (
          <Link
            to={`/profile/${it.clientUsername}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 11,
              textDecoration: "underline",
              marginTop: 2,
              display: "block",
            }}
          >
            @{it.clientUsername}
          </Link>
        )}

        {isBusy && typeof it.id === "number" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteBusy(it.id!);
            }}
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              border: "none",
              borderRadius: "50%",
              width: 16,
              height: 16,
              fontSize: 10,
              cursor: "pointer",
              background: "#000",
              color: "#fff",
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

/* ===== цвет статусов ===== */

function getStatusColor(status: string) {
  switch (status) {
    case "confirmed":
      return "#2e7d32";
    case "pending":
      return "#5b458a";
    case "declined":
    case "cancelled":
    case "canceled":
      return "#555555";
    case "done":
      return "#1976d2";
    default:
      return "#777777";
  }
}

function getBookingColor(status?: string) {
  if (!status) return "#5b458a";
  return getStatusColor(status);
}

function formatInterval(dateISO: string, durationMinutes?: number) {
  const start = new Date(dateISO);
  const dur = Math.max(1, durationMinutes ?? 60);
  const end = new Date(start.getTime() + dur * 60000);

  const day = start.toLocaleDateString();
  const from = start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const to = end.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} · ${from}–${to}`;
}
