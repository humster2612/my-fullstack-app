import { useEffect, useMemo, useState } from "react";
import { listUsers, followUser, unfollowUser } from "../api";
import { Link } from "react-router-dom";
import Avatar from "../Avatar";
import WorldProvidersMap from "./WorldProvidersMap";
type Person = {
  id: number | string;
  username: string;
  email: string;
  avatarUrl?: string;
  followers: number; // сколько подписчиков у него
  following: number; // на сколько людей он сам подписан
  isFollowing?: boolean; // <- подписана ли Я на него
};

export default function PeoplePage() {
  const [items, setItems] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load(reset = false) {
    setLoading(true);
    try {
      const res = await listUsers({ q, limit: 20, cursor: reset ? undefined : cursor || undefined });
      setItems(reset ? res.users : [...items, ...res.users]);
      setCursor(res.nextCursor);
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(true); /* eslint-disable-line */ }, []); // first load
  useEffect(() => { const t = setTimeout(() => load(true), 300); return () => clearTimeout(t); }, [q]); // search debounce

  const canLoadMore = useMemo(() => cursor !== null && !loading, [cursor, loading]);

  async function toggleFollow(u: Person) {
    setBusyId(u.id);
    try {
      if (u.isFollowing) {
        await unfollowUser(u.id);
        setItems(arr => arr.map(x =>
          x.id === u.id ? { ...x, isFollowing: false, followers: Math.max(0, x.followers - 1) } : x
        ));
      } else {
        await followUser(u.id);
        setItems(arr => arr.map(x =>
          x.id === u.id ? { ...x, isFollowing: true, followers: x.followers + 1 } : x
        ));
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
        <WorldProvidersMap />
      <h2>People</h2>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by username or email..."
        autoComplete="off"
      />

      {err && <div style={{ color: "crimson" }}>{err}</div>}

      {items.map(u => (
        <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 8, border: "1px solid #333", borderRadius: 12 }}>
            <Avatar src={u.avatarUrl} size={48} alt={u.username} />
          <div style={{ flex: 1 }}>
            <div><b>@{u.username}</b></div>
            <div style={{ opacity: .7 }}>{u.email}</div>
            <div style={{ opacity: .8, fontSize: 13 }}>Followers: {u.followers} · Following: {u.following}</div>
          </div>
          <Link to={`/profile/${u.username}`} style={{ marginRight: 8 }}>Open →</Link>
          <button onClick={() => toggleFollow(u)} disabled={busyId === u.id}>
            {u.isFollowing ? "Unfollow" : "Follow"}
          </button>
        </div>
      ))}

      {canLoadMore && (
        <button onClick={() => load(false)} disabled={loading} style={{ marginTop: 8 }}>
          {loading ? "Loading..." : "Load more"}
        </button>
      )}

      {!items.length && !loading && <div>No users</div>}
      {loading && <div>Loading...</div>}
    </div>
  );
}
