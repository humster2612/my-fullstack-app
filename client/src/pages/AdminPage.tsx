import { useEffect, useState } from "react";
import {
    adminListAnnouncements,
    adminCreateAnnouncement,
    adminUpdateAnnouncement,
    adminDeleteAnnouncement,
    adminGetLogs,
  } from "../api";
  
  import type { Announcement, AdminLogItem } from "../api";
  

export default function AdminPage() {
  const [tab, setTab] = useState<"ann" | "logs">("ann");

  const [anns, setAnns] = useState<Announcement[]>([]);
  const [logs, setLogs] = useState<AdminLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      const [a, l] = await Promise.all([adminListAnnouncements(), adminGetLogs()]);
      setAnns(a.announcements || []);
      setLogs(l.logs || []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Admin access denied / failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function onCreate() {
    if (!title.trim()) return;
    try {
      const res = await adminCreateAnnouncement({ title: title.trim(), body: body.trim(), isActive });
      setAnns((prev) => [res.announcement, ...prev]);
      setTitle("");
      setBody("");
      setIsActive(true);
      // обновим логи
      const l = await adminGetLogs();
      setLogs(l.logs || []);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Create failed");
    }
  }

  async function onToggleActive(a: Announcement) {
    try {
      const res = await adminUpdateAnnouncement(a.id, { isActive: !a.isActive });
      setAnns((prev) => prev.map((x) => (x.id === a.id ? res.announcement : x)));
      const l = await adminGetLogs();
      setLogs(l.logs || []);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Update failed");
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Delete announcement?")) return;
    try {
      await adminDeleteAnnouncement(id);
      setAnns((prev) => prev.filter((x) => x.id !== id));
      const l = await adminGetLogs();
      setLogs(l.logs || []);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Delete failed");
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
      <h2>Admin</h2>

      {err && <div style={{ color: "crimson" }}>{err}</div>}
      {loading && <div>Loading…</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setTab("ann")} disabled={tab === "ann"}>
          Announcements
        </button>
        <button type="button" onClick={() => setTab("logs")} disabled={tab === "logs"}>
          AdminLog
        </button>
        <div style={{ marginLeft: "auto" }}>
          <button type="button" onClick={loadAll}>Refresh</button>
        </div>
      </div>

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
            <button type="button" onClick={onCreate}>Create</button>
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
                    <button type="button" onClick={() => onToggleActive(a)}>
                      {a.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" onClick={() => onDelete(a.id)} style={{ color: "crimson" }}>
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

              </div>
            ))}

            {!loading && !logs.length && <div style={{ opacity: 0.7 }}>No logs yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
