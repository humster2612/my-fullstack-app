import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getFeed, toggleLike, addComment, getAnnouncements, createReport } from "../api";
import type { Announcement } from "../api";
import "../styles/feed.css";

type FeedPost = {
  id: number | string;
  imageUrl: string;
  videoUrl?: string | null;
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

const FALLBACK_AVATAR =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
    <rect width="100%" height="100%" fill="#2b2b2b"/>
    <circle cx="40" cy="32" r="14" fill="#777"/>
    <rect x="18" y="52" width="44" height="18" rx="9" fill="#777"/>
  </svg>
`);

function useAutoPlayOnView() {
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    const els = Object.entries(videoRefs.current)
      .map(([_, el]) => el)
      .filter(Boolean) as HTMLVideoElement[];

    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = entry.target as HTMLVideoElement;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const p = v.play();
            if (p && typeof p.catch === "function") p.catch(() => {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: [0, 0.2, 0.6, 0.9] }
    );

    els.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, []);

  function bind(id: number | string) {
    const key = String(id);
    return (el: HTMLVideoElement | null) => {
      videoRefs.current[key] = el;
    };
  }

  return { bind };
}

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [busyPostId, setBusyPostId] = useState<number | string | null>(null);

  const [anns, setAnns] = useState<Announcement[]>([]);
  const [flash, setFlash] = useState<Flash>(null);

  const { bind } = useAutoPlayOnView();

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
    } catch {}
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
        arr.map((p) => (p.id === postId ? { ...p, likedByMe: res.liked, likeCount: res.count } : p))
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
          return { ...p, commentCount: res.count, lastComments: updatedLast };
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
      showErr(e?.response?.data?.error || e?.message || "Report failed");
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
      showErr(e?.response?.data?.error || e?.message || "Report failed");
    }
  }

  const canLoadMore = useMemo(() => cursor !== null && !loading, [cursor, loading]);

  return (
    <div className="feedPage">
      <h1 className="feedTitle">Home</h1>

      {flash && (
        <div className={`flash ${flash.type === "ok" ? "flashOk" : "flashErr"}`}>
          {flash.text}
        </div>
      )}

      {!!anns.length && (
        <div className="annCard">
          <div className="annHeader">
            <div className="annTitle">📢 Announcements</div>
            <div style={{ marginLeft: "auto" }}>
              <button type="button" onClick={loadAnnouncements}>
                Refresh
              </button>
            </div>
          </div>

          <div className="annList">
            {anns.map((a) => (
              <div key={a.id} className="annItem">
                <div style={{ fontWeight: 700 }}>{a.title}</div>
                {!!a.body && (
                  <div style={{ opacity: 0.9, whiteSpace: "pre-wrap", marginTop: 4 }}>
                    {a.body}
                  </div>
                )}
                <div className="annMeta">
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
        <article key={p.id} className="postCard">
          <header className="postHeader">
            <img
              className="postAvatar"
              src={(p.author.avatarUrl && p.author.avatarUrl.trim()) ? p.author.avatarUrl : FALLBACK_AVATAR}
              alt=""
            />
            <Link className="postUser" to={`/profile/${p.author.username}`}>
              @{p.author.username}
            </Link>
            <span className="postMeta">{new Date(p.createdAt).toLocaleString()}</span>
          </header>

          {/* ✅ важно: медиа обёртка ограничивает размер */}
          <div className="postMedia">
            {p.videoUrl ? (
              <video
                ref={bind(p.id)}
                src={p.videoUrl}
                muted
                playsInline
                loop
                autoPlay
                preload="metadata"
                onClick={(e) => {
                  const v = e.currentTarget;
                  if (v.paused) v.play().catch(() => {});
                  else v.pause();
                }}
              />
            ) : (
              <img src={p.imageUrl} alt="" />
            )}
          </div>

          {(p.caption || p.location) && (
            <div className="postCaption">
              {p.location && <div className="postLocation">📍 {p.location}</div>}
              {p.caption && <div className="postText">{p.caption}</div>}
            </div>
          )}

          <div className="postActions">
            <div className="actionsRow">
              <button
                className="actionBtn"
                onClick={() => onToggleLike(p.id)}
                disabled={busyPostId === p.id}
                type="button"
              >
                {p.likedByMe ? "❤️" : "🤍"} {p.likeCount}
              </button>

              <div className="countText">💬 {p.commentCount}</div>

              <button className="actionBtn" type="button" onClick={() => onReportPost(p.id)}>
                🚩 Report
              </button>
            </div>

            {!!p.lastComments?.length && (
              <div className="comments">
                {p.lastComments.map((c) => (
                  <div key={c.id} className="commentRow">
                    <div className="commentBody">
                      <b>@{c.author.username}</b> {c.text}
                    </div>
                    <button
                      type="button"
                      onClick={() => onReportComment(Number(c.id))}
                      className="actionBtn commentReport"
                      title="Report comment"
                    >
                      🚩
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="commentInputRow">
              <input
                className="commentInput"
                value={commentText[String(p.id)] || ""}
                onChange={(e) => setCommentText((map) => ({ ...map, [String(p.id)]: e.target.value }))}
                placeholder="Add a comment..."
              />
              <button
                className="actionBtn"
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
        <button className="actionBtn" onClick={() => load(false)} disabled={loading}>
          {loading ? "Loading..." : "Load more"}
        </button>
      )}

      {!posts.length && !loading && <div>No posts yet. Follow someone or create a post!</div>}
      {loading && <div>Loading...</div>}
    </div>
  );
}
