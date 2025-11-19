// client/src/pages/BookingRequestsPage.tsx
import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

type BookingToMe = {
  id: number;
  date: string;
  status: string;
  note: string | null;
  durationMinutes?: number;
  client: { id: number; username: string; avatarUrl?: string | null };
};

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(API_URL + path, { ...options, headers });
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

export default function BookingRequestsPage() {
  const [items, setItems] = useState<BookingToMe[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await request("/api/bookings/to-me");
      const data = await res.json();
      setItems(data.bookings || []);
    } catch (e: any) {
      console.error(e);
      setErr("Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function changeStatus(
    id: number,
    action: "confirm" | "decline" | "done"
  ) {
    try {
      setErr(null);
      const res = await request(`/api/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed");
      }

      await load();

      if (action === "confirm") setToast("Booking approved ✅");
      else if (action === "decline") setToast("Booking rejected ❌");
      else if (action === "done") setToast("Marked as done ✅");

      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Update failed");
    }
  }

  return (
    <>
      <div style={{ maxWidth: 700, margin: "0 auto", display: "grid", gap: 12 }}>
        <h2>Requests to me</h2>

        {err && <div style={{ color: "crimson" }}>{err}</div>}
        {loading && <div>Loading…</div>}

        {!loading && items.length === 0 && (
          <div style={{ opacity: 0.7 }}>No booking requests yet.</div>
        )}

        {items.map((b) => (
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
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
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
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      changeStatus(b.id, "confirm");
                    }}
                    style={{ flex: 1 }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      changeStatus(b.id, "decline");
                    }}
                    style={{ flex: 1 }}
                  >
                    Reject
                  </button>
                </>
              )}
              {b.status === "confirmed" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    changeStatus(b.id, "done");
                  }}
                  style={{ flex: 1 }}
                >
                  Mark as done
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

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
