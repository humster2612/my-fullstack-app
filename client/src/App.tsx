// client/src/App.tsx
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";

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
import NotificationsPage from "./pages/NotificationsPage";


import { loginUser, registerUser, getMe } from "./api";

type User = {
  id: number | string;
  email: string;
  username?: string;
  role?: "CLIENT" | "VIDEOGRAPHER" | "PHOTOGRAPHER" | "ADMIN";
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false); // ✅ чтобы не было "мигания" контента

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setAuthChecked(true);
      return;
    }

    (async () => {
      try {
        const me = await getMe();
        setUser(me.user ?? null);
      } catch {
        localStorage.removeItem("token");
        setUser(null);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const isAdmin = user?.role === "ADMIN";
  const isProvider = user?.role === "VIDEOGRAPHER" || user?.role === "PHOTOGRAPHER";

  // ✅ пока не проверили токен — не рендерим ничего, чтобы не показывались страницы на секунду
  if (!authChecked) return null;

  return (
    <BrowserRouter>
    <div style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>


        <nav
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* ✅ НЕлогину показываем только Login/Register */}
          {!user ? (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          ) : (
            <>
              <Link to="/">Home</Link>
              <Link to="/people">People</Link>

              {user.username ? <Link to={`/profile/${user.username}`}>My profile</Link> : null}

              <Link to="/settings">Settings</Link>
              <Link to="/notifications">🔔 Notifications</Link>
              <Link to="/create">Create</Link>

              {/* ✅ My bookings всем авторизованным, кроме ADMIN */}
              {!isAdmin && <Link to="/my-bookings">My bookings</Link>}

              {isAdmin && <Link to="/admin">Admin</Link>}

              {isProvider && <Link to="/booking-requests">Booking requests</Link>}
              {isProvider && <Link to="/schedule">Schedule</Link>}

              <div style={{ marginLeft: "auto" }} />
              <button onClick={handleLogout} style={{ cursor: "pointer" }}>
                Logout
              </button>
            </>
          )}
        </nav>

        {/* ✅ если НЕ авторизован — доступны только /login и /register, всё остальное -> /login */}
        {!user ? (
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login onLoggedIn={setUser} />} />
            <Route path="/register" element={<Register onRegistered={setUser} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<FeedPage />} />

            <Route path="/people" element={<PeoplePage />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/book/:username" element={<BookProviderPage />} />

            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/create" element={<CreatePostPage />} />
            <Route path="/schedule" element={<ProviderSchedulePage />} />
            <Route path="/booking-requests" element={<BookingRequestsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />

            {/* ✅ Админу запрещаем MyBookings даже по прямой ссылке */}
            <Route
              path="/my-bookings"
              element={isAdmin ? <Navigate to="/admin" replace /> : <MyBookingsPage />}
            />

            <Route
              path="/admin"
              element={user.role === "ADMIN" ? <AdminPage /> : <Navigate to="/" replace />}
            />

            {/* ✅ если залогинен и случайно пошёл на /login — вернём на / */}
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/register" element={<Navigate to="/" replace />} />

            <Route path="*" element={<div>Page not found</div>} />
          </Routes>
        )}
      </div>
    </BrowserRouter>
  );
}

/* ====== Auth forms ====== */
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
    <div className="authPage">
      <div className="authCard">
        <div className="authVisual">
          <h1>Welcome back</h1>
          <p>Login to access your feed, bookings, portfolio and notifications.</p>
          <p style={{ opacity: 0.7, fontSize: 13 }}>
            Tip: use a strong password and keep your profile updated ✨
          </p>
        </div>

        <form onSubmit={submit} autoComplete="off" className="authForm">
          <h2 className="authTitle">Login</h2>
          <p className="authSub">Enter your email and password to continue</p>

          <div className="field">
            <div className="label">Email</div>
            <input
              className="input"
              type="email"
              name="login_email_manual"
              inputMode="email"
              autoComplete="off"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <div className="label">Password</div>
            <input
              className="input"
              type="password"
              name="login_pass_manual"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Sign in"}
          </button>

          {err && <div className="err">{err}</div>}

          <div className="authLinks">
            <span>No account?</span>
            <Link to="/register">Create one</Link>
          </div>
        </form>
      </div>
    </div>
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
    <div className="authPage">
      <div className="authCard">
        <div className="authVisual">
          <h1>Create account</h1>
          <p>Join the platform to post content, follow creators and book providers.</p>
          <p style={{ opacity: 0.7, fontSize: 13 }}>
            You can set avatar, bio and location later in Settings.
          </p>
        </div>

        <form onSubmit={submit} autoComplete="off" className="authForm">
          <h2 className="authTitle">Register</h2>
          <p className="authSub">Fill the fields below to create an account</p>

          <div className="field">
            <div className="label">Username (optional)</div>
            <input
              className="input"
              type="text"
              name="register_username_manual"
              autoComplete="off"
              placeholder="yourname"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="field">
            <div className="label">Email</div>
            <input
              className="input"
              type="email"
              name="register_email_manual"
              inputMode="email"
              autoComplete="off"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <div className="label">Password</div>
            <input
              className="input"
              type="password"
              name="register_pass_manual"
              autoComplete="new-password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn" disabled={loading} type="submit">
            {loading ? "Creating..." : "Create account"}
          </button>

          {err && <div className="err">{err}</div>}

          <div className="authLinks">
            <span>Already have an account?</span>
            <Link to="/login">Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;



