// client/src/pages/MyBookingsPage.tsx
import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

type MyBooking = {
  id: number;
  date: string;
  status: string;
  note: string | null;
  durationMinutes?: number;
  videographer: {
    id: number;
    username: string;
    avatarUrl?: string | null;
    role?: string;
  };
};

// универсальный helper с нормальными типами заголовков
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

// форматируем дату + ВРЕМЯ БЕЗ СЕКУНД
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

function getStatusColor(status: string) {
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
      return "#777777";
  }
}

export default function MyBookingsPage() {
  const [items, setItems] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await request("/api/bookings/my");
      const data = await res.json();
      setItems(data.bookings || []);
    } catch (e: any) {
      setErr("Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", display: "grid", gap: 12 }}>
      <h2>My bookings</h2>

      {err && <div style={{ color: "crimson" }}>{err}</div>}
      {loading && <div>Loading…</div>}

      {!loading && items.length === 0 && (
        <div style={{ opacity: 0.7 }}>You have no bookings yet.</div>
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
                @{b.videographer?.username ?? "provider"}
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
        </div>
      ))}
    </div>
  );
}
