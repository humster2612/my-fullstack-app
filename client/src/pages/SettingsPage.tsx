// client/src/pages/SettingsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe, uploadAvatar, updateMePro } from "../api";
import { CITY_OPTIONS, type CityOption } from "../locationOptions";
import "../styles/settings.css";

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
    <form onSubmit={submit} className="setPage" autoComplete="off">
      <div className="setHeader">
        <h2 className="setTitle">Profile settings</h2>
        {/* <div className="setSub">Update your profile, map location and pro info.</div> */}
      </div>
  
      {err && <div className="setAlert setAlertErr">{err}</div>}
  
      <section className="setCard">
        <div className="setCardTitle">Avatar</div>
  
        <div className="setAvatarRow">
          <img
            src={preview || "https://via.placeholder.com/96"}
            alt="avatar"
            className="setAvatar"
            width={96}
            height={96}
          />
  
          <div className="setAvatarRight">
            <label className="setFile">
              <span className="setLabel">Upload avatar</span>
              <input
                className="setFileInput"
                type="file"
                accept="image/*"
                onChange={onFileChange}
                disabled={uploading}
              />
            </label>
  
            {uploading ? <div className="setHint">Uploading…</div> : <div className="setHint">wybierz odpowiedni format...</div>}
          </div>
        </div>
      </section>
  
      <div className="setGrid">
        <section className="setCard">
          <div className="setCardTitle">Basic info</div>
  
          <label className="setField">
            <span className="setLabel">Username</span>
            <input
              className="setInput"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
  
          <label className="setField">
            <span className="setLabel">Avatar URL (optional)</span>
            <input
              className="setInput"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              autoComplete="off"
            />
          </label>
  
          <label className="setField">
            <span className="setLabel">Location (text)</span>
            <input
              className="setInput"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              autoComplete="off"
              placeholder="Prague, Czech Republic"
            />
          </label>
  
          <label className="setField">
            <span className="setLabel">Bio</span>
            <textarea
              className="setTextarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
            />
          </label>
  
          <label className="setField">
            <span className="setLabel">Links</span>
            <input
              className="setInput"
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              autoComplete="off"
              placeholder="https://..., https://..."
            />
          </label>
        </section>
  
        <section className="setCard">
          <div className="setCardTitle">Map location</div>
  
          <label className="setField">
            <span className="setLabel">City for map</span>
  
            <input
              className="setInput"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Search city or country (e.g. Paris, US, Japan...)"
              autoComplete="off"
            />
  
            <select className="setSelect" value={selectedCityId} onChange={handleCityChange}>
              <option value="">Not selected</option>
              {filteredCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.city} — {c.countryName}
                </option>
              ))}
            </select>
  
            <div className="setHint">Showing {filteredCities.length} cities</div>
          </label>
  
          <div className="setMini">
            <div className="setMiniRow">
              <span className="setMiniKey">Latitude</span>
              <span className="setMiniVal">{typeof lat === "number" ? lat.toFixed(4) : "—"}</span>
            </div>
            <div className="setMiniRow">
              <span className="setMiniKey">Longitude</span>
              <span className="setMiniVal">{typeof lng === "number" ? lng.toFixed(4) : "—"}</span>
            </div>
          </div>
        </section>
  
        <section className="setCard setCardFull">
          <div className="setCardTitle">Pro profile</div>
  
          <div className="setRow2">
            <label className="setField">
              <span className="setLabel">Role</span>
              <select className="setSelect" value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="CLIENT">Client</option>
                <option value="VIDEOGRAPHER">Videographer</option>
                <option value="PHOTOGRAPHER">Photographer</option>
              </select>
            </label>
  
            <label className="setField">
              <span className="setLabel">Price per hour</span>
              <input
                className="setInput"
                type="number"
                value={price ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setPrice(v === "" ? null : Number(v));
                }}
                placeholder="e.g. 50"
              />
            </label>
          </div>
  
          <label className="setField">
            <span className="setLabel">Specialization </span>
            <input
              className="setInput"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="weddings, events, promo"
            />
          </label>
  
          <label className="setField">
            <span className="setLabel">Portfolio videos</span>
            <input
              className="setInput"
              value={videos}
              onChange={(e) => setVideos(e.target.value)}
              placeholder="https://youtu.be/..., https://vimeo.com/..., https://..."
            />
          </label>
        </section>
      </div>
  
      <div className="setFooter">
        <button type="submit" className="setBtnPrimary" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
       
      </div>
    </form>
  );
  
}



