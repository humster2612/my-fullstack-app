import { useEffect, useMemo, useState } from "react";
import { listUsers, followUser, unfollowUser } from "../api";
import { Link } from "react-router-dom";
import Avatar from "../Avatar";
import WorldProvidersMap from "./WorldProvidersMap";
import "../styles/people.css";

type Person = {
  id: number | string;
  username: string;
  email: string;
  avatarUrl?: string;
  followers: number;
  following: number;
  isFollowing?: boolean;
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
      const res = await listUsers({
        q,
        limit: 20,
        cursor: reset ? undefined : cursor || undefined,
      });
      setItems(reset ? res.users : [...items, ...res.users]);
      setCursor(res.nextCursor);
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  const canLoadMore = useMemo(() => cursor !== null && !loading, [cursor, loading]);

  async function toggleFollow(u: Person) {
    setBusyId(u.id);
    try {
      if (u.isFollowing) {
        await unfollowUser(u.id);
        setItems((arr) =>
          arr.map((x) =>
            x.id === u.id
              ? { ...x, isFollowing: false, followers: Math.max(0, x.followers - 1) }
              : x
          )
        );
      } else {
        await followUser(u.id);
        setItems((arr) =>
          arr.map((x) => (x.id === u.id ? { ...x, isFollowing: true, followers: x.followers + 1 } : x))
        );
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="peoplePage">
      {/* ✅ MAP CARD */}
      <div className="mapCard">
        <div className="mapHeader">
          <div>
            <h2 className="mapTitle">Explore providers on the map</h2>
            <div className="mapSub">
              Drag to move · Use +/- or scroll to zoom · Click pin to open profile
            </div>
          </div>
        </div>

        {/* ✅ fixed viewport so map never “runs away” */}
        <div className="mapViewport">
          <WorldProvidersMap />
        </div>
      </div>

      {/* ✅ LIST */}
      <h2 style={{ marginTop: 12 }}>People</h2>

      <input
        className="peopleSearch"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by username or email..."
        autoComplete="off"
      />

      {err && <div style={{ color: "crimson" }}>{err}</div>}

      <div className="peopleList">
        {items.map((u) => (
          <div className="personCard" key={u.id}>
            <Avatar src={u.avatarUrl} size={48} alt={u.username} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>@{u.username}</div>
              <div style={{ opacity: 0.7, fontSize: 13 }}>{u.email}</div>
              <div style={{ opacity: 0.8, fontSize: 13 }}>
                Followers: {u.followers} · Following: {u.following}
              </div>
            </div>

            <Link className="openLink" to={`/profile/${u.username}`}>
              Open →
            </Link>

            <button className="followBtn" onClick={() => toggleFollow(u)} disabled={busyId === u.id}>
              {u.isFollowing ? "Unfollow" : "Follow"}
            </button>
          </div>
        ))}
      </div>

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
