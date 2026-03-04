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
import "../styles/admin.css";

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

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [busyKey, setBusyKey] = useState<string | null>(null);

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
  }, []);

  useEffect(() => {
    refreshReportsOnly();
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



  async function onAdminDeletePost(postId: number) {
    if (!confirm("Delete post?")) return;

    const key = `post:delete:${postId}`;
    if (isBusy(key)) return;

    setBusyKey(key);
    try {
      await adminDeletePost(postId);

      setModPosts((prev) => prev.filter((p) => p.id !== postId));
      setReports((prev) => prev.filter((r) => r.postId !== postId));

      const l = await adminGetLogs();
      setLogs(l.logs || []);
    } catch (e: any) {
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
      alert("Warning sent ");

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
      alert("User banned ");

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

      if (reportStatus === "OPEN") {
        setReports((prev) => prev.filter((x) => x.id !== reportId));
      } else {
        await refreshReportsOnly();
      }

      const l = await adminGetLogs();
      setLogs(l.logs || []);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Resolve failed");
    } finally {
      setBusyKey(null);
    }
  }

  const tabButtons = useMemo(
    () => (
      <div className="adTabsRow">
        <div className="adTabs">
          <button className={`adTab ${tab === "ann" ? "active" : ""}`} type="button" onClick={() => setTab("ann")}>
            Announcements
          </button>
          <button className={`adTab ${tab === "mod" ? "active" : ""}`} type="button" onClick={() => setTab("mod")}>
            Moderation
          </button>
          <button className={`adTab ${tab === "reports" ? "active" : ""}`} type="button" onClick={() => setTab("reports")}>
            Reports
          </button>
          <button className={`adTab ${tab === "logs" ? "active" : ""}`} type="button" onClick={() => setTab("logs")}>
            AdminLog
          </button>
        </div>

        <div className="adTabsRight">
          <button className="adBtn" type="button" onClick={loadAll}>
            Refresh
          </button>
        </div>
      </div>
    ),
    [tab] 
  );

  const reportPosts = useMemo(
    () => reports.filter((r) => r.targetType === "POST" && r.postId),
    [reports]
  );
  const reportOther = useMemo(
    () => reports.filter((r) => r.targetType !== "POST"),
    [reports]
  );

  return (
    <div className="adWrap">
      <div className="adHeader">
        <h2 className="adTitle">Admin</h2>
        {err && <div className="adErr">{err}</div>}
        {loading && <div className="adMuted">Loading…</div>}
      </div>

      {tabButtons}





      {/* ------------------- ANNOUNCEMENTS ------------------- */}
      {tab === "ann" && (
        <div className="adSection">
          <div className="adCard">
            <div className="adCardTop">
              <h3 className="adCardTitle">Create announcement</h3>
              {/* <div className="adCardHint">Title + body (optional) · set active status</div> */}
            </div>

            <div className="adForm">
              <label className="adField">
                <span className="adLabel">Title</span>
                <input className="adInput" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
              </label>

              <label className="adField">
                <span className="adLabel">Body</span>
                <textarea
                  className="adInput adTextarea"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Body"
                  rows={4}
                />
              </label>

              <label className="adCheck">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active
              </label>

              <button className="adBtnPrimary" type="button" onClick={onCreateAnn} disabled={isBusy("ann:create")}>
                Create
              </button>
            </div>
          </div>

          <div className="adList">
            {anns.map((a) => (
              <div key={a.id} className="adCard">
                <div className="adAnnRow">
                  <div className="adAnnMain">
                    <div className="adAnnTitle">{a.title}</div>
                    {!!a.body && <div className="adAnnBody">{a.body}</div>}
                    <div className="adMeta">
                      {new Date(a.createdAt).toLocaleString()}  {a.isActive ? "ACTIVE" : "INACTIVE"}
                    </div>
                  </div>

                  <div className="adAnnActions">
                    <button
                      className="adBtn"
                      type="button"
                      onClick={() => onToggleActive(a)}
                      disabled={isBusy(`ann:toggle:${a.id}`)}
                    >
                      {a.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      className="adBtnDanger"
                      type="button"
                      onClick={() => onDeleteAnn(a.id)}
                      disabled={isBusy(`ann:delete:${a.id}`)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {!loading && !anns.length && <div className="adMuted">No announcements yet.</div>}
          </div>
        </div>
      )}







      {/* ------------------- MODERATION POSTS ------------------- */}
      {tab === "mod" && (
        <div className="adSection">
          <div className="adToolbar">
            <h3 className="adH3">Moderation — Posts</h3>
            <button className="adBtn" type="button" onClick={refreshPostsOnly}>
              Refresh posts
            </button>
          </div>

          <div className="adGrid">
            {modPosts.map((p) => (
              <div key={p.id} className="adPostCard">
                <div className="adPostTop">
                  <div className="adPostTitle">
                    Post #{p.id}  @{p.author?.username ?? "user"}
                  </div>
                  <div className="adMeta">{new Date(p.createdAt).toLocaleString()}</div>
                </div>

                <div className="adPostMetaLine">
                  Likes: {p._count?.likes ?? 0} Comments: {p._count?.comments ?? 0}
                </div>

                {!!p.author?.bannedUntil && (
                  <div className="adWarn">
                    BANNED UNTIL: {new Date(p.author.bannedUntil).toLocaleString()}
                  </div>
                )}

                <div className="adThumb">
                  <img src={p.imageUrl} alt="" className="adThumbImg" />
                </div>

                {(p.caption || p.location) && (
                  <div className="adPostText">
                    {p.location ? <div className="adLine">📍 {p.location}</div> : null}
                    {p.caption ? <div className="adLine">{p.caption}</div> : null}
                  </div>
                )}

                <div className="adActionsRow">
                  <button
                    className="adBtnDanger"
                    type="button"
                    onClick={() => onAdminDeletePost(p.id)}
                    disabled={isBusy(`post:delete:${p.id}`)}
                  >
                    Delete post
                  </button>

                  <button
                    className="adBtn"
                    type="button"
                    onClick={() => onWarnUser(p.author.id)}
                    disabled={isBusy(`user:warn:${p.author.id}`)}
                  >
                    Warn
                  </button>

                  <button
                    className="adBtn"
                    type="button"
                    onClick={() => onBanUser(p.author.id)}
                    disabled={isBusy(`user:ban:${p.author.id}`)}
                  >
                    Ban
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!loading && !modPosts.length && <div className="adMuted">No posts found.</div>}
        </div>
      )}




      {/* ------------------- REPORTS ------------------- */}
      {tab === "reports" && (
        <div className="adSection">
          <div className="adToolbar adToolbarWrap">
            <h3 className="adH3">Reports</h3>

            <label className="adInline">
              <span className="adMuted">Status</span>
              <select className="adInput adSelect" value={reportStatus} onChange={(e) => setReportStatus(e.target.value as any)}>
                <option value="OPEN">OPEN</option>
                <option value="RESOLVED">RESOLVED</option>
              </select>
            </label>

            <div className="adToolbarRight">
              <button className="adBtn" type="button" onClick={refreshReportsOnly}>
                Refresh reports
              </button>
            </div>
          </div>

          <div className="adReportsLayout">
            <div className="adReportsLeft">
              <div className="adSubTitle">Post reports</div>

              <div className="adGrid">
                {reportPosts.map((r) => {
                  const targetUserId = inferTargetUserId(r);
                  const targetLabel = `POST #${r.postId ?? ""}`;

                  return (
                    <div key={r.id} className="adPostCard">
                      <div className="adPostTop">
                        <div className="adPostTitle">
                          Report #{r.id}  {r.status}  {targetLabel}
                        </div>
                        <div className="adMeta">{new Date(r.createdAt).toLocaleString()}</div>
                      </div>

                      <div className="adPostText">
                        <div className="adLine">
                          <b>Reason:</b> {r.reason}
                        </div>
                        {!!r.message && (
                          <div className="adLine">
                            <b>Message:</b> {r.message}
                          </div>
                        )}
                        <div className="adMeta">
                          Reporter: @{r.reporter?.username ?? "unknown"}{" "}
                          {r.reporter?.email ? `(${r.reporter.email})` : ""}
                          {r.handledBy?.username ? ` · handled by @${r.handledBy.username}` : ""}
                        </div>
                      </div>

                      {r.post && (
                        <>
                          <div className="adThumb">
                            <img src={r.post.imageUrl} alt="" className="adThumbImg" />
                          </div>
                          {!!r.post.caption && <div className="adPostText">{r.post.caption}</div>}
                        </>
                      )}

                      <div className="adActionsRow">
                        {r.status === "OPEN" && (
                          <button
                            className="adBtn"
                            type="button"
                            onClick={() => onResolveReport(r.id)}
                            disabled={isBusy(`report:resolve:${r.id}`)}
                          >
                            Resolve
                          </button>
                        )}

                        {r.targetType === "POST" && r.postId ? (
                          <button
                            className="adBtnDanger"
                            type="button"
                            onClick={() => onAdminDeletePost(Number(r.postId))}
                            disabled={isBusy(`post:delete:${Number(r.postId)}`)}
                          >
                            Delete post
                          </button>
                        ) : null}

                        {targetUserId ? (
                          <>
                            <button
                              className="adBtn"
                              type="button"
                              onClick={() => onWarnUser(targetUserId)}
                              disabled={isBusy(`user:warn:${targetUserId}`)}
                            >
                              Warn
                            </button>
                            <button
                              className="adBtn"
                              type="button"
                              onClick={() => onBanUser(targetUserId)}
                              disabled={isBusy(`user:ban:${targetUserId}`)}
                            >
                              Ban
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!loading && !reportPosts.length && <div className="adMuted">No post reports.</div>}
            </div>

            <aside className="adReportsRight">
              <div className="adSubTitle">Comment / User reports</div>

              <div className="adSideList">
                {reportOther.map((r) => {
                  const targetUserId = inferTargetUserId(r);
                  const targetLabel =
                    r.targetType === "COMMENT"
                      ? `COMMENT #${r.commentId ?? ""}`
                      : `USER #${r.targetUserId ?? ""}`;

                  return (
                    <div key={r.id} className="adSideCard">
                      <div className="adSideTop">
                        <div className="adSideTitle">Report #{r.id} · {targetLabel}</div>
                        <div className={`adPill ${r.status === "OPEN" ? "open" : "resolved"}`}>{r.status}</div>
                      </div>

                      <div className="adSideBody">
                        <div><b>Reason:</b> {r.reason}</div>
                        {!!r.message && <div><b>Message:</b> {r.message}</div>}

                        <div className="adMeta">
                          {new Date(r.createdAt).toLocaleString()}
                        </div>

                        {r.comment && (
                          <div className="adSidePreview">
                            <div className="adMeta">Comment preview</div>
                            <div className="adSmall">
                              @{r.comment.author?.username ?? "user"}: {r.comment.text}
                            </div>
                          </div>
                        )}

                        {r.targetUser && (
                          <div className="adSidePreview">
                            <div className="adMeta">User</div>
                            <div className="adSmall">
                              @{r.targetUser.username ?? "user"}{" "}
                              {r.targetUser.email ? `(${r.targetUser.email})` : ""}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="adSideActions">
                        {r.status === "OPEN" && (
                          <button
                            className="adBtn"
                            type="button"
                            onClick={() => onResolveReport(r.id)}
                            disabled={isBusy(`report:resolve:${r.id}`)}
                          >
                            Resolve
                          </button>
                        )}

                        {targetUserId ? (
                          <>
                            <button
                              className="adBtn"
                              type="button"
                              onClick={() => onWarnUser(targetUserId)}
                              disabled={isBusy(`user:warn:${targetUserId}`)}
                            >
                              Warn
                            </button>
                            <button
                              className="adBtn"
                              type="button"
                              onClick={() => onBanUser(targetUserId)}
                              disabled={isBusy(`user:ban:${targetUserId}`)}
                            >
                              Ban
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {!loading && !reportOther.length && <div className="adMuted">No comment/user reports.</div>}
              </div>
            </aside>
          </div>
        </div>
      )}




      {tab === "logs" && (
        <div className="adSection">
          <div className="adCard">
            <div className="adCardTop">
              <h3 className="adCardTitle">AdminLog (last 100)</h3>
              <div className="adCardHint">actions history</div>
            </div>

            <div className="adLogs">
              {logs.map((l) => (
                <div key={l.id} className="adLogRow">
                  <div className="adLogTitle">
                    {l.action} <span className="adMeta"> {new Date(l.createdAt).toLocaleString()}</span>
                  </div>

                  <div className="adSmall">
                    Admin: @{l.admin?.username ?? "admin"}  {l.entity ? `${l.entity}#${l.entityId ?? ""}` : ""}
                  </div>

                  {l.meta?.title && (
                    <div className="adSmall">
                      Title: <b>{l.meta.title}</b>
                    </div>
                  )}
                  {l.meta?.days && (
                    <div className="adSmall">
                      Days: <b>{l.meta.days}</b>
                    </div>
                  )}
                </div>
              ))}

              {!loading && !logs.length && <div className="adMuted">No logs yet.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
