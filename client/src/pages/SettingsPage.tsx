// client/src/pages/SettingsPage.tsx
import { useEffect, useState } from "react";
import { getMe, uploadAvatar, updateMePro } from "../api";
import { useNavigate } from "react-router-dom";

type Me = {
  id: number | string;
  email: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  links?: string[];
  // новые поля
  role?: "CLIENT" | "VIDEOGRAPHER" | "PHOTOGRAPHER";
  specialization?: string[];
  pricePerHour?: number | null;
  portfolioVideos?: string[];
};

export default function SettingsPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // базовые поля
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [links, setLinks] = useState("");

  // загрузка аватара
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // новые поля (роль/направления/цена/видео)
  const [role, setRole] = useState<"CLIENT" | "VIDEOGRAPHER" | "PHOTOGRAPHER">("CLIENT");
  const [spec, setSpec] = useState(""); // строка через запятую
  const [price, setPrice] = useState<number | null>(null);
  const [videos, setVideos] = useState(""); // строка ссылок через запятую

  useEffect(() => {
    (async () => {
      try {
        const res = await getMe();
        const u: Me = res.user;

        setUsername(u.username || "");
        setAvatarUrl(u.avatarUrl || "");
        setBio(u.bio || "");
        setLocation(u.location || "");
        setLinks((u.links || []).join(", "));
        setPreview(u.avatarUrl || null);

        setRole(u.role || "CLIENT");
        setSpec((u.specialization || []).join(", "));
        setPrice(typeof u.pricePerHour === "number" ? u.pricePerHour : null);
        setVideos((u.portfolioVideos || []).join(", "));
      } catch (e: any) {
        setErr(e?.response?.data?.error || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);

      const res = await uploadAvatar(file); // -> { url }
      setAvatarUrl(res.url);
      setPreview(res.url);
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const linksArray = links.split(",").map(s => s.trim()).filter(Boolean);
      const specialization = spec.split(",").map(s => s.trim()).filter(Boolean);
      const portfolioVideos = videos.split(",").map(s => s.trim()).filter(Boolean);

      const res = await updateMePro({
        username,
        avatarUrl,
        bio,
        location,
        links: linksArray,
        role,
        specialization,
        pricePerHour: Number.isFinite(Number(price)) ? Number(price) : null,
        portfolioVideos
      });

      const newUsername = res?.user?.username || username;
      nav(`/profile/${newUsername}`);
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading settings...</div>;

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }} autoComplete="off">
      <h2>Profile settings</h2>

      {/* Аватар */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <img
          src={preview || "https://via.placeholder.com/96"}
          alt="avatar"
          width={96}
          height={96}
          style={{ borderRadius: "50%", objectFit: "cover" }}
        />
        <label style={{ display: "inline-block" }}>
          <span>Upload avatar</span><br />
          <input type="file" accept="image/*" onChange={onFileChange} disabled={uploading} />
        </label>
        {uploading && <span>Uploading...</span>}
      </div>

      {/* Username */}
      <label>
        Username
        <input value={username} onChange={e => setUsername(e.target.value)} required autoComplete="off" />
      </label>

      {/* Прямая ссылка на аватар (необязательно) */}
      <label>
        Avatar URL (optional)
        <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." autoComplete="off" />
      </label>

      {/* Локация */}
      <label>
        Location
        <input value={location} onChange={e => setLocation(e.target.value)} autoComplete="off" />
      </label>

      {/* Bio */}
      <label>
        Bio
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} />
      </label>

      {/* Ссылки */}
      <label>
        Links 
        <input
          value={links}
          onChange={e => setLinks(e.target.value)}
          autoComplete="off"
          placeholder="https://..., https://..."
        />
      </label>

      <hr style={{ opacity: 0.2 }} />

      {/* Роль */}
      <label>
        Role
        <select value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="CLIENT">Client</option>
          <option value="VIDEOGRAPHER">Videographer</option>
          <option value="PHOTOGRAPHER">Photographer</option>
        </select>
      </label>

      {/* Специализация */}
      <label>
        Specialization (comma separated)
        <input
          value={spec}
          onChange={(e) => setSpec(e.target.value)}
          placeholder="weddings, events, promo"
        />
      </label>

      {/* Цена за час */}
      <label>
        Price per hour
        <input
          type="number"
          value={price ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setPrice(v === "" ? null : Number(v));
          }}
        />
      </label>

      {/* Видео портфолио */}
      <label>
        Portfolio videos 
        <input
          value={videos}
          onChange={(e) => setVideos(e.target.value)}
          placeholder="https://youtu.be/..., https://vimeo.com/..., https://..."
        />
      </label>

      <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
      {err && <div style={{ color: "crimson" }}>{err}</div>}
    </form>
  );
}
