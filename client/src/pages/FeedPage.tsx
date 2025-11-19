import { useEffect, useMemo, useState } from "react";
import { getFeed } from "../api";
import { Link } from "react-router-dom";


type FeedPost = {
  id: number | string;
  imageUrl: string;
  caption: string;
  location: string;
  createdAt: string;
  author: { id: number | string; 
            username: string; 
            avatarUrl?: string };
};

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load(reset = false) {
    setLoading(true);
    try {
      const res = await getFeed({ cursor: reset ? undefined : cursor || undefined, limit: 10 });
      setPosts(reset ? res.posts : [...posts, ...res.posts]);
      setCursor(res.nextCursor);
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(true); /* first load */  /* eslint-disable-line */ }, []);

  const canLoadMore = useMemo(() => cursor !== null && !loading, [cursor, loading]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1>Home</h1>
      {err && <div style={{ color: "crimson" }}>{err}</div>}

      {posts.map(p => (
        <article key={p.id} style={{ border: "1px solid #333", borderRadius: 12, overflow: "hidden" }}>
          <header style={{ display: "flex", alignItems: "center", gap: 10, padding: 8 }}>
            <img
              src={p.author.avatarUrl || "https://via.placeholder.com/40"}
              width={40} height={40} style={{ borderRadius: "50%", objectFit: "cover" }}
            />
            <Link to={`/profile/${p.author.username}`} style={{ fontWeight: 600 }}>
              @{p.author.username}
            </Link>
            <span style={{ marginLeft: "auto", opacity: .7, fontSize: 13 }}>
              {new Date(p.createdAt).toLocaleString()}
            </span>
          </header>
          <img src={p.imageUrl} alt="" style={{ width: "100%", display: "block" }} />
          {(p.caption || p.location) && (
            <div style={{ padding: 8 }}>
              {p.location && <div style={{ opacity: .8 }}>📍 {p.location}</div>}
              {p.caption && <div>{p.caption}</div>}
            </div>
          )}
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
