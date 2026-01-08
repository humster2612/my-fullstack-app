import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getFeed, toggleLike, addComment, getAnnouncements, createReport } from "../api";
import type { Announcement } from "../api";

type FeedPost = {
  id: number | string;
  imageUrl: string;
  caption: string;
  location: string;
  createdAt: string;
  author: { id: number | string; username: string; avatarUrl?: string };

  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  lastComments: Array<{
    id: number;
    text: string;
    createdAt: string;
    author: { id: number | string; username: string; avatarUrl?: string };
  }>;
};

type Flash = { type: "ok" | "err"; text: string } | null;

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [busyPostId, setBusyPostId] = useState<number | string | null>(null);

  // ✅ Announcements
  const [anns, setAnns] = useState<Announcement[]>([]);

  // ✅ вместо alert()
  const [flash, setFlash] = useState<Flash>(null);

  function showOk(text: string) {
    setFlash({ type: "ok", text });
    setTimeout(() => setFlash(null), 2500);
  }
  function showErr(text: string) {
    setFlash({ type: "err", text });
    setTimeout(() => setFlash(null), 3500);
  }

  async function loadAnnouncements() {
    try {
      const res = await getAnnouncements();
      setAnns(res.announcements || []);
    } catch {
      // без alert
    }
  }

  useEffect(() => {
    loadAnnouncements();
  }, []);

  async function load(reset = false) {
    setLoading(true);
    setErr(null);
    try {
      const res = await getFeed({
        cursor: reset ? undefined : cursor ?? undefined,
        limit: 10,
      });

      setPosts((prev) => (reset ? res.posts : [...prev, ...res.posts]));
      setCursor(res.nextCursor);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onToggleLike(postId: number | string) {
    setBusyPostId(postId);
    try {
      const res = await toggleLike(postId);
      setPosts((arr) =>
        arr.map((p) =>
          p.id === postId ? { ...p, likedByMe: res.liked, likeCount: res.count } : p
        )
      );
    } catch (e: any) {
      showErr(e?.response?.data?.error || e?.message || "Like failed");
    } finally {
      setBusyPostId(null);
    }
  }

  async function onSendComment(postId: number | string) {
    const text = (commentText[String(postId)] || "").trim();
    if (!text) return;

    setBusyPostId(postId);
    try {
      const res = await addComment(postId, text);

      setPosts((arr) =>
        arr.map((p) => {
          if (p.id !== postId) return p;

          const updatedLast = [...(p.lastComments || []), res.comment].slice(-2);

          return {
            ...p,
            commentCount: res.count,
            lastComments: updatedLast,
          };
        })
      );

      setCommentText((map) => ({ ...map, [String(postId)]: "" }));
    } catch (e: any) {
      showErr(e?.response?.data?.error || e?.message || "Comment failed");
    } finally {
      setBusyPostId(null);
    }
  }

  async function onReportPost(postId: number | string) {
    const reason = prompt("Reason for report? (spam/abuse/etc)");
    if (!reason) return;
    const message = prompt("Details (optional)") || "";

    try {
      await createReport({
        targetType: "POST",
        postId: Number(postId),
        reason,
        message,
      });
      showOk("Report sent ✅");
    } catch (e: any) {
      // ✅ покажем нормальную причину
      const msg =
        e?.response?.status === 404
          ? "Report endpoint not found (404). Проверь, что backend запущен и обновлён."
          : e?.response?.data?.error || e?.message || "Report failed";
      showErr(msg);
    }
  }

  async function onReportComment(commentId: number) {
    const reason = prompt("Reason for report?");
    if (!reason) return;
    const message = prompt("Details (optional)") || "";

    try {
      await createReport({
        targetType: "COMMENT",
        commentId: Number(commentId),
        reason,
        message,
      });
      showOk("Report sent ✅");
    } catch (e: any) {
      const msg =
        e?.response?.status === 404
          ? "Report endpoint not found (404). Проверь backend."
          : e?.response?.data?.error || e?.message || "Report failed";
      showErr(msg);
    }
  }

  const canLoadMore = useMemo(() => cursor !== null && !loading, [cursor, loading]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1>Home</h1>

      {/* ✅ flash вместо alert */}
      {flash && (
        <div
          style={{
            border: "1px solid #333",
            borderRadius: 12,
            padding: 10,
            background: flash.type === "ok" ? "rgba(0,255,0,0.06)" : "rgba(255,0,0,0.06)",
            color: flash.type === "ok" ? "#9fff9f" : "#ff9f9f",
          }}
        >
          {flash.text}
        </div>
      )}

      {/* ✅ Announcements */}
      {!!anns.length && (
        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontWeight: 800 }}>📢 Announcements</div>
            <div style={{ marginLeft: "auto" }}>
              <button type="button" onClick={loadAnnouncements}>
                Refresh
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {anns.map((a) => (
              <div key={a.id} style={{ borderBottom: "1px solid #2a2a2a", paddingBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>{a.title}</div>

                {!!a.body && (
                  <div style={{ opacity: 0.9, whiteSpace: "pre-wrap", marginTop: 4 }}>
                    {a.body}
                  </div>
                )}

                <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
                  {new Date(a.createdAt).toLocaleString()}
                  {a.createdBy?.username ? ` · by @${a.createdBy.username}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {err && <div style={{ color: "crimson" }}>{err}</div>}

      {posts.map((p) => (
        <article
          key={p.id}
          style={{ border: "1px solid #333", borderRadius: 12, overflow: "hidden" }}
        >
          <header style={{ display: "flex", alignItems: "center", gap: 10, padding: 8 }}>
            <img
              src={p.author.avatarUrl || "https://via.placeholder.com/40"}
              width={40}
              height={40}
              style={{ borderRadius: "50%", objectFit: "cover" }}
              alt=""
            />
            <Link to={`/profile/${p.author.username}`} style={{ fontWeight: 600 }}>
              @{p.author.username}
            </Link>
            <span style={{ marginLeft: "auto", opacity: 0.7, fontSize: 13 }}>
              {new Date(p.createdAt).toLocaleString()}
            </span>
          </header>

          <img src={p.imageUrl} alt="" style={{ width: "100%", display: "block" }} />

          {(p.caption || p.location) && (
            <div style={{ padding: 8 }}>
              {p.location && <div style={{ opacity: 0.8 }}>📍 {p.location}</div>}
              {p.caption && <div>{p.caption}</div>}
            </div>
          )}

          <div style={{ padding: 8, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => onToggleLike(p.id)}
                disabled={busyPostId === p.id}
                style={{ cursor: "pointer" }}
                type="button"
              >
                {p.likedByMe ? "❤️" : "🤍"} {p.likeCount}
              </button>

              <div style={{ opacity: 0.8 }}>💬 {p.commentCount}</div>

              <button type="button" onClick={() => onReportPost(p.id)}>
                🚩 Report
              </button>
            </div>

            {!!p.lastComments?.length && (
              <div style={{ display: "grid", gap: 6 }}>
                {p.lastComments.map((c) => (
                  <div
                    key={c.id}
                    style={{ fontSize: 13, opacity: 0.9, display: "flex", gap: 8 }}
                  >
                    <div style={{ flex: 1 }}>
                      <b>@{c.author.username}</b> {c.text}
                    </div>

                    <button
                      type="button"
                      onClick={() => onReportComment(Number(c.id))}
                      style={{ fontSize: 12 }}
                      title="Report comment"
                    >
                      🚩
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={commentText[String(p.id)] || ""}
                onChange={(e) =>
                  setCommentText((map) => ({ ...map, [String(p.id)]: e.target.value }))
                }
                placeholder="Add a comment..."
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => onSendComment(p.id)}
                disabled={busyPostId === p.id}
              >
                Send
              </button>
            </div>
          </div>
        </article>
      ))}

      {canLoadMore && (
        <button onClick={() => load(false)} disabled={loading}>
          {loading ? "Loading..." : "Load more"}
        </button>
      )}

      {!posts.length && !loading && <div>No posts yet. Follow someone or create a post!</div>}
      {loading && <div>Loading...</div>}
    </div>
  );
}
