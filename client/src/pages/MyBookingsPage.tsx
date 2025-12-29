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
  // 👇 важно: backend должен вернуть это поле
  review?: { id: number; rating: number } | null;
};

// универсальный helper с нормальными типами заголовков
async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(API_URL + path, { ...options, headers });
}

// форматируем дату + ВРЕМЯ БЕЗ СЕКУНД
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

export default function MyBookingsPage() {
  const [items, setItems] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // ===== Review modal state =====
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState<number | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [reviewErr, setReviewErr] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await request("/api/bookings/my");
      const data = await res.json();
      setItems(data.bookings || []);
    } catch {
      setErr("Failed to load");
    } finally {
      setLoading(false);
    }
  }

  function openReviewModal(bookingId: number) {
    setReviewBookingId(bookingId);
    setRating(5);
    setReviewText("");
    setReviewErr(null);
    setReviewOpen(true);
  }

  async function submitReview() {
    if (!reviewBookingId) return;
    setSavingReview(true);
    setReviewErr(null);

    try {
      const res = await request("/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          bookingId: reviewBookingId,
          rating,
          text: reviewText,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setReviewErr(data?.error || "Failed to send review");
        return;
      }

      // ✅ локально отмечаем, что отзыв уже есть
      setItems((arr) =>
        arr.map((b) =>
          b.id === reviewBookingId ? { ...b, review: { id: data.review?.id ?? 1, rating } } : b
        )
      );

      setReviewOpen(false);
    } catch {
      setReviewErr("Failed to send review");
    } finally {
      setSavingReview(false);
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
            gap: 10,
            border: "1px solid #222",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "grid", gap: 4 }}>
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

          {/* ===== Review CTA ===== */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {b.status === "done" && !b.review?.id && (
              <button
                type="button"
                onClick={() => openReviewModal(b.id)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #333",
                  background: "#111",
                  cursor: "pointer",
                }}
              >
                Leave review
              </button>
            )}

            {b.status === "done" && !!b.review?.id && (
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                ✅ Review sent {typeof b.review?.rating === "number" ? `· ${b.review.rating}⭐` : ""}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* ===== Review modal ===== */}
      {reviewOpen && (
        <div
          onClick={() => !savingReview && setReviewOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#111",
              border: "1px solid #333",
              borderRadius: 14,
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <h3 style={{ margin: 0 }}>Leave a review</h3>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span>Rating:</span>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                disabled={savingReview}
                style={{ padding: 6, borderRadius: 8 }}
              >
                <option value={5}>5 ⭐</option>
                <option value={4}>4 ⭐</option>
                <option value={3}>3 ⭐</option>
                <option value={2}>2 ⭐</option>
                <option value={1}>1 ⭐</option>
              </select>
            </div>

            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Write a short review (optional)"
              rows={4}
              disabled={savingReview}
              style={{
                width: "100%",
                resize: "vertical",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #333",
                background: "#0c0c0c",
              }}
            />

            {reviewErr && <div style={{ color: "crimson" }}>{reviewErr}</div>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setReviewOpen(false)}
                disabled={savingReview}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #333",
                  background: "#111",
                  cursor: savingReview ? "default" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitReview}
                disabled={savingReview || !reviewBookingId}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #333",
                  background: "#1a1a1a",
                  cursor: savingReview ? "default" : "pointer",
                }}
              >
                {savingReview ? "Sending..." : "Send review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
