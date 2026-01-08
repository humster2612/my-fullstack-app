// client/src/pages/ProfilePage.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Avatar from "../Avatar";
import {
  getUserByUsername,
  getMe,
  getFollowStatus,
  followUser,
  unfollowUser,
  getUserPosts,
  createBooking,
  getProviderReviews,
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
  portfolioVideos?: string[];
};

type Post = {
  id: number | string;
  imageUrl?: string;
  videoUrl?: string;
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

export default function ProfilePage() {
  const { username } = useParams();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [meId, setMeId] = useState<number | string | null>(null);
  const [meUsername, setMeUsername] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [posts, setPosts] = useState<Post[] | null>(null);

  const [reviewsData, setReviewsData] = useState<ReviewsPayload | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsErr, setReviewsErr] = useState<string | null>(null);

  // helpers
  function formatDate(iso: string) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "2-digit",
        });
  }

  function Stars({ value }: { value: number }) {
    const full = Math.round(value); // если хочешь строже — замени на Math.floor(value)
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
        setMeUsername(me.user?.username ?? null);
      } catch {
        setMeId(null);
        setMeUsername(null);
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

      // отзывы нужны только для провайдера
      if (!(user?.role === "VIDEOGRAPHER" || user?.role === "PHOTOGRAPHER")) return;

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
      setUser((u) =>
        u ? { ...u, followers: Math.max(0, (u.followers ?? 0) - 1) } : u
      );
    } catch (e: any) {
      alert(e?.response?.data?.error || "Unfollow failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div>Loading profile...</div>;
  if (err) return <div style={{ color: "crimson" }}>{err}</div>;
  if (!user) return null;

  const isMe = meId && user && meId === user.id;
  const isProvider = user.role === "VIDEOGRAPHER" || user.role === "PHOTOGRAPHER";
  const canBook = !isMe && !!meId && !!meUsername && isProvider;

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

        {!isMe && meId &&
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

      {/* Кнопка бронирования — только если это провайдер и это не мой профиль */}
      {/* {canBook && <BookForm providerId={user.id} />} */}

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
              <b>Portfolio:</b>
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

      {/* ✅ REVIEWS BLOCK */}
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
                    (<b>{reviewsData.count}</b>{" "}
                    {reviewsData.count === 1 ? "review" : "reviews"})
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
                          <Stars value={r.rating} />{" "}
                          <span style={{ opacity: 0.8 }}>{r.rating}/5</span>
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
        <div style={{ display: "grid", gap: 12 }}>
          {posts.map((p) => (
            <div
              key={p.id}
              style={{ border: "1px solid #333", borderRadius: 12, overflow: "hidden" }}
            >
              {p.videoUrl ? (
                <video src={p.videoUrl} controls style={{ width: "100%", display: "block" }} />
              ) : (
                <img
                  src={p.imageUrl || "https://via.placeholder.com/600x400"}
                  alt=""
                  style={{ width: "100%", display: "block" }}
                />
              )}

              {(p.caption || p.location) && (
                <div style={{ padding: 8 }}>
                  {p.location && <div style={{ opacity: 0.8 }}>📍 {p.location}</div>}
                  {p.caption && <div>{p.caption}</div>}
                </div>
              )}
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

/* ---------- Форма бронирования ---------- */
// function BookForm({ providerId }: { providerId: number | string }) {
//   const [date, setDate] = useState<string>("");
//   const [note, setNote] = useState<string>("");
//   const [ok, setOk] = useState<string | null>(null);
//   const [err, setErr] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);

//   const submit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setErr(null);
//     setOk(null);
//     if (!date) {
//       setErr("Выберите дату");
//       return;
//     }
//     try {
//       setLoading(true);
//       await createBooking(providerId, new Date(date).toISOString(), note);
//       setOk("Запрос отправлен!");
//       setDate("");
//       setNote("");
//     } catch (e: any) {
//       setErr(e?.response?.data?.error || "Ошибка бронирования");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <form
//       onSubmit={submit}
//       style={{ display: "grid", gap: 8, maxWidth: 360, margin: "12px 0" }}
//     >
//       <h3>Book session</h3>
//       <input
//         type="datetime-local"
//         value={date}
//         onChange={(e) => setDate(e.target.value)}
//       />
//       <input
//         placeholder="Note (optional)"
//         value={note}
//         onChange={(e) => setNote(e.target.value)}
//       />
//       <button disabled={loading}>{loading ? "Sending..." : "Send request"}</button>
//       {ok && <div style={{ color: "limegreen" }}>{ok}</div>}
//       {err && <div style={{ color: "crimson" }}>{err}</div>}
//     </form>
//   );
// }
