import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getFeed, toggleLike, addComment, getAnnouncements } from "../api";
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

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [busyPostId, setBusyPostId] = useState<number | string | null>(null);

  // ✅ Announcements
  const [anns, setAnns] = useState<Announcement[]>([]);

  // Load announcements (public)
  useEffect(() => {
    (async () => {
      try {
        const res = await getAnnouncements();
        setAnns(res.announcements || []);
      } catch {
        // можно молча
      }
    })();
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
      setErr(e?.response?.data?.error || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }

  async function onToggleLike(postId: number | string) {
    setBusyPostId(postId);
    try {
      const res = await toggleLike(postId);
      setPosts((arr) =>
        arr.map((p) =>
          p.id === postId ? { ...p, likedByMe: res.liked, likeCount: res.count } : p
        )
      );
    } finally {
      setBusyPostId(null);
    }
  }


  async function loadAnnouncements() {
    try {
      const res = await getAnnouncements();
      setAnns(res.announcements || []);
    } catch {}
  }
  
  useEffect(() => {
    loadAnnouncements();
  }, []);
  



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
    } finally {
      setBusyPostId(null);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canLoadMore = useMemo(() => cursor !== null && !loading, [cursor, loading]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1>Home</h1>

      {/* ✅ Announcements block (видят все) */}
      {!!anns.length && (
        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>📢 Announcements</div>
          <button type="button" onClick={loadAnnouncements}>
  Refresh announcements
</button>


          <div style={{ display: "grid", gap: 10 }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => onToggleLike(p.id)}
                disabled={busyPostId === p.id}
                style={{ cursor: "pointer" }}
                type="button"
              >
                {p.likedByMe ? "❤️" : "🤍"} {p.likeCount}
              </button>

              <div style={{ opacity: 0.8 }}>💬 {p.commentCount}</div>
            </div>

            {!!p.lastComments?.length && (
              <div style={{ display: "grid", gap: 6 }}>
                {p.lastComments.map((c) => (
                  <div key={c.id} style={{ fontSize: 13, opacity: 0.9 }}>
                    <b>@{c.author.username}</b> {c.text}
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
