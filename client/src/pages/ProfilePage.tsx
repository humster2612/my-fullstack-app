import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import "../styles/profile.css";
import Avatar from "../Avatar";
import {
  getUserByUsername,
  getMe,
  getFollowStatus,
  followUser,
  unfollowUser,
  getUserPosts,
  getProviderReviews,

  // ✅ NEW
  getUserPortfolio,
  createPortfolioItem,
  deletePortfolioItem,
  type ProviderPortfolioItem,
} from "../api";

type PublicUser = {
  id: number | string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  links?: string[];
  followers?: number;
  following?: number;
  createdAt?: string;
  role?: "CLIENT" | "VIDEOGRAPHER" | "PHOTOGRAPHER";

  specialization?: string[];
  pricePerHour?: number | null;

  // legacy
  portfolioVideos?: string[];

  // ✅ NEW
  providerPortfolio?: ProviderPortfolioItem[];
};

type Post = {
  id: number | string;
  imageUrl?: string;
  // ✅ FIX: разрешаем null (потому что API возвращает null)
  videoUrl?: string | null;
  caption: string;
  location: string;
  createdAt: string;
};

type ProviderReview = {
  id: number;
  rating: number;
  text: string;
  createdAt: string;
  client: { id: number | string; username: string; avatarUrl?: string };
};

type ReviewsPayload = {
  reviews: ProviderReview[];
  avgRating: number;
  count: number;
};

function isProviderRole(role?: string) {
  return role === "VIDEOGRAPHER" || role === "PHOTOGRAPHER";
}

function isValidHttpUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// YouTube/Vimeo -> embed
function toEmbedUrl(url: string) {
  const u = url.trim();

  // YouTube
  const yt1 = u.match(/youtube\.com\/watch\?v=([^&]+)/i);
  const yt2 = u.match(/youtu\.be\/([^?&]+)/i);
  const yt3 = u.match(/youtube\.com\/shorts\/([^?&]+)/i);
  const ytId = yt1?.[1] || yt2?.[1] || yt3?.[1];
  if (ytId) return `https://www.youtube.com/embed/${ytId}`;

  // Vimeo
  const vimeo = u.match(/vimeo\.com\/(\d+)/i);
  if (vimeo?.[1]) return `https://player.vimeo.com/video/${vimeo[1]}`;

  return null;
}

function PortfolioCard({ item }: { item: ProviderPortfolioItem }) {
  const embed = useMemo(() => (item.kind === "VIDEO" ? toEmbedUrl(item.url) : null), [item]);

  return (
    <div style={{ border: "1px solid #333", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ background: "rgba(255,255,255,0.03)" }}>
        {item.kind === "IMAGE" ? (
          <img
            src={item.thumbUrl || item.url}
            alt={item.title || "portfolio"}
            style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover" }}
          />
        ) : item.kind === "VIDEO" && embed ? (
          <iframe
            src={embed}
            title={item.title || "video"}
            style={{ width: "100%", aspectRatio: "16/9", border: 0, display: "block" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div style={{ padding: 12 }}>
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.url}
            </a>
          </div>
        )}
      </div>

      <div style={{ padding: 10, display: "grid", gap: 6 }}>
        {item.title ? <div style={{ fontWeight: 700 }}>{item.title}</div> : null}
        {item.description ? (
          <div style={{ opacity: 0.85, whiteSpace: "pre-wrap" }}>{item.description}</div>
        ) : null}
        <div style={{ display: "flex", gap: 10, opacity: 0.8, fontSize: 12 }}>
          <span>{item.kind}</span>
          {typeof item.order === "number" ? <span>Order: {item.order}</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { username } = useParams();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [meId, setMeId] = useState<number | string | null>(null);

  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [posts, setPosts] = useState<Post[] | null>(null);

  const [reviewsData, setReviewsData] = useState<ReviewsPayload | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsErr, setReviewsErr] = useState<string | null>(null);

  // ✅ ProviderPortfolio state
  const [portfolio, setPortfolio] = useState<ProviderPortfolioItem[] | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioErr, setPortfolioErr] = useState<string | null>(null);

  // ✅ Add form (only for provider + my profile)
  const [ppKind, setPpKind] = useState<"IMAGE" | "VIDEO" | "LINK">("VIDEO");
  const [ppTitle, setPpTitle] = useState("");
  const [ppUrl, setPpUrl] = useState("");
  const [ppThumb, setPpThumb] = useState("");
  const [ppDesc, setPpDesc] = useState("");
  const [ppOrder, setPpOrder] = useState<number>(0);
  const [ppBusy, setPpBusy] = useState(false);

  function formatDate(iso: string) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  }

  function Stars({ value }: { value: number }) {
    const full = Math.round(value);
    const safe = Math.max(0, Math.min(5, full));
    return (
      <span aria-label={`rating ${value}`}>
        {"★".repeat(safe)}
        {"☆".repeat(5 - safe)}
      </span>
    );
  }

  // Загружаем публичный профиль + посты
  useEffect(() => {
    if (!username) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await getUserByUsername(username);
        setUser(res.user);

        const postsRes = await getUserPosts(username);
        setPosts(postsRes.posts);
      } catch (e: any) {
        setErr(e?.response?.data?.error || "Profile not found");
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

  // Кто я (me)
  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        setMeId(me.user?.id ?? null);
      } catch {
        setMeId(null);
      }
    })();
  }, []);

  // Статус подписки
  useEffect(() => {
    (async () => {
      if (!meId || !user || meId === user.id) return;
      try {
        const st = await getFollowStatus(user.id);
        setIsFollowing(st.following);
      } catch {}
    })();
  }, [meId, user]);

  // ✅ Reviews for provider
  useEffect(() => {
    if (!username) return;

    (async () => {
      setReviewsErr(null);
      setReviewsData(null);

      if (!isProviderRole(user?.role)) return;

      try {
        setReviewsLoading(true);
        const data = await getProviderReviews(username);
        setReviewsData(data);
      } catch (e: any) {
        setReviewsErr(e?.response?.data?.error || "Failed to load reviews");
      } finally {
        setReviewsLoading(false);
      }
    })();
  }, [username, user?.role]);

  // ✅ ProviderPortfolio (public)
  useEffect(() => {
    if (!username) return;

    (async () => {
      setPortfolioErr(null);
      setPortfolio(null);

      if (!isProviderRole(user?.role)) return;

      try {
        setPortfolioLoading(true);
        const data = await getUserPortfolio(username);
        setPortfolio(data.items);
      } catch (e: any) {
        setPortfolioErr(e?.response?.data?.error || "Failed to load portfolio");
      } finally {
        setPortfolioLoading(false);
      }
    })();
  }, [username, user?.role]);

  async function onFollow() {
    if (!user || !meId || meId === user.id) return;
    setBusy(true);
    try {
      await followUser(user.id);
      setIsFollowing(true);
      setUser((u) => (u ? { ...u, followers: (u.followers ?? 0) + 1 } : u));
    } catch (e: any) {
      alert(e?.response?.data?.error || "Follow failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUnfollow() {
    if (!user || !meId || meId === user.id) return;
    setBusy(true);
    try {
      await unfollowUser(user.id);
      setIsFollowing(false);
      setUser((u) => (u ? { ...u, followers: Math.max(0, (u.followers ?? 0) - 1) } : u));
    } catch (e: any) {
      alert(e?.response?.data?.error || "Unfollow failed");
    } finally {
      setBusy(false);
    }
  }

  async function addPortfolioItem() {
    if (!user) return;
    if (!isProviderRole(user.role)) return;

    const url = ppUrl.trim();
    const thumb = ppThumb.trim();

    if (!url || !isValidHttpUrl(url)) {
      alert("Please provide a valid http(s) URL");
      return;
    }
    if (thumb && !isValidHttpUrl(thumb)) {
      alert("Thumb URL must be http(s)");
      return;
    }

    setPpBusy(true);
    try {
      const created = await createPortfolioItem({
        kind: ppKind,
        title: ppTitle.trim() || undefined,
        url,
        thumbUrl: thumb || undefined,
        description: ppDesc.trim() || undefined,
        order: Number.isFinite(ppOrder) ? ppOrder : 0,
      });

      setPortfolio((prev) => {
        const next = [...(prev || []), created.item];
        next.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return next;
      });

      setPpTitle("");
      setPpUrl("");
      setPpThumb("");
      setPpDesc("");
      setPpOrder(0);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Failed to add portfolio item");
    } finally {
      setPpBusy(false);
    }
  }

  async function removePortfolioItem(id: number) {
    if (!confirm("Delete this portfolio item?")) return;
    setPpBusy(true);
    try {
      await deletePortfolioItem(id);
      setPortfolio((prev) => (prev || []).filter((x) => x.id !== id));
    } catch (e: any) {
      alert(e?.response?.data?.error || "Delete failed");
    } finally {
      setPpBusy(false);
    }
  }

  if (loading) return <div>Loading profile...</div>;
  if (err) return <div style={{ color: "crimson" }}>{err}</div>;
  if (!user) return null;

  const isMe = meId && user && meId === user.id;
  const isProvider = isProviderRole(user.role);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Avatar src={user.avatarUrl} size={96} alt={user.username} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>@{user.username}</h2>
          {user.role && (
            <div style={{ opacity: 0.8 }}>
              Role: <b>{user.role}</b>
            </div>
          )}
          {user.location && <div>📍 {user.location}</div>}
          <div>
            Followers: {user.followers ?? 0} · Following: {user.following ?? 0}
          </div>
        </div>

        {!isMe &&
          meId &&
          (isFollowing ? (
            <button disabled={busy} onClick={onUnfollow}>
              Unfollow
            </button>
          ) : (
            <button disabled={busy} onClick={onFollow}>
              Follow
            </button>
          ))}
      </header>

      {isProvider && (
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link to={`/book/${user.username}`}>See schedule (book)</Link>
          {isMe && <Link to="/schedule">Open my schedule</Link>}
        </div>
      )}

      {user.bio && <p>{user.bio}</p>}

      {!!user.links?.length && (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {user.links.map((l) => (
            <li key={l}>
              <a href={l} target="_blank" rel="noreferrer">
                {l}
              </a>
            </li>
          ))}
        </ul>
      )}

      {isProvider && (
        <div style={{ border: "1px solid #333", borderRadius: 8, padding: 12, marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Professional info</h3>
          <p>
            <b>Role:</b> {user.role}
          </p>

          {user.specialization?.length ? (
            <p>
              <b>Specialization:</b> {user.specialization.join(", ")}
            </p>
          ) : null}

          {user.pricePerHour ? (
            <p>
              <b>Price per hour:</b> {user.pricePerHour} €
            </p>
          ) : null}

          {user.portfolioVideos?.length ? (
            <div>
              <b>Legacy Portfolio (portfolioVideos):</b>
              <ul>
                {user.portfolioVideos.map((v, i) => (
                  <li key={i}>
                    <a href={v} target="_blank" rel="noreferrer">
                      {v}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {isProvider && (
        <section style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Portfolio</h3>

          {isMe && (
            <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Add portfolio item</div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <label>
                    Kind{" "}
                    <select value={ppKind} onChange={(e) => setPpKind(e.target.value as any)}>
                      <option value="VIDEO">VIDEO</option>
                      <option value="IMAGE">IMAGE</option>
                      <option value="LINK">LINK</option>
                    </select>
                  </label>

                  <label>
                    Order{" "}
                    <input
                      type="number"
                      value={ppOrder}
                      onChange={(e) => setPpOrder(Number(e.target.value))}
                      style={{ width: 90 }}
                    />
                  </label>
                </div>

                <input placeholder="Title (optional)" value={ppTitle} onChange={(e) => setPpTitle(e.target.value)} />
                <input
                  placeholder="URL (required) https://..."
                  value={ppUrl}
                  onChange={(e) => setPpUrl(e.target.value)}
                />
                <input
                  placeholder="Thumb URL (optional) https://..."
                  value={ppThumb}
                  onChange={(e) => setPpThumb(e.target.value)}
                />
                <textarea
                  placeholder="Description (optional)"
                  value={ppDesc}
                  onChange={(e) => setPpDesc(e.target.value)}
                  rows={3}
                />

                <button disabled={ppBusy} onClick={addPortfolioItem}>
                  {ppBusy ? "Saving..." : "Add"}
                </button>
               
              </div>
            </div>
          )}

          {portfolioLoading ? (
            <div>Loading portfolio...</div>
          ) : portfolioErr ? (
            <div style={{ color: "crimson" }}>{portfolioErr}</div>
          ) : portfolio && portfolio.length ? (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {portfolio.map((it) => (
                <div key={it.id} style={{ position: "relative" }}>
                  <PortfolioCard item={it} />
                  {isMe && (
                    <button
                      disabled={ppBusy}
                      onClick={() => removePortfolioItem(it.id)}
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid #333",
                        background: "rgba(0,0,0,0.6)",
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.8 }}>No portfolio items yet</div>
          )}
        </section>
      )}

      {isProvider && (
        <section style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Reviews</h3>

          {reviewsLoading ? (
            <div>Loading reviews...</div>
          ) : reviewsErr ? (
            <div style={{ color: "crimson" }}>{reviewsErr}</div>
          ) : reviewsData ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 18 }}>
                  <b>{reviewsData.avgRating.toFixed(1)}</b>/5{" "}
                  <span style={{ opacity: 0.8 }}>
                    (<b>{reviewsData.count}</b> {reviewsData.count === 1 ? "review" : "reviews"})
                  </span>
                </div>
                <div style={{ fontSize: 18 }}>
                  <Stars value={reviewsData.avgRating} />
                </div>
              </div>

              {reviewsData.reviews.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {reviewsData.reviews.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        border: "1px solid #333",
                        borderRadius: 12,
                        padding: 10,
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar src={r.client.avatarUrl} size={34} alt={r.client.username} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>@{r.client.username}</div>
                          <div style={{ opacity: 0.7, fontSize: 12 }}>{formatDate(r.createdAt)}</div>
                        </div>
                        <div style={{ fontSize: 16 }}>
                          <Stars value={r.rating} /> <span style={{ opacity: 0.8 }}>{r.rating}/5</span>
                        </div>
                      </div>

                      {r.text ? (
                        <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{r.text}</div>
                      ) : (
                        <div style={{ marginTop: 8, opacity: 0.7 }}>No text</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ opacity: 0.8 }}>No reviews yet</div>
              )}
            </>
          ) : (
            <div style={{ opacity: 0.8 }}>No reviews yet</div>
          )}
        </section>
      )}

<hr style={{ opacity: 0.2 }} />

<h3 style={{ margin: 0 }}>Posts</h3>

{!posts ? (
  <div>Loading posts...</div>
) : posts.length ? (
  <div className="profileGrid">
    {posts.map((p) => (
  <div key={p.id} className="profileGridItem">
    {p.videoUrl ? (
      <video
        src={p.videoUrl}
        muted
        playsInline
        preload="metadata"
        className="profileGridMedia"
      />
    ) : p.imageUrl ? (
      <img
        src={p.imageUrl}
        alt=""
        className="profileGridMedia"
        loading="lazy"
        onError={(e) => {
          // если картинка не загрузилась — скрываем <img> и показываем "+"
          e.currentTarget.style.display = "none";
          const parent = e.currentTarget.parentElement;
          if (parent && !parent.querySelector(".profileGridEmpty")) {
            const div = document.createElement("div");
            div.className = "profileGridEmpty";
            div.textContent = "+";
            parent.appendChild(div);
          }
        }}
      />
    ) : (
      <div className="profileGridEmpty">+</div>
    )}

    {p.videoUrl ? <div className="gridBadge">🎥</div> : null}
  </div>
))}
  </div>
) : (
  <div>No posts yet</div>
)}


      <div>
        <Link to="/">← Back to feed</Link>
      </div>
    </div>
  );
}
