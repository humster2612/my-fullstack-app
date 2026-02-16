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

import "../styles/providerShedule.css";

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
      {/* ТОП: календарь слева + Add busy справа */}
      <div className="psLayout">
        <div className="psLeft">
          <div className="psHeaderRow">
            <h2 className="psTitle">@{me?.username ?? "me"} — Schedule</h2>

            <div className="psWeekNav">
              <button className="psBtn" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                ← Prev
              </button>

              <div className="psWeekRange">
                {weekDays[0].toLocaleDateString()} — {weekDays[6].toLocaleDateString()}
              </div>

              <button className="psBtn" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                Next →
              </button>
            </div>
          </div>

          <div className="psCalendarWrap">
            <div className="psCalendarGrid">
              <div className="psCalHead psCalHeadEmpty" />

              {weekDays.map((d) => (
                <div key={d.toDateString()} className="psCalHead">
                  <div className="psCalWeekday">
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                  </div>
                  <div className="psCalDay">{d.getDate()}</div>
                </div>
              ))}

              {Array.from({ length: 12 }, (_, h) => h + 8).map((h) => (
                <div key={`row-${h}`} style={{ display: "contents" }}>
                  <div className="psCalTime">{h}:00</div>

                  {weekDays.map((d, i) => (
                    <HourCell
                      key={`${h}-${i}`}
                      day={d}
                      hour={h}
                      items={items}
                      onPick={() => {
                        // тут сейчас ничего не делаем
                      }}
                      onDeleteBusy={handleDeleteBusy}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {errCal && <div className="psErrText">{errCal}</div>}
          {loadingCal && <div className="psMuted">Loading calendar…</div>}
        </div>

        {/* справа: Add busy interval */}
        <aside className="psRight">
          <div className="psCard">
            <div className="psCardTop">
              <h3 className="psCardTitle">Add busy interval</h3>
              <div className="psCardHint">
                Tip: hover a colored block to see details (status, type, client).
              </div>
            </div>

            <form onSubmit={createBusy} className="psFormGrid">
              <label className="psField">
                <span className="psLabel">Day</span>
                <input
                  className="psInput"
                  type="date"
                  value={newDay}
                  onChange={(e) => setNewDay(e.target.value)}
                  required
                />
              </label>

              <div className="psRow2">
                <label className="psField">
                  <span className="psLabel">From</span>
                  <input
                    className="psInput"
                    type="time"
                    value={newFrom}
                    onChange={(e) => setNewFrom(e.target.value)}
                    required
                  />
                </label>

                <label className="psField">
                  <span className="psLabel">To</span>
                  <input
                    className="psInput"
                    type="time"
                    value={newTo}
                    onChange={(e) => setNewTo(e.target.value)}
                    required
                  />
                </label>
              </div>

              <button type="submit" className="psBtnPrimary">
                Add busy
              </button>
            </form>
          </div>
        </aside>
      </div>

      {/* Requests — НИЖЕ */}
      <div className="psRequests">
        <h2>Requests to me</h2>
        {errReq && <div className="psErrText">{errReq}</div>}
        {loadingReq && <div className="psMuted">Loading…</div>}

        {!loadingReq && requests.length === 0 && (
          <div className="psMuted">No booking requests yet.</div>
        )}

        {requests.map((b) => (
          <div key={b.id} className="psReqCard">
            <div className="psReqTop">
              <div>
                <div style={{ fontWeight: 700 }}>@{b.client?.username ?? "client"}</div>
                <div className="psMutedSmall">{formatInterval(b.date, b.durationMinutes)}</div>
              </div>

              <div className="psStatusPill" style={{ background: getStatusColor(b.status) }}>
                {b.status}
              </div>
            </div>

            {b.note && <div className="psReqNote">Note: {b.note}</div>}

            <div className="psReqActions">
              {b.status === "pending" && (
                <>
                  <button className="psBtn" onClick={() => changeStatus(b.id, "confirm")} style={{ flex: 1 }}>
                    Approve
                  </button>
                  <button className="psBtn" onClick={() => changeStatus(b.id, "decline")} style={{ flex: 1 }}>
                    Reject
                  </button>
                </>
              )}
              {b.status === "confirmed" && (
                <button className="psBtn" onClick={() => changeStatus(b.id, "done")} style={{ flex: 1 }}>
                  Mark as done
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {toast && <div className="psToast">{toast}</div>}
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

  const inThisCell = items.filter((it) => it.from < cellEnd && it.to > cellStart);

  return (
    <div
      onClick={onPick}
      style={{
        borderTop: "1px solid rgba(255,255,255,.06)",
        borderLeft: "1px solid rgba(255,255,255,.06)",
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
    (it.status === "declined" || it.status === "cancelled" || it.status === "canceled");

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
          <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>{it.note}</div>
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
              color: "rgba(184,193,255,.95)",
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
  const from = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const to = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${from}–${to}`;
}
