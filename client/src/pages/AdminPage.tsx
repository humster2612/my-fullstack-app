// client/src/pages/AdminPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  adminListAnnouncements,
  adminCreateAnnouncement,
  adminUpdateAnnouncement,
  adminDeleteAnnouncement,
  adminGetLogs,
  adminListPosts,
  adminDeletePost,
  adminWarnUser,
  adminBanUser,
  adminListReports,
  adminResolveReport,
} from "../api";

import type { Announcement, AdminLogItem } from "../api";

type ModPost = {
  id: number;
  imageUrl: string;
  caption: string;
  location: string;
  createdAt: string;
  author: {
    id: number;
    username?: string | null;
    email?: string;
    bannedUntil?: string | null;
  };
  _count?: { likes: number; comments: number };
};

type ReportItem = {
  id: number;
  createdAt: string;
  status: "OPEN" | "RESOLVED";
  reason: string;
  message?: string | null;
  targetType: "POST" | "COMMENT" | "USER";
  postId?: number | null;
  commentId?: number | null;
  targetUserId?: number | null;

  reporter?: { id: number; username?: string | null; email?: string };
  handledBy?: { id: number; username?: string | null };

  post?: {
    id: number;
    imageUrl: string;
    caption: string;
    createdAt: string;
    author?: { id: number; username?: string | null };
  } | null;

  comment?: {
    id: number;
    text: string;
    createdAt: string;
    postId: number;
    author?: { id: number; username?: string | null };
  } | null;

  targetUser?: {
    id: number;
    username?: string | null;
    email?: string;
    bannedUntil?: string | null;
  } | null;
};

export default function AdminPage() {
  const [tab, setTab] = useState<"ann" | "logs" | "mod" | "reports">("ann");

  const [anns, setAnns] = useState<Announcement[]>([]);
  const [logs, setLogs] = useState<AdminLogItem[]>([]);
  const [modPosts, setModPosts] = useState<ModPost[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // create announcement form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);

  // busy for buttons (чтобы не было двойных кликов)
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // reports filter
  const [reportStatus, setReportStatus] = useState<"OPEN" | "RESOLVED">("OPEN");

  const isBusy = (key: string) => busyKey === key;

  async function loadAll() {
    setLoading(true);
    setErr(null);

    const results = await Promise.allSettled([
      adminListAnnouncements(),
      adminGetLogs(),
      adminListPosts(),
      adminListReports({ status: reportStatus }),
    ]);

    if (results[0].status === "fulfilled") setAnns(results[0].value.announcements || []);
    else console.error("announcements failed:", results[0].reason);

    if (results[1].status === "fulfilled") setLogs(results[1].value.logs || []);
    else console.error("logs failed:", results[1].reason);

    if (results[2].status === "fulfilled") setModPosts(results[2].value.posts || []);
    else console.error("posts failed:", results[2].reason);

    if (results[3].status === "fulfilled") setReports(results[3].value.reports || []);
    else {
      console.error("reports failed:", results[3].reason);
      setErr(
        (results[3] as any)?.reason?.response?.data?.error ||
          (results[3] as any)?.reason?.message ||
          "Failed to load reports"
      );
    }

    setLoading(false);
  }

  async function refreshReportsOnly() {
    try {
      const r = await adminListReports({ status: reportStatus });
      setReports(r.reports || []);
    } catch (e: any) {
      console.error("refreshReportsOnly error:", e);
      // ✅ НЕ alert здесь — чтобы не бесило пользователя
      setErr(e?.response?.data?.error || e?.message || "Failed to load reports");
    }
  }

  async function refreshPostsOnly() {
    try {
      const p = await adminListPosts();
      setModPosts(p.posts || []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Failed to load posts");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshReportsOnly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportStatus]);

  // ---------------- Announcements ----------------
  async function onCreateAnn() {
    if (!title.trim()) return;
    const key = "ann:create";
    if (isBusy(key)) return;

    setBusyKey(key);
    try {
      const res = await adminCreateAnnouncement({
        title: title.trim(),
        body: body.trim(),
        isActive,
      });
      setAnns((prev) => [res.announcement, ...prev]);
      setTitle("");
      setBody("");
      setIsActive(true);

      const l = await adminGetLogs();
      setLogs(l.logs || []);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Create failed");
    } finally {
      setBusyKey(null);
    }
  }

  async function onToggleActive(a: Announcement) {
    const key = `ann:toggle:${a.id}`;
    if (isBusy(key)) return;

    setBusyKey(key);
    try {
      const res = await adminUpdateAnnouncement(a.id, { isActive: !a.isActive });
      setAnns((prev) => prev.map((x) => (x.id === a.id ? res.announcement : x)));

      const l = await adminGetLogs();
      setLogs(l.logs || []);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Update failed");
    } finally {
      setBusyKey(null);
    }
  }

  async function onDeleteAnn(id: number) {
    if (!confirm("Delete announcement?")) return;

    const key = `ann:delete:${id}`;
    if (isBusy(key)) return;

    setBusyKey(key);
    try {
      await adminDeleteAnnouncement(id);
      setAnns((prev) => prev.filter((x) => x.id !== id));

      const l = await adminGetLogs();
      setLogs(l.logs || []);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Delete failed");
    } finally {
      setBusyKey(null);
    }
  }

  // ---------------- Moderation: Posts ----------------
  async function onAdminDeletePost(postId: number) {
    if (!confirm("Delete post?")) return;

    const key = `post:delete:${postId}`;
    if (isBusy(key)) return;

    setBusyKey(key);
    try {
      await adminDeletePost(postId);

      // ✅ убираем из списка постов
      setModPosts((prev) => prev.filter((p) => p.id !== postId));

      // ✅ и убираем связанные репорты (чтобы не было кликов по "мертвым" репортам)
      setReports((prev) => prev.filter((r) => r.postId !== postId));

      const l = await adminGetLogs();
      setLogs(l.logs || []);
    } catch (e: any) {
      // из-за фикса на сервере 404 уже не будет.
      alert(e?.response?.data?.error || "Delete post failed");
    } finally {
      setBusyKey(null);
    }
  }

  async function onWarnUser(userId: number) {
    const text = prompt("Warning text to user:");
    if (!text || !text.trim()) return;

    const key = `user:warn:${userId}`;
    if (isBusy(key)) return;

    setBusyKey(key);
    try {
      await adminWarnUser(userId, text.trim());
      alert("Warning sent ✅");

      const l = await adminGetLogs();
      setLogs(l.logs || []);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Warning failed");
    } finally {
      setBusyKey(null);
    }
  }

  async function onBanUser(userId: number) {
    const daysStr = prompt("Ban for how many days? (1..365)", "7");
    if (!daysStr) return;

    const days = Number(daysStr);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      alert("Days must be 1..365");
      return;
    }

    const key = `user:ban:${userId}`;
    if (isBusy(key)) return;

    setBusyKey(key);
    try {
      await adminBanUser(userId, days);
      alert("User banned ✅");

      await refreshPostsOnly();
      const l = await adminGetLogs();
      setLogs(l.logs || []);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Ban failed");
    } finally {
      setBusyKey(null);
    }
  }

  // ---------------- Reports ----------------
  function inferTargetUserId(r: ReportItem): number | null {
    if (r.targetType === "USER" && r.targetUserId) return Number(r.targetUserId);
    if (r.targetType === "POST" && r.post?.author?.id) return Number(r.post.author.id);
    if (r.targetType === "COMMENT" && r.comment?.author?.id) return Number(r.comment.author.id);
    return null;
  }

  async function onResolveReport(reportId: number) {
    if (!confirm("Mark report as RESOLVED?")) return;

    const key = `report:resolve:${reportId}`;
    if (isBusy(key)) return;

    setBusyKey(key);
    try {
      await adminResolveReport(reportId);

      // ✅ если мы смотрим OPEN — удаляем из списка сразу
      if (reportStatus === "OPEN") {
        setReports((prev) => prev.filter((x) => x.id !== reportId));
      } else {
        await refreshReportsOnly();
      }

      const l = await adminGetLogs();
      setLogs(l.logs || []);
    } catch (e: any) {
      // из-за фикса на сервере 404 уже не будет.
      alert(e?.response?.data?.error || "Resolve failed");
    } finally {
      setBusyKey(null);
    }
  }

  const tabButtons = useMemo(
    () => (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setTab("ann")} disabled={tab === "ann"}>
          Announcements
        </button>
        <button type="button" onClick={() => setTab("mod")} disabled={tab === "mod"}>
          Moderation
        </button>
        <button type="button" onClick={() => setTab("reports")} disabled={tab === "reports"}>
          Reports
        </button>
        <button type="button" onClick={() => setTab("logs")} disabled={tab === "logs"}>
          AdminLog
        </button>

        <div style={{ marginLeft: "auto" }}>
          <button type="button" onClick={loadAll}>
            Refresh
          </button>
        </div>
      </div>
    ),
    [tab] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 980 }}>
      <h2>Admin</h2>

      {err && <div style={{ color: "crimson" }}>{err}</div>}
      {loading && <div>Loading…</div>}

      {tabButtons}

      {/* ------------------- ANNOUNCEMENTS ------------------- */}
      {tab === "ann" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
            <h3 style={{ margin: 0 }}>Create announcement</h3>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body" rows={4} />
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active
            </label>
            <button type="button" onClick={onCreateAnn} disabled={isBusy("ann:create")}>
              Create
            </button>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {anns.map((a) => (
              <div key={a.id} style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.title}</div>
                    {!!a.body && <div style={{ opacity: 0.9, marginTop: 6, whiteSpace: "pre-wrap" }}>{a.body}</div>}
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                      {new Date(a.createdAt).toLocaleString()} · {a.isActive ? "ACTIVE" : "INACTIVE"}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                    <button
                      type="button"
                      onClick={() => onToggleActive(a)}
                      disabled={isBusy(`ann:toggle:${a.id}`)}
                    >
                      {a.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAnn(a.id)}
                      style={{ color: "crimson" }}
                      disabled={isBusy(`ann:delete:${a.id}`)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {!loading && !anns.length && <div style={{ opacity: 0.7 }}>No announcements yet.</div>}
          </div>
        </div>
      )}

      {/* ------------------- MODERATION POSTS ------------------- */}
      {tab === "mod" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Moderation — Posts</h3>
            <div style={{ marginLeft: "auto" }}>
              <button type="button" onClick={refreshPostsOnly}>
                Refresh posts
              </button>
            </div>
          </div>

          {modPosts.map((p) => (
            <div key={p.id} style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>
                  Post #{p.id} · @{p.author?.username ?? "user"}
                </div>
                <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.75 }}>
                  {new Date(p.createdAt).toLocaleString()}
                </div>
              </div>

              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
                Likes: {p._count?.likes ?? 0} · Comments: {p._count?.comments ?? 0}
              </div>

              {!!p.author?.bannedUntil && (
                <div style={{ fontSize: 12, marginTop: 6, color: "salmon" }}>
                  BANNED UNTIL: {new Date(p.author.bannedUntil).toLocaleString()}
                </div>
              )}

              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                <img src={p.imageUrl} alt="" style={{ width: "100%", borderRadius: 12 }} />
                {(p.caption || p.location) && (
                  <div style={{ opacity: 0.9 }}>
                    {p.location ? <div>📍 {p.location}</div> : null}
                    {p.caption ? <div>{p.caption}</div> : null}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => onAdminDeletePost(p.id)}
                  disabled={isBusy(`post:delete:${p.id}`)}
                  style={{ color: "crimson" }}
                >
                  Delete post
                </button>

                <button type="button" onClick={() => onWarnUser(p.author.id)} disabled={isBusy(`user:warn:${p.author.id}`)}>
                  Warn user
                </button>

                <button type="button" onClick={() => onBanUser(p.author.id)} disabled={isBusy(`user:ban:${p.author.id}`)}>
                  Ban user
                </button>
              </div>
            </div>
          ))}

          {!loading && !modPosts.length && <div style={{ opacity: 0.7 }}>No posts found.</div>}
        </div>
      )}

      {/* ------------------- REPORTS ------------------- */}
      {tab === "reports" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Reports</h3>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              Status:
              <select value={reportStatus} onChange={(e) => setReportStatus(e.target.value as any)}>
                <option value="OPEN">OPEN</option>
                <option value="RESOLVED">RESOLVED</option>
              </select>
            </label>

            <div style={{ marginLeft: "auto" }}>
              <button type="button" onClick={refreshReportsOnly}>
                Refresh reports
              </button>
            </div>
          </div>

          {reports.map((r) => {
            const targetUserId = inferTargetUserId(r);
            const targetLabel =
              r.targetType === "POST"
                ? `POST #${r.postId ?? ""}`
                : r.targetType === "COMMENT"
                ? `COMMENT #${r.commentId ?? ""}`
                : `USER #${r.targetUserId ?? ""}`;

            return (
              <div key={r.id} style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800 }}>
                    Report #{r.id} · {r.status} · {targetLabel}
                  </div>
                  <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.75 }}>
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                </div>

                <div style={{ marginTop: 6 }}>
                  <div><b>Reason:</b> {r.reason}</div>
                  {!!r.message && (
                    <div style={{ opacity: 0.9, marginTop: 4, whiteSpace: "pre-wrap" }}>
                      <b>Message:</b> {r.message}
                    </div>
                  )}
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                    Reporter: @{r.reporter?.username ?? "unknown"} {r.reporter?.email ? `(${r.reporter.email})` : ""}
                    {r.handledBy?.username ? ` · handled by @${r.handledBy.username}` : ""}
                  </div>
                </div>

                {r.post && (
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <div style={{ fontWeight: 700 }}>Post preview</div>
                    <img src={r.post.imageUrl} alt="" style={{ width: "100%", borderRadius: 12 }} />
                    {!!r.post.caption && <div style={{ opacity: 0.9 }}>{r.post.caption}</div>}
                  </div>
                )}

                {r.comment && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 700 }}>Comment preview</div>
                    <div style={{ opacity: 0.9 }}>
                      @{r.comment.author?.username ?? "user"}: {r.comment.text}
                    </div>
                  </div>
                )}

                {r.targetUser && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 700 }}>User</div>
                    <div style={{ opacity: 0.9 }}>
                      @{r.targetUser.username ?? "user"} {r.targetUser.email ? `(${r.targetUser.email})` : ""}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {r.status === "OPEN" && (
                    <button
                      type="button"
                      onClick={() => onResolveReport(r.id)}
                      disabled={isBusy(`report:resolve:${r.id}`)}
                    >
                      Resolve
                    </button>
                  )}

                  {r.targetType === "POST" && r.postId ? (
                    <button
                      type="button"
                      onClick={() => onAdminDeletePost(Number(r.postId))}
                      style={{ color: "crimson" }}
                      disabled={isBusy(`post:delete:${Number(r.postId)}`)}
                    >
                      Delete post
                    </button>
                  ) : null}

                  {targetUserId ? (
                    <>
                      <button type="button" onClick={() => onWarnUser(targetUserId)} disabled={isBusy(`user:warn:${targetUserId}`)}>
                        Warn user
                      </button>
                      <button type="button" onClick={() => onBanUser(targetUserId)} disabled={isBusy(`user:ban:${targetUserId}`)}>
                        Ban user
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}

          {!loading && !reports.length && <div style={{ opacity: 0.7 }}>No reports found.</div>}
        </div>
      )}

      {/* ------------------- LOGS ------------------- */}
      {tab === "logs" && (
        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>AdminLog (last 100)</h3>

          <div style={{ display: "grid", gap: 8 }}>
            {logs.map((l) => (
              <div key={l.id} style={{ borderBottom: "1px solid #2a2a2a", paddingBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>
                  {l.action}{" "}
                  <span style={{ fontWeight: 400, opacity: 0.8 }}>
                    · {new Date(l.createdAt).toLocaleString()}
                  </span>
                </div>

                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Admin: @{l.admin?.username ?? "admin"} · {l.entity ? `${l.entity}#${l.entityId ?? ""}` : ""}
                </div>

                {l.meta?.title && (
                  <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
                    Title: <b>{l.meta.title}</b>
                  </div>
                )}
                {l.meta?.days && (
                  <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
                    Days: <b>{l.meta.days}</b>
                  </div>
                )}
              </div>
            ))}

            {!loading && !logs.length && <div style={{ opacity: 0.7 }}>No logs yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
