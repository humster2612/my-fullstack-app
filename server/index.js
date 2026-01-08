// server/index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const prisma = new PrismaClient();
const app = express();

/* -------------------- CORS -------------------- */
const isProd = process.env.NODE_ENV === "production";
app.use(express.json());
app.use(
  cors({
    origin: isProd ? [process.env.CLIENT_ORIGIN] : true,
    credentials: true,
  })
);

/* --------------- STATIC (uploads) -------------- */
const uploadsRoot = path.join(__dirname, "uploads");
const avatarsDir = path.join(uploadsRoot, "avatars");
const postsDir = path.join(uploadsRoot, "posts");
fs.mkdirSync(avatarsDir, { recursive: true });
fs.mkdirSync(postsDir, { recursive: true });
app.use("/uploads", express.static(uploadsRoot));

/* ----------------- Multer (images) ------------- */
const fileFilter = (req, file, cb) => {
  if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) cb(null, true);
  else cb(new Error("Only image files are allowed"));
};

/* для аватаров */
const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `u${req.userId || "anon"}_${Date.now()}${ext}`);
    },
  }),
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
});

/* для постов */
const uploadPost = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, postsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `p${req.userId}_${Date.now()}${ext}`);
    },
  }),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* ---------------- test ---------------- */
app.get("/api/hello", (req, res) => res.json({ message: "Привет с backend 👋" }));

/* --------------- auth middleware --------------- */
async function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "no token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;

    // ✅ проверка бана
    const me = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { bannedUntil: true },
    });

    if (!me) return res.status(401).json({ error: "user not found" });

    if (me.bannedUntil && new Date(me.bannedUntil) > new Date()) {
      return res.status(403).json({
        error: "You are banned",
        bannedUntil: me.bannedUntil,
      });
    }

    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

async function adminOnly(req, res, next) {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    });
    if (!me || me.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin only" });
    }
    next();
  } catch (e) {
    console.error("adminOnly", e);
    return res.status(500).json({ error: "server error" });
  }
}

/* ------------------- ANNOUNCEMENTS ------------------- */
app.get("/api/announcements", async (req, res) => {
  try {
    const items = await prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        body: true,
        isActive: true,
        createdAt: true,
        createdBy: { select: { id: true, username: true } },
      },
    });
    res.json({ announcements: items });
  } catch (e) {
    console.error("GET /api/announcements", e);
    res.status(500).json({ error: "Failed to load announcements" });
  }
});

// ===== ADMIN: announcements =====
app.get("/api/admin/announcements", auth, adminOnly, async (req, res) => {
  const items = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      body: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, username: true } },
    },
  });
  res.json({ announcements: items });
});

app.post("/api/admin/announcements", auth, adminOnly, async (req, res) => {
  try {
    const { title, body, isActive = true } = req.body;
    if (!title || !String(title).trim())
      return res.status(400).json({ error: "title required" });

    const created = await prisma.announcement.create({
      data: {
        title: String(title).trim(),
        body: String(body || "").trim(),
        isActive: !!isActive,
        createdById: req.userId,
      },
      select: { id: true, title: true, body: true, isActive: true, createdAt: true },
    });

    await prisma.adminLog.create({
      data: {
        adminId: req.userId,
        action: "ANNOUNCEMENT_CREATE",
        entity: "Announcement",
        entityId: created.id,
        meta: { title: created.title },
      },
    });

    res.status(201).json({ announcement: created });
  } catch (e) {
    console.error("POST /api/admin/announcements", e);
    res.status(500).json({ error: "Create failed" });
  }
});

app.patch("/api/admin/announcements/:id", auth, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, body, isActive } = req.body;

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(body !== undefined ? { body: String(body).trim() } : {}),
        ...(isActive !== undefined ? { isActive: !!isActive } : {}),
      },
      select: { id: true, title: true, body: true, isActive: true, updatedAt: true },
    });

    await prisma.adminLog.create({
      data: {
        adminId: req.userId,
        action: "ANNOUNCEMENT_UPDATE",
        entity: "Announcement",
        entityId: id,
        meta: { title: updated.title },
      },
    });

    res.json({ announcement: updated });
  } catch (e) {
    console.error("PATCH /api/admin/announcements/:id", e);
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete("/api/admin/announcements/:id", auth, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);

    await prisma.announcement.delete({ where: { id } });

    await prisma.adminLog.create({
      data: {
        adminId: req.userId,
        action: "ANNOUNCEMENT_DELETE",
        entity: "Announcement",
        entityId: id,
      },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/announcements/:id", e);
    res.status(500).json({ error: "Delete failed" });
  }
});

app.get("/api/admin/logs", auth, adminOnly, async (req, res) => {
  const items = await prisma.adminLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      meta: true,
      createdAt: true,
      admin: { select: { id: true, username: true, email: true } },
    },
  });
  res.json({ logs: items });
});

/* ------------------- AUTH ---------------------- */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, username } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email и password обязательны" });

    const existEmail = await prisma.user.findUnique({ where: { email } });
    if (existEmail) return res.status(409).json({ error: "Пользователь уже существует" });

    const safeName =
      (username && username.trim()) || email.split("@")[0] + Math.floor(Math.random() * 10000);
    const existU = await prisma.user.findUnique({ where: { username: safeName } });
    if (existU) return res.status(409).json({ error: "Такой username уже существует" });

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hash, username: safeName },
      select: { id: true, email: true, username: true },
    });
    res.status(201).json({ user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Неверные данные" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Неверные данные" });
    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

/* ------------------ PROFILE -------------------- */
app.get("/api/users/me", auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      email: true,
      username: true,
      avatarUrl: true,
      bio: true,
      location: true,
      links: true,
      followers: true,
      following: true,
      createdAt: true,
      role: true,
      specialization: true,
      pricePerHour: true,
      latitude: true,
      longitude: true,

      // ✅ BACK: portfolioVideos
      portfolioVideos: true,
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});


// ===== UPDATE PROFILE =====
app.patch("/api/users/me", auth, async (req, res) => {
  try {
    const {
      username,
      avatarUrl,
      bio,
      location,
      links,
      role,
      specialization,
      pricePerHour,
      latitude,
      longitude,

      // ✅ BACK:
      portfolioVideos,
    } = req.body;

    if (typeof username === "string" && username.trim()) {
      const exists = await prisma.user.findFirst({
        where: { username: username.trim(), NOT: { id: req.userId } },
        select: { id: true },
      });
      if (exists) return res.status(409).json({ error: "Username is taken" });
    }

    const data = {};
    if (typeof username === "string") data.username = username.trim();
    if (typeof avatarUrl === "string") data.avatarUrl = avatarUrl.trim();
    if (typeof bio === "string") data.bio = bio;
    if (typeof location === "string") data.location = location.trim();
    if (Array.isArray(links)) data.links = links;

    if (role && ["CLIENT", "VIDEOGRAPHER", "PHOTOGRAPHER"].includes(role)) data.role = role;
    if (Array.isArray(specialization)) data.specialization = specialization.map(String);
    if (pricePerHour !== undefined)
      data.pricePerHour = Number.isFinite(+pricePerHour) ? +pricePerHour : null;

    if (latitude !== undefined) {
      const latNum = Number(latitude);
      if (!Number.isNaN(latNum)) data.latitude = latNum;
    }
    if (longitude !== undefined) {
      const lngNum = Number(longitude);
      if (!Number.isNaN(lngNum)) data.longitude = lngNum;
    }

    // ✅ BACK: portfolioVideos
    if (Array.isArray(portfolioVideos)) {
      data.portfolioVideos = portfolioVideos.map(String).filter(Boolean);
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        location: true,
        links: true,
        followers: true,
        following: true,
        role: true,
        specialization: true,
        pricePerHour: true,
        latitude: true,
        longitude: true,
        portfolioVideos: true,
      },
    });

    res.json({ user });
  } catch (e) {
    console.error("PATCH /api/users/me", e);
    res.status(400).json({ error: "Update failed" });
  }
});


// ===== GET PUBLIC PROFILE =====
app.get("/api/users/:username", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        bio: true,
        location: true,
        links: true,
        followers: true,
        following: true,
        createdAt: true,
        role: true,
        specialization: true,
        pricePerHour: true,
        latitude: true,
        longitude: true,

        // ✅ BACK
        portfolioVideos: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load profile" });
  }
});


/* ------------------ PEOPLE --------------------- */
app.get("/api/users", async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const limitRaw = parseInt(String(req.query.limit || ""), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;
    const cursorParam = req.query.cursor;
    const cursorId = cursorParam !== undefined ? Number(cursorParam) : undefined;

    const authHeader = req.headers.authorization || "";
    let meId = null;
    if (authHeader.startsWith("Bearer ")) {
      try {
        const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        meId = payload.sub;
      } catch {}
    }

    const where = {
      AND: [
        meId ? { NOT: { id: meId } } : {},
        q
          ? {
              OR: [
                { username: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    };

    const users = await prisma.user.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit,
      ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        followers: true,
        following: true,
      },
    });
    const nextCursor = users.length === limit ? users[users.length - 1].id : null;

    let followingMap = {};
    if (meId && users.length) {
      const ids = users.map((u) => u.id);
      const rels = await prisma.follow.findMany({
        where: { followerId: meId, followingId: { in: ids } },
        select: { followingId: true },
      });
      for (const r of rels) followingMap[r.followingId] = true;
    }

    const items = users.map((u) => ({ ...u, isFollowing: !!followingMap[u.id] }));
    res.json({ users: items, nextCursor });
  } catch (e) {
    console.error("GET /api/users error:", e);
    res.status(500).json({ error: "server error" });
  }
});

app.get("/api/providers/map", async (req, res) => {
  try {
    const providers = await prisma.user.findMany({
      where: {
        role: { in: ["VIDEOGRAPHER", "PHOTOGRAPHER"] },
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        username: true,
        location: true,
        specialization: true,
        latitude: true,
        longitude: true,
      },
    });

    res.json({
      providers: providers.map((p) => ({
        id: p.id,
        username: p.username ?? `user${p.id}`,
        location: p.location,
        lat: p.latitude,
        lng: p.longitude,
        specializations: p.specialization ?? [],
      })),
    });
  } catch (e) {
    console.error("GET /api/providers/map", e);
    res.status(500).json({ error: "Failed to load providers" });
  }
});

/* ---------------- AVATAR UPLOAD ---------------- */
app.post("/api/users/me/avatar", auth, uploadAvatar.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const publicUrl = `${req.protocol}://${req.get("host")}/uploads/avatars/${req.file.filename}`;
    await prisma.user.update({ where: { id: req.userId }, data: { avatarUrl: publicUrl } });
    res.json({ url: publicUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* ---------------- FOLLOW / UNFOLLOW ------------ */
app.post("/api/follow/:userId", auth, async (req, res) => {
  try {
    const targetId = Number(req.params.userId);
    const me = req.userId;
    if (!targetId || Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
    if (me === targetId) return res.status(400).json({ error: "Нельзя подписаться на себя" });

    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) return res.status(404).json({ error: "User not found" });

    try {
      await prisma.$transaction([
        prisma.follow.create({ data: { followerId: me, followingId: targetId } }),
        prisma.user.update({ where: { id: me }, data: { following: { increment: 1 } } }),
        prisma.user.update({ where: { id: targetId }, data: { followers: { increment: 1 } } }),
      ]);
    } catch {
      return res.status(409).json({ error: "Уже подписаны" });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

app.delete("/api/follow/:userId", auth, async (req, res) => {
  try {
    const targetId = Number(req.params.userId);
    const me = req.userId;
    if (!targetId || Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
    if (me === targetId) return res.status(400).json({ error: "Нельзя отписаться от себя" });

    const deleted = await prisma.follow.deleteMany({ where: { followerId: me, followingId: targetId } });
    if (deleted.count > 0) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: me }, data: { following: { decrement: 1 } } }),
        prisma.user.update({ where: { id: targetId }, data: { followers: { decrement: 1 } } }),
      ]);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

app.get("/api/follow/status/:userId", auth, async (req, res) => {
  try {
    const targetId = Number(req.params.userId);
    const me = req.userId;
    if (!targetId || Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
    if (me === targetId) return res.json({ following: false });
    const rel = await prisma.follow.findFirst({ where: { followerId: me, followingId: targetId }, select: { id: true } });
    res.json({ following: !!rel });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

/* -------------------- POSTS -------------------- */
app.post("/api/posts", auth, uploadPost.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const { caption = "", location = "" } = req.body;
    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/posts/${req.file.filename}`;

    const post = await prisma.post.create({
      data: { authorId: req.userId, imageUrl, caption, location },
      select: { id: true, imageUrl: true, caption: true, location: true, createdAt: true },
    });
    res.status(201).json({ post });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Create post failed" });
  }
});

app.get("/api/users/:username/posts", async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: { id: true },
  });
  if (!u) return res.status(404).json({ error: "User not found" });

  const posts = await prisma.post.findMany({
    where: { authorId: u.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, imageUrl: true, caption: true, location: true, createdAt: true },
  });
  res.json({ posts });
});

/* -------------------- LIKES -------------------- */
app.post("/api/posts/:id/like", auth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!postId || Number.isNaN(postId)) return res.status(400).json({ error: "Invalid post id" });

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const existing = await prisma.like.findUnique({
      where: { userId_postId: { userId: req.userId, postId } },
    });

    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      const count = await prisma.like.count({ where: { postId } });
      return res.json({ liked: false, count });
    } else {
      await prisma.like.create({ data: { userId: req.userId, postId } });
      const count = await prisma.like.count({ where: { postId } });
      return res.json({ liked: true, count });
    }
  } catch (e) {
    console.error("POST /api/posts/:id/like", e);
    res.status(500).json({ error: "Like failed" });
  }
});

/* ------------------ COMMENTS ------------------- */
app.get("/api/posts/:id/comments", async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!postId || Number.isNaN(postId)) return res.status(400).json({ error: "Invalid post id" });

    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        text: true,
        createdAt: true,
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    res.json({ comments });
  } catch (e) {
    console.error("GET /api/posts/:id/comments", e);
    res.status(500).json({ error: "Failed to load comments" });
  }
});

app.post("/api/posts/:id/comments", auth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const { text } = req.body;

    if (!postId || Number.isNaN(postId)) return res.status(400).json({ error: "Invalid post id" });
    if (!text || !String(text).trim()) return res.status(400).json({ error: "Text required" });

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const c = await prisma.comment.create({
      data: { postId, authorId: req.userId, text: String(text).trim() },
      select: {
        id: true,
        text: true,
        createdAt: true,
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    const count = await prisma.comment.count({ where: { postId } });
    res.status(201).json({ comment: c, count });
  } catch (e) {
    console.error("POST /api/posts/:id/comments", e);
    res.status(500).json({ error: "Create comment failed" });
  }
});

app.delete("/api/comments/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid comment id" });

    const c = await prisma.comment.findUnique({ where: { id }, select: { id: true, authorId: true, postId: true } });
    if (!c) return res.status(404).json({ error: "Not found" });
    if (c.authorId !== req.userId) return res.status(403).json({ error: "Forbidden" });

    await prisma.comment.delete({ where: { id } });
    const count = await prisma.comment.count({ where: { postId: c.postId } });
    res.json({ ok: true, count, postId: c.postId });
  } catch (e) {
    console.error("DELETE /api/comments/:id", e);
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ------------------- FEED ------------------- */
app.get("/api/feed", auth, async (req, res) => {
  try {
    const limitRaw = parseInt(String(req.query.limit || ""), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : 10;
    const cursorParam = req.query.cursor;
    const cursorId = cursorParam !== undefined ? Number(cursorParam) : undefined;

    const rels = await prisma.follow.findMany({
      where: { followerId: req.userId },
      select: { followingId: true },
    });
    const authorIds = [req.userId, ...rels.map((r) => r.followingId)];

    const posts = await prisma.post.findMany({
      where: { authorId: { in: authorIds } },
      orderBy: { id: "desc" },
      take: limit,
      ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
      select: {
        id: true,
        imageUrl: true,
        caption: true,
        location: true,
        createdAt: true,
        author: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId: req.userId }, select: { id: true }, take: 1 },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 2,
          select: {
            id: true,
            text: true,
            createdAt: true,
            author: { select: { id: true, username: true, avatarUrl: true } },
          },
        },
      },
    });

    const shaped = posts.map((p) => ({
      id: p.id,
      imageUrl: p.imageUrl,
      caption: p.caption,
      location: p.location,
      createdAt: p.createdAt,
      author: p.author,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
      likedByMe: p.likes.length > 0,
      lastComments: [...p.comments].reverse(),
    }));

    const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null;
    res.json({ posts: shaped, nextCursor });
  } catch (e) {
    console.error("GET /api/feed error:", e);
    res.status(500).json({ error: "server error" });
  }
});

/* ------------------- ADMIN: REPORTS ------------------- */
app.get("/api/admin/reports", auth, adminOnly, async (req, res) => {
  try {
    const raw = String(req.query.status || "").toUpperCase();
    const status = raw === "OPEN" || raw === "RESOLVED" ? raw : undefined;

    const items = await prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        reporter: { select: { id: true, username: true, email: true } },
        handledBy: { select: { id: true, username: true } },
        post: {
          select: {
            id: true,
            imageUrl: true,
            caption: true,
            createdAt: true,
            author: { select: { id: true, username: true } },
          },
        },
        comment: {
          select: {
            id: true,
            text: true,
            createdAt: true,
            postId: true,
            author: { select: { id: true, username: true } },
          },
        },
        targetUser: { select: { id: true, username: true, email: true, bannedUntil: true } },
      },
    });

    res.json({ reports: items });
  } catch (e) {
    console.error("GET /api/admin/reports", e);
    res.status(500).json({
      error: "Failed to load reports",
      details: String(e?.message || e),
    });
  }
});

/* ------------------- REPORTS (public) ------------------- */
async function createReportHandler(req, res) {
  try {
    const { targetType, postId, commentId, targetUserId, reason, message } = req.body;

    if (!targetType || !["POST", "COMMENT", "USER"].includes(String(targetType))) {
      return res.status(400).json({ error: "targetType must be POST/COMMENT/USER" });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: "reason required" });
    }

    const t = String(targetType);
    const pid = postId != null ? Number(postId) : null;
    const cid = commentId != null ? Number(commentId) : null;
    const uid = targetUserId != null ? Number(targetUserId) : null;

    if (t === "POST" && (!pid || Number.isNaN(pid))) return res.status(400).json({ error: "postId required" });
    if (t === "COMMENT" && (!cid || Number.isNaN(cid))) return res.status(400).json({ error: "commentId required" });
    if (t === "USER" && (!uid || Number.isNaN(uid))) return res.status(400).json({ error: "targetUserId required" });

    if (t === "POST") {
      const post = await prisma.post.findUnique({ where: { id: pid }, select: { id: true } });
      if (!post) return res.status(404).json({ error: "Post not found" });
    }
    if (t === "COMMENT") {
      const c = await prisma.comment.findUnique({ where: { id: cid }, select: { id: true } });
      if (!c) return res.status(404).json({ error: "Comment not found" });
    }
    if (t === "USER") {
      const u = await prisma.user.findUnique({ where: { id: uid }, select: { id: true } });
      if (!u) return res.status(404).json({ error: "User not found" });
    }

    const created = await prisma.report.create({
      data: {
        targetType: t,
        postId: t === "POST" ? pid : null,
        commentId: t === "COMMENT" ? cid : null,
        targetUserId: t === "USER" ? uid : null,
        reason: String(reason).trim(),
        message: typeof message === "string" ? message.trim() : null,
        reporterId: req.userId,
      },
      select: { id: true, createdAt: true, status: true },
    });

    return res.status(201).json({ report: created });
  } catch (e) {
    console.error("POST /api/reports", e);
    return res.status(500).json({ error: "Create report failed" });
  }
}

app.post("/api/reports", auth, createReportHandler);
app.post("/api/report", auth, createReportHandler); // ✅ alias

/* ------------------- ADMIN: RESOLVE REPORT ------------------- */
async function resolveReportHandler(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid report id" });
    }

    const result = await prisma.report.updateMany({
      where: { id },
      data: {
        status: "RESOLVED",
        handledById: req.userId,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    await prisma.adminLog.create({
      data: {
        adminId: req.userId,
        action: "REPORT_RESOLVE",
        entity: "Report",
        entityId: id,
      },
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("RESOLVE REPORT ERROR:", e);
    return res.status(500).json({ error: "Resolve failed" });
  }
}

// ✅ PATCH
app.patch("/api/admin/reports/:id/resolve", auth, adminOnly, resolveReportHandler);
// ✅ POST (чтобы фронт точно работал)
app.post("/api/admin/reports/:id/resolve", auth, adminOnly, resolveReportHandler);

/* ------------------- ADMIN: USERS + POSTS ------------------- */
app.post("/api/admin/users/:id/warn", auth, adminOnly, async (req, res) => {
  try {
    const uid = Number(req.params.id);
    const text = String(req.body?.text || "").trim();

    if (!Number.isFinite(uid) || uid <= 0) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    if (!text) {
      return res.status(400).json({ error: "text required" });
    }

    const exists = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true },
    });
    if (!exists) return res.status(404).json({ error: "User not found" });

    const w = await prisma.warning.create({
      data: { userId: uid, adminId: req.userId, text },
      select: { id: true, createdAt: true, text: true },
    });

    await prisma.adminLog.create({
      data: {
        adminId: req.userId,
        action: "USER_WARNING",
        entity: "User",
        entityId: uid,
        meta: { warningId: w.id },
      },
    });

    return res.status(201).json({ ok: true, warning: w });
  } catch (e) {
    console.error("POST /api/admin/users/:id/warn", e);
    return res.status(500).json({ error: "Warning failed" });
  }
});

app.post("/api/admin/users/:id/ban", auth, adminOnly, async (req, res) => {
  try {
    const uid = Number(req.params.id);
    const d = Number(req.body?.days ?? 7);

    if (!Number.isFinite(uid) || uid <= 0) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    if (!Number.isFinite(d) || d < 1 || d > 365) {
      return res.status(400).json({ error: "days must be 1..365" });
    }

    const until = new Date(Date.now() + d * 24 * 60 * 60 * 1000);

    const result = await prisma.user.updateMany({
      where: { id: uid },
      data: { bannedUntil: until },
    });

    if (result.count === 0) return res.status(404).json({ error: "User not found" });

    await prisma.adminLog.create({
      data: {
        adminId: req.userId,
        action: "USER_BAN",
        entity: "User",
        entityId: uid,
        meta: { days: d, bannedUntil: until.toISOString() },
      },
    });

    return res.json({ ok: true, user: { id: uid, bannedUntil: until } });
  } catch (e) {
    console.error("POST /api/admin/users/:id/ban", e);
    return res.status(500).json({ error: "Ban failed" });
  }
});

/* ✅✅✅ Delete post — always ok */
app.delete("/api/admin/posts/:id", auth, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid post id" });

    const deletedCount = await prisma.$transaction(async (tx) => {
      await tx.like.deleteMany({ where: { postId: id } });
      await tx.comment.deleteMany({ where: { postId: id } });
      await tx.report.deleteMany({ where: { postId: id } });
      const del = await tx.post.deleteMany({ where: { id } });
      return del.count;
    });

    if (deletedCount > 0) {
      await prisma.adminLog.create({
        data: {
          adminId: req.userId,
          action: "POST_DELETE",
          entity: "Post",
          entityId: id,
        },
      });
    }

    return res.json({ ok: true, deleted: deletedCount > 0 });
  } catch (e) {
    console.error("DELETE /api/admin/posts/:id", e);
    return res.status(500).json({ error: "Delete post failed" });
  }
});

app.get("/api/admin/posts", auth, adminOnly, async (req, res) => {
  try {
    const limitRaw = parseInt(String(req.query.limit || ""), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        imageUrl: true,
        caption: true,
        location: true,
        createdAt: true,
        author: { select: { id: true, username: true, email: true, bannedUntil: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    res.json({ posts });
  } catch (e) {
    console.error("GET /api/admin/posts", e);
    res.status(500).json({ error: "Failed to load admin posts" });
  }

});


/* ================= BOOKINGS + CALENDAR + UNAVAILABILITY ================= */

function requireProviderRole(user) {
  return user?.role === "VIDEOGRAPHER" || user?.role === "PHOTOGRAPHER";
}

function toDateSafe(x) {
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

/* -------- provider-id by username -------- */
app.get("/api/provider-id/:username", async (req, res) => {
  try {
    const u = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, role: true },
    });
    if (!u) return res.status(404).json({ error: "User not found" });
    if (!requireProviderRole(u)) return res.status(400).json({ error: "User is not a provider" });
    res.json({ id: u.id });
  } catch (e) {
    console.error("GET /api/provider-id/:username", e);
    res.status(500).json({ error: "server error" });
  }
});

/* -------- provider calendar (busy + bookings) -------- */
app.get("/api/providers/:username/calendar", async (req, res) => {
  try {
    const u = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, role: true },
    });
    if (!u) return res.status(404).json({ error: "User not found" });
    if (!requireProviderRole(u)) return res.status(400).json({ error: "User is not a provider" });

    const busy = await prisma.unavailability.findMany({
      where: { providerId: u.id },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true, endsAt: true },
    });

    const bookings = await prisma.booking.findMany({
      where: { videographerId: u.id },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        status: true,
        durationMinutes: true,
        note: true,
        client: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    res.json({
      busy: busy.map((b) => ({ id: b.id, startsAt: b.startsAt, endsAt: b.endsAt })),
      bookings,
    });
  } catch (e) {
    console.error("GET /api/providers/:username/calendar", e);
    res.status(500).json({ error: "Failed to load calendar" });
  }
});

/* -------- create busy interval -------- */
app.post("/api/unavailability", auth, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, role: true },
    });
    if (!me) return res.status(401).json({ error: "user not found" });
    if (!requireProviderRole(me)) return res.status(403).json({ error: "Only providers can add busy time" });

    const s = toDateSafe(req.body?.startsAt);
    const eDate = toDateSafe(req.body?.endsAt);
    if (!s || !eDate) return res.status(400).json({ error: "Invalid startsAt/endsAt" });
    if (!(s < eDate)) return res.status(400).json({ error: "startsAt must be < endsAt" });

    // check overlaps with existing busy
    const existingBusy = await prisma.unavailability.findMany({
      where: { providerId: me.id },
      select: { startsAt: true, endsAt: true },
    });
    if (existingBusy.some((b) => overlaps(s, eDate, b.startsAt, b.endsAt))) {
      return res.status(409).json({ error: "Busy interval overlaps existing busy" });
    }

    // check overlaps with existing bookings (pending/confirmed)
    const existingBookings = await prisma.booking.findMany({
      where: {
        videographerId: me.id,
        status: { in: ["pending", "confirmed"] },
      },
      select: { date: true, durationMinutes: true },
    });
    const overlapsBooking = existingBookings.some((b) => {
      const bs = new Date(b.date);
      const be = new Date(bs.getTime() + (b.durationMinutes ?? 60) * 60000);
      return overlaps(s, eDate, bs, be);
    });
    if (overlapsBooking) {
      return res.status(409).json({ error: "Busy interval overlaps existing booking" });
    }

    const item = await prisma.unavailability.create({
      data: { providerId: me.id, startsAt: s, endsAt: eDate },
      select: { id: true, startsAt: true, endsAt: true },
    });

    res.status(201).json({ item });
  } catch (e) {
    console.error("POST /api/unavailability", e);
    res.status(500).json({ error: "Failed to create busy interval" });
  }
});

/* -------- delete busy interval -------- */
app.delete("/api/unavailability/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const item = await prisma.unavailability.findUnique({
      where: { id },
      select: { id: true, providerId: true },
    });
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.providerId !== req.userId) return res.status(403).json({ error: "Forbidden" });

    await prisma.unavailability.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/unavailability/:id", e);
    res.status(500).json({ error: "Delete failed" });
  }
});

/* -------- create booking (supports BOTH {date} and {start,end}) -------- */
app.post("/api/bookings", auth, async (req, res) => {
  try {
    const { videographerId, note } = req.body;

    const providerId = Number(videographerId);
    if (!Number.isFinite(providerId)) return res.status(400).json({ error: "Invalid videographerId" });
    if (providerId === req.userId) return res.status(400).json({ error: "Cannot book yourself" });

    const provider = await prisma.user.findUnique({
      where: { id: providerId },
      select: { id: true, role: true, username: true },
    });
    if (!provider) return res.status(404).json({ error: "Provider not found" });
    if (!requireProviderRole(provider)) return res.status(400).json({ error: "User is not a provider" });

    // allow legacy: {date} OR new: {start,end}
    let start = null;
    let end = null;

    if (req.body?.start && req.body?.end) {
      start = toDateSafe(req.body.start);
      end = toDateSafe(req.body.end);
    } else if (req.body?.date) {
      start = toDateSafe(req.body.date);
      const dur = Number(req.body?.durationMinutes ?? 60);
      const safeDur = Number.isFinite(dur) ? Math.max(15, Math.min(240, dur)) : 60;
      end = start ? new Date(start.getTime() + safeDur * 60000) : null;
    }

    if (!start || !end) return res.status(400).json({ error: "Invalid start/end (or date)" });
    if (!(start < end)) return res.status(400).json({ error: "start must be < end" });

    const durationMinutes = Math.max(15, Math.min(240, Math.round((end.getTime() - start.getTime()) / 60000)));

    // busy overlap
    const busy = await prisma.unavailability.findMany({
      where: { providerId: provider.id },
      select: { startsAt: true, endsAt: true },
    });
    if (busy.some((b) => overlaps(start, end, b.startsAt, b.endsAt))) {
      return res.status(409).json({ error: "Provider is busy at this time" });
    }

    // booking overlap (pending/confirmed)
    const existing = await prisma.booking.findMany({
      where: { videographerId: provider.id, status: { in: ["pending", "confirmed"] } },
      select: { date: true, durationMinutes: true },
    });
    const conflict = existing.some((b) => {
      const bs = new Date(b.date);
      const be = new Date(bs.getTime() + (b.durationMinutes ?? 60) * 60000);
      return overlaps(start, end, bs, be);
    });
    if (conflict) return res.status(409).json({ error: "This slot is already booked" });

    const booking = await prisma.booking.create({
      data: {
        clientId: req.userId,
        videographerId: provider.id,
        date: start,
        durationMinutes,
        note: typeof note === "string" ? note.trim() : null,
        status: "pending",
      },
      select: {
        id: true,
        date: true,
        status: true,
        durationMinutes: true,
        note: true,
        client: { select: { id: true, username: true, avatarUrl: true } },
        videographer: { select: { id: true, username: true, avatarUrl: true, role: true } },
      },
    });

    res.status(201).json({ booking });
  } catch (e) {
    console.error("POST /api/bookings", e);
    res.status(500).json({ error: "Booking failed" });
  }
});

/* -------- my bookings (client) -------- */
app.get("/api/bookings/my", auth, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { clientId: req.userId },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        status: true,
        note: true,
        durationMinutes: true,
        videographer: { select: { id: true, username: true, avatarUrl: true, role: true } },
        review: { select: { id: true, rating: true } },
      },
    });
    res.json({ bookings });
  } catch (e) {
    console.error("GET /api/bookings/my", e);
    res.status(500).json({ error: "Failed to load my bookings" });
  }
});

/* -------- bookings to me (provider) -------- */
app.get("/api/bookings/to-me", auth, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    });
    if (!requireProviderRole(me)) {
      return res.status(403).json({ error: "Only providers can view requests" });
    }

    const bookings = await prisma.booking.findMany({
      where: { videographerId: req.userId },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        status: true,
        note: true,
        durationMinutes: true,
        client: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
    res.json({ bookings });
  } catch (e) {
    console.error("GET /api/bookings/to-me", e);
    res.status(500).json({ error: "Failed to load requests" });
  }
});

/* -------- update booking status -------- */
app.patch("/api/bookings/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const action = String(req.body?.action || "");

    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid booking id" });
    if (!["confirm", "decline", "cancel", "done"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, clientId: true, videographerId: true, status: true },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const isProvider = booking.videographerId === req.userId;
    const isClient = booking.clientId === req.userId;

    if (action === "cancel") {
      if (!isClient && !isProvider) return res.status(403).json({ error: "Forbidden" });
      const updated = await prisma.booking.update({
        where: { id },
        data: { status: "cancelled" },
      });
      return res.json({ booking: updated });
    }

    // provider-only actions:
    if (!isProvider) return res.status(403).json({ error: "Only provider can do this action" });

    let newStatus = booking.status;

    if (action === "confirm") newStatus = "confirmed";
    if (action === "decline") newStatus = "declined";
    if (action === "done") newStatus = "done";

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: newStatus },
      select: {
        id: true,
        date: true,
        status: true,
        durationMinutes: true,
        note: true,
        client: { select: { id: true, username: true } },
      },
    });

    res.json({ booking: updated });
  } catch (e) {
    console.error("PATCH /api/bookings/:id", e);
    res.status(500).json({ error: "Update booking failed" });
  }
});

/* -------- reviews -------- */
app.post("/api/reviews", auth, async (req, res) => {
  try {
    const bookingId = Number(req.body?.bookingId);
    const rating = Number(req.body?.rating);
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

    if (!Number.isFinite(bookingId)) return res.status(400).json({ error: "Invalid bookingId" });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5)
      return res.status(400).json({ error: "rating must be 1..5" });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        clientId: true,
        videographerId: true,
        review: { select: { id: true } },
      },
    });

    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.clientId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    if (booking.status !== "done") return res.status(400).json({ error: "Booking must be done to review" });
    if (booking.review?.id) return res.status(409).json({ error: "Review already exists" });

    const review = await prisma.review.create({
      data: {
        bookingId: booking.id,
        clientId: booking.clientId,
        providerId: booking.videographerId,
        rating,
        text,
      },
      select: { id: true, bookingId: true, rating: true, text: true, createdAt: true },
    });

    res.status(201).json({ review });
  } catch (e) {
    console.error("POST /api/reviews", e);
    res.status(500).json({ error: "Failed to create review" });
  }
});

app.get("/api/providers/:username/reviews", async (req, res) => {
  try {
    const u = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true },
    });
    if (!u) return res.status(404).json({ error: "User not found" });

    const reviews = await prisma.review.findMany({
      where: { providerId: u.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        rating: true,
        text: true,
        createdAt: true,
        client: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    const avgRating =
      reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

    res.json({ reviews, avgRating, count: reviews.length });
  } catch (e) {
    console.error("GET /api/providers/:username/reviews", e);
    res.status(500).json({ error: "Failed to load reviews" });
  }
});











/* ------------------- START --------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
