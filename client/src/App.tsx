// client/src/App.tsx
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  Navigate,
} from "react-router-dom";

import FeedPage from "./pages/FeedPage";
import PeoplePage from "./pages/PeoplePage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import CreatePostPage from "./pages/CreatePostPage";

import { loginUser, registerUser, getMe } from "./api";

type User = {
  id: number | string;
  email: string;
  username?: string;
};

function App() {
  const [user, setUser] = useState<User | null>(null);

  // подтягиваем профиль, если есть токен
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    (async () => {
      try {
        const me = await getMe();
        setUser(me.user ?? null);
      } catch {
        localStorage.removeItem("token");
        setUser(null);
      }
    })();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <BrowserRouter>
      <div style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
        <nav
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Link to="/">Home</Link>
          <Link to="/people">People</Link>
          {!!user && user.username && (
            <Link to={`/profile/${user.username}`}>My profile</Link>
          )}
          {!!user && <Link to="/settings">Settings</Link>}
          {!!user && <Link to="/create">Create</Link>}
          <div style={{ marginLeft: "auto" }} />
          {!!user ? (
            <button onClick={handleLogout} style={{ cursor: "pointer" }}>
              Logout
            </button>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>

        <Routes>
          {/* Лента — главная */}
          <Route path="/" element={<FeedPage />} />

          {/* Публичные страницы */}
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/profile/:username" element={<ProfilePage />} />

          {/* Страницы только для авторизованных */}
          <Route
            path="/settings"
            element={user ? <SettingsPage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/create"
            element={
              user ? <CreatePostPage /> : <Navigate to="/login" replace />
            }
          />

          {/* Auth */}
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to="/" replace />
              ) : (
                <Login onLoggedIn={setUser} />
              )
            }
          />
          <Route
            path="/register"
            element={
              user ? (
                <Navigate to="/" replace />
              ) : (
                <Register onRegistered={setUser} />
              )
            }
          />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

/* ====== Auth forms (как раньше) ====== */
function Login({ onLoggedIn }: { onLoggedIn: (u: User | null) => void }) {
  const nav = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setEmail("");
    setPassword("");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await loginUser({ email, password });
      if (res?.token) localStorage.setItem("token", res.token);
      onLoggedIn(res?.user ?? null);
      nav("/");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Неверные данные для входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      autoComplete="off"
      style={{ display: "grid", gap: 12, maxWidth: 420 }}
    >
      <h2>Login</h2>

      <input
        type="email"
        name="login_email_manual"
        inputMode="email"
        autoComplete="off"
        placeholder="Введите email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        type="password"
        name="login_pass_manual"
        autoComplete="new-password"
        placeholder="Введите пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <button disabled={loading} type="submit">
        {loading ? "Входим..." : "Войти"}
      </button>
      {err && <div style={{ color: "crimson" }}>{err}</div>}
    </form>
  );
}

function Register({
  onRegistered,
}: {
  onRegistered: (u: User | null) => void;
}) {
  const nav = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setEmail("");
    setUsername("");
    setPassword("");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await registerUser({ email, password, username });
      const logged = await loginUser({ email, password });
      if (logged?.token) localStorage.setItem("token", logged.token);
      onRegistered(logged?.user ?? null);
      nav("/");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      autoComplete="off"
      style={{ display: "grid", gap: 12, maxWidth: 420 }}
    >
      <h2>Register</h2>

      <input
        type="text"
        name="register_username_manual"
        autoComplete="off"
        placeholder="Имя пользователя (опционально)"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <input
        type="email"
        name="register_email_manual"
        inputMode="email"
        autoComplete="off"
        placeholder="Введите email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        type="password"
        name="register_pass_manual"
        autoComplete="new-password"
        placeholder="Придумайте пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <button disabled={loading} type="submit">
        {loading ? "Создаём..." : "Зарегистрироваться"}
      </button>
      {err && <div style={{ color: "crimson" }}>{err}</div>}
    </form>
  );
}

export default App;
