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
import BookProviderPage from "./pages/BookProviderPage";
import ProviderSchedulePage from "./pages/ProviderSchedulePage";
import BookingRequestsPage from "./pages/BookingRequestsPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import AdminPage from "./pages/AdminPage";

import { loginUser, registerUser, getMe } from "./api";

type User = {
  id: number | string;
  email: string;
  username?: string;
  role?: "CLIENT" | "VIDEOGRAPHER" | "PHOTOGRAPHER" | "ADMIN";
};

function App() {
  const [user, setUser] = useState<User | null>(null);

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

  const isAdmin = user?.role === "ADMIN";
  const isProvider = user?.role === "VIDEOGRAPHER" || user?.role === "PHOTOGRAPHER";

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

          {!!user && (user.username ? (
            <Link to={`/profile/${user.username}`}>My profile</Link>
          ) : null)}

          {!!user && <Link to="/settings">Settings</Link>}
          {!!user && <Link to="/create">Create</Link>}

          {/* ✅ My bookings показываем всем авторизованным, КРОМЕ ADMIN */}
          {!!user && !isAdmin && <Link to="/my-bookings">My bookings</Link>}

          {!!user && isAdmin && <Link to="/admin">Admin</Link>}

          {!!user && isProvider && (
            <Link to="/booking-requests">Booking requests</Link>
          )}

          {!!user && isProvider && <Link to="/schedule">Schedule</Link>}

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
          <Route path="/" element={<FeedPage />} />

          <Route path="/people" element={<PeoplePage />} />
          <Route path="/profile/:username" element={<ProfilePage />} />
          <Route path="/book/:username" element={<BookProviderPage />} />

          <Route
            path="/settings"
            element={user ? <SettingsPage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/create"
            element={user ? <CreatePostPage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/schedule"
            element={user ? <ProviderSchedulePage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/booking-requests"
            element={user ? <BookingRequestsPage /> : <Navigate to="/login" replace />}
          />

          {/* ✅ Админу запрещаем эту страницу даже по прямой ссылке */}
          <Route
            path="/my-bookings"
            element={
              user ? (
                isAdmin ? <Navigate to="/admin" replace /> : <MyBookingsPage />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <Login onLoggedIn={setUser} />}
          />
          <Route
            path="/register"
            element={user ? <Navigate to="/" replace /> : <Register onRegistered={setUser} />}
          />

          <Route
            path="/admin"
            element={user?.role === "ADMIN" ? <AdminPage /> : <Navigate to="/" replace />}
          />

          <Route path="*" element={<div>Page not found</div>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

/* ====== Auth forms ====== */
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

      const me = await getMe();
      onLoggedIn(me.user ?? null);

      nav("/");
    } catch (e: any) {
      setErr(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Неверные данные для входа"
      );
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

function Register({ onRegistered }: { onRegistered: (u: User | null) => void }) {
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

      const me = await getMe();
      onRegistered(me.user ?? null);

      nav("/");
    } catch (e: any) {
      setErr(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Ошибка регистрации"
      );
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
