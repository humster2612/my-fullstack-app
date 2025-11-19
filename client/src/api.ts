// client/src/api.ts
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

/* AUTH */
export type LoginPayload = { email: string; password: string };
export type RegisterPayload = { email: string; password: string; username?: string };
export async function registerUser(payload: RegisterPayload) { const { data } = await api.post("/api/auth/register", payload); return data; }
export async function loginUser(payload: LoginPayload) { const { data } = await api.post("/api/auth/login", payload); return data; }
export async function getMe() { const { data } = await api.get("/api/users/me"); return data; }

/* PROFILE */
export async function getUserByUsername(username: string) { const { data } = await api.get(`/api/users/${username}`); return data; }
export type UpdateMePayload = { username?: string; avatarUrl?: string; bio?: string; location?: string; links?: string[]; };
export async function updateMe(payload: UpdateMePayload) { const { data } = await api.patch("/api/users/me", payload); return data; }
export async function uploadAvatar(file: File) {
  const fd = new FormData(); fd.append("file", file);
  const { data } = await api.post("/api/users/me/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return data as { url: string };
}

/* PEOPLE */
export async function listUsers(params?: { q?: string; limit?: number; cursor?: number | string }) {
    const { q = "", limit = 20, cursor } = params || {};
    const { data } = await api.get("/api/users", { params: { q, limit, cursor } });
    return data as {
      users: Array<{
        id: number | string;
        username: string;
        email: string;
        avatarUrl?: string;
        followers: number; // счётчик подписчиков
        following: number; // счётчик "на кого подписан"
        isFollowing?: boolean; // <- булевый флаг, переименован
      }>;
      nextCursor: number | null;
    };
  }
  

/* FOLLOW */
export async function getFollowStatus(userId: number | string) { const { data } = await api.get(`/api/follow/status/${userId}`); return data as { following: boolean }; }
export async function followUser(userId: number | string) { const { data } = await api.post(`/api/follow/${userId}`); return data as { ok: true }; }
export async function unfollowUser(userId: number | string) { const { data } = await api.delete(`/api/follow/${userId}`); return data as { ok: true }; }

/* =========================
   POSTS
   ========================= */

   export async function createPost(file: File, payload: { caption?: string; location?: string }) {
    const fd = new FormData();
    fd.append("file", file);
    if (payload.caption) fd.append("caption", payload.caption);
    if (payload.location) fd.append("location", payload.location);
    const { data } = await api.post("/api/posts", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data as { post: { id: number|string; imageUrl: string; caption: string; location: string; createdAt: string } };
  }
  
  export async function getUserPosts(username: string) {
    const { data } = await api.get(`/api/users/${username}/posts`);
    return data as { posts: Array<{ id:number|string; imageUrl:string; caption:string; location:string; createdAt:string }> };
  }
  

  /* =========================
   FEED
   ========================= */
export async function getFeed(params?: { cursor?: number | string; limit?: number }) {
    const { cursor, limit = 10 } = params || {};
    const { data } = await api.get("/api/feed", { params: { cursor, limit } });
    return data as {
      posts: Array<{
        id: number | string;
        imageUrl: string;
        caption: string;
        location: string;
        createdAt: string;
        author: { id: number | string; username: string; avatarUrl?: string };
      }>;
      nextCursor: number | null;
    };
  }

  

  // ===== Profile extensions =====
  export type UpdateMeProPayload = {
    role?: 'CLIENT' | 'VIDEOGRAPHER' | 'PHOTOGRAPHER';
    specialization?: string[];
    pricePerHour?: number | null;
    location?: string;
    portfolioVideos?: string[];
    links?: string[];
    avatarUrl?: string;
    bio?: string;
    username?: string;
  
    latitude?: number | null;
    longitude?: number | null;
  };
  
  export async function updateMePro(payload: UpdateMeProPayload) {
    const { data } = await api.patch('/api/users/me', payload);
    return data; // { user }
  }
  
  // ===== Bookings =====
  export async function createBooking(videographerId: number | string, dateISO: string, note?: string) {
    const { data } = await api.post('/api/bookings', { videographerId, date: dateISO, note });
    return data as { booking: any };
  }
  export async function myBookings() {
    const { data } = await api.get('/api/bookings/my');
    return data as { bookings: any[] };
  }
  export async function toMeBookings() {
    const { data } = await api.get('/api/bookings/to-me');
    return data as { bookings: any[] };
  }
  
  export async function updateBooking(id: number | string, action: 'confirm' | 'decline' | 'cancel' | 'done') {
    const { data } = await api.patch(`/api/bookings/${id}`, { action });
    return data as { booking: any };
  }
  


  // --- Provider availability ---
// export async function getProviderAvailability(username: string) {
//     const { data } = await api.get(`/api/providers/${encodeURIComponent(username)}/availability`);
//     return data as { slots: { id:number; startsAt:string; endsAt:string; isBooked:boolean }[] };
//   }
  
//   export async function createAvailability(startsAt: string, endsAt: string) {
//     const { data } = await api.post('/api/availability', { startsAt, endsAt });
//     return data as { slot: { id:number; startsAt:string; endsAt:string; isBooked:boolean } };
//   }
  
//   export async function deleteAvailability(id: number) {
//     const { data } = await api.delete(`/api/availability/${id}`);
//     return data as { ok: true };
//   }
  
//   export async function bookBySlot(slotId: number, note: string = "") {
//     const { data } = await api.post('/api/bookings/by-slot', { slotId, note });
//     return data as { booking: { id:number; status:string; date:string } };
//   }
  export async function getProviderUnavailability(username: string) {
    const { data } = await api.get(`/api/providers/${encodeURIComponent(username)}/calendar`);
    return data as {
      busy: { id:number; startsAt:string; endsAt:string }[];
      bookings: { id:number; date:string; status:string }[];
    };
  }
  
  export async function createUnavailability(startsAt: string, endsAt: string) {
    const { data } = await api.post("/api/unavailability", { startsAt, endsAt });
    return data as { item: { id:number; startsAt:string; endsAt:string } };
  }
  
  export async function deleteUnavailability(id: number) {
    const { data } = await api.delete(`/api/unavailability/${id}`);
    return data as { ok: true };
  }
  
  export async function getProviderIdByUsername(username: string) {
    const { data } = await api.get(`/api/provider-id/${encodeURIComponent(username)}`);
    return data as { id:number };
  }
  
  export async function createBookingByDate(
    videographerId: number|string,
    startISO: string,
    endISO: string,
    note?: string
  ) {
    const { data } = await api.post("/api/bookings", {
      videographerId,
      start: startISO,
      end: endISO,
      note
    });
    return data as { booking: { id:number; status:string; date:string; durationMinutes: number } };
  }
  
  
  export async function createBookingInterval(
    videographerId: number | string,
    startISO: string,
    endISO: string,
    note?: string
  ) {
    const { data } = await api.post('/api/bookings', {
      videographerId,
      start: startISO,
      end: endISO,
      note
    });
    return data as { booking: any };
  }
  

  export type ProviderMapItem = {
    id: number;
    username: string;
    location: string;
    lat: number;
    lng: number;
    specializations: string[];
  };
  
  export async function getProvidersMap() {
    const { data } = await api.get("/api/providers/map");
    return data as { providers: ProviderMapItem[] };
  }