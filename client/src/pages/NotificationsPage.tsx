import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

type Notification = {
  id: number;
  type: "LIKE" | "COMMENT" | "FOLLOW" | "SYSTEM";
  createdAt: string;
  isRead: boolean;
  message?: string;

  fromUser?: {
    id: number;
    username: string;
    avatarUrl?: string;
  };

  post?: {
    id: number;
    imageUrl?: string;
    videoUrl?: string | null;
  } | null;

  comment?: {
    id: number;
    text: string;
  } | null;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    axios
      .get("http://localhost:4000/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setItems(res.data.notifications || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading notifications…</div>;
  if (!items.length) return <div>No notifications yet</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2>Notifications</h2>

      {items.map((n) => {
        const who = n.fromUser?.username || "Someone";

        const commentText =
          (n.comment?.text && n.comment.text.trim()) ||
          (n.message && n.message.trim()) ||
          "";

        return (
          <div
            key={n.id}
            style={{
              border: "1px solid #ddd",
              padding: 12,
              borderRadius: 8,
              background: "#424242",
            }}
          >
            <div style={{ fontSize: 14 }}>
              {n.type === "LIKE" && (
                <>
                  ❤️ <b>{who}</b> liked your post
                </>
              )}

              {n.type === "COMMENT" && (
                <>
                  💬 <b>{who}</b> commented:
                  {commentText ? (
                    <div style={{ marginTop: 4, fontStyle: "italic" }}>
                      “{commentText}”
                    </div>
                  ) : (
                    <div style={{ marginTop: 4, opacity: 0.7 }}>
                      (no text)
                    </div>
                  )}
                </>
              )}

              {n.type === "FOLLOW" && (
                <>
                  👤 <b>{who}</b> followed you
                </>
              )}

              {n.type === "SYSTEM" && (
                <>
                  🔔 {n.message || "System notification"}
                </>
              )}
            </div>

            {n.post?.id ? (
              <Link
                to={`/`}
                style={{ fontSize: 12, display: "inline-block", marginTop: 6 }}
              >
                View post
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
