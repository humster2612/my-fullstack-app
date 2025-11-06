import { useState } from "react";
import { createPost } from "../api";
import { useNavigate } from "react-router-dom";

export default function CreatePostPage() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function onChoose(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setErr("Choose an image"); return; }
    setErr(null);
    setSaving(true);
    try {
      await createPost(file, { caption, location });
      nav(-1); // назад (можешь сменить на /profile/me, когда будет алиас)
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Failed to create post");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <h2>Create post</h2>

      <input type="file" accept="image/*" onChange={onChoose} />
      {preview && <img src={preview} alt="preview" style={{ maxWidth: "100%", borderRadius: 12 }} />}

      <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Location" />
      <textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Caption" rows={3} />

      <button disabled={saving} type="submit">{saving ? "Publishing..." : "Publish"}</button>
      {err && <div style={{ color: "crimson" }}>{err}</div>}
    </form>
  );
}
