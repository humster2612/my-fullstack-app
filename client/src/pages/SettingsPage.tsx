// client/src/pages/SettingsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe, uploadAvatar, updateMePro } from "../api";
import { CITY_OPTIONS, type CityOption } from "../locationOptions";

type Me = {
  id: number | string;
  email: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  links?: string[];

  role?: "CLIENT" | "VIDEOGRAPHER" | "PHOTOGRAPHER";
  specialization?: string[];
  pricePerHour?: number | null;
  portfolioVideos?: string[];

  latitude?: number | null;
  longitude?: number | null;
};

// 👇 helper-функция, чтобы красиво собрать текст локации
function formatLocationFromCity(city: CityOption | undefined): string {
  if (!city) return "";
  // ТВОЯ структура: city + countryName
  return `${city.city}, ${city.countryName}`;
}

export default function SettingsPage() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ поиск по городам
  const [cityQuery, setCityQuery] = useState("");

  // выбор города + координаты
  const [selectedCityId, setSelectedCityId] = useState<CityOption["id"] | "">(
    ""
  );
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

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
  const [role, setRole] = useState<
    "CLIENT" | "VIDEOGRAPHER" | "PHOTOGRAPHER"
  >("CLIENT");
  const [spec, setSpec] = useState(""); // строка через запятую
  const [price, setPrice] = useState<number | null>(null);
  const [videos, setVideos] = useState(""); // строка ссылок через запятую

  // ✅ отфильтрованные города по поиску
  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return CITY_OPTIONS;

    return CITY_OPTIONS.filter((c) => {
      return (
        c.city.toLowerCase().includes(q) ||
        c.countryName.toLowerCase().includes(q) ||
        c.countryCode.toLowerCase().includes(q)
      );
    });
  }, [cityQuery]);

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

        // если с бэка уже пришли координаты — попытаемся найти город в списке
        if (typeof u.latitude === "number" && typeof u.longitude === "number") {
          const found = CITY_OPTIONS.find(
            (c) =>
              Math.abs(c.lat - u.latitude!) < 0.01 &&
              Math.abs(c.lng - u.longitude!) < 0.01
          );
          if (found) {
            setSelectedCityId(found.id);
            setLat(found.lat);
            setLng(found.lng);

            // ✅ чтобы поиск/селект выглядели логично
            setCityQuery(`${found.city}`);
          }
        }
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

  // смена города в селекте
  function handleCityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value as CityOption["id"] | "";
    setSelectedCityId(value);

    const found = CITY_OPTIONS.find((c) => c.id === value);
    if (found) {
      setLat(found.lat);
      setLng(found.lng);
      // авто-заполняем текстовое поле Location
      setLocation(formatLocationFromCity(found));
    } else {
      setLat(null);
      setLng(null);
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const linksArray = links
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const specialization = spec
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const portfolioVideos = videos
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload: any = {
        username,
        avatarUrl,
        bio,
        location,
        links: linksArray,
        role,
        specialization,
        pricePerHour: Number.isFinite(Number(price)) ? Number(price) : null,
        portfolioVideos,
        latitude: lat,
        longitude: lng,
      };

      const res = await updateMePro(payload);

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
    <form
      onSubmit={submit}
      style={{ display: "grid", gap: 12 }}
      autoComplete="off"
    >
      <h2>Profile settings</h2>

      {/* Аватар */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <img
          src={preview || "https://via.placeholder.com/96"}
          alt="avatar"
          width={96}
          height={96}
          style={{ borderRadius: "50%", objectFit: "cover" }}
        />
        <label style={{ display: "inline-block" }}>
          <span>Upload avatar</span>
          <br />
          <input
            type="file"
            accept="image/*"
            onChange={onFileChange}
            disabled={uploading}
          />
        </label>
        {uploading && <span>Uploading...</span>}
      </div>

      {/* Username */}
      <label>
        Username
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="off"
        />
      </label>

      {/* Прямая ссылка на аватар (необязательно) */}
      <label>
        Avatar URL (optional)
        <input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://..."
          autoComplete="off"
        />
      </label>

      {/* Локация текстом */}
      <label>
        Location (text)
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          autoComplete="off"
          placeholder="Prague, Czech Republic"
        />
      </label>

      {/* ✅ Город для карты + поиск */}
      <label>
        City for map
        <div style={{ display: "grid", gap: 6 }}>
          <input
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            placeholder="Search city or country (e.g. Paris, US, Japan...)"
            autoComplete="off"
          />

          <select value={selectedCityId} onChange={handleCityChange}>
            <option value="">Not selected</option>
            {filteredCities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.city} — {c.countryName}
              </option>
            ))}
          </select>

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Showing {filteredCities.length} cities
          </div>
        </div>
      </label>

      {/* Bio */}
      <label>
        Bio
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
        />
      </label>

      {/* Ссылки */}
      <label>
        Links
        <input
          value={links}
          onChange={(e) => setLinks(e.target.value)}
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

      <button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
      {err && <div style={{ color: "crimson" }}>{err}</div>}
    </form>
  );
}
