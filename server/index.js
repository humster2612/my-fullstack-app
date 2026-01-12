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

/* ----------------- Multer (media) ------------- */
const fileFilter = (req, file, cb) => {
  const okImage = /^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype);
  const okVideo = /^video\/(mp4|webm|quicktime)$/i.test(file.mimetype); // mp4, webm, mov
  if (okImage || okVideo) cb(null, true);
  else cb(new Error("Only image/video files are allowed"));
};

const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `u${req.userId || "anon"}_${Date.now()}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 3 * 1024 * 1024 },
});

const uploadPost = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, postsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".bin";
      cb(null, `p${req.userId}_${Date.now()}${ext}`);
    },
  }),
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
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

    const me = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { bannedUntil: true },
    });

    if (!me) return res.status(401).json({ error: "user not found" });

    if (me.bannedUntil && new Date(me.bannedUntil) > new Date()) {
      return res.status(403).json({ error: "You are banned", bannedUntil: me.bannedUntil });
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
    if (!me || me.role !== "ADMIN") return res.status(403).json({ error: "Admin only" });
    next();
  } catch (e) {
    console.error("adminOnly", e);
    return res.status(500).json({ error: "server error" });
  }
}

function isProviderRole(role) {
  return role === "VIDEOGRAPHER" || role === "PHOTOGRAPHER";
}

function safeInt(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}


app.get("/api/notifications", auth, async (req, res) => {
  try {
    const items = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        fromUser: {
          select: { id: true, username: true, avatarUrl: true },
        },
        post: {
          select: { id: true, imageUrl: true, videoUrl: true },
        },
        comment: {
          select: { id: true, text: true },
        },
      },
    });

    res.json({ notifications: items });
  } catch (e) {
    console.error("GET /api/notifications", e);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});




app.patch("/api/notifications/:id/read", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const n = await prisma.notification.findUnique({ where: { id }, select: { userId: true } });
    if (!n) return res.status(404).json({ error: "Not found" });
    if (n.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });

    const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } });
    res.json({ notification: updated });
  } catch (e) {
    console.error("PATCH /api/notifications/:id/read", e);
    res.status(500).json({ error: "Failed" });
  }
});




/* ------------------- AUTH ---------------------- */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, username } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email и password обязательны" });

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
    console.error("register", e);
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
    console.error("login", e);
    res.status(500).json({ error: "server error" });
  }
});

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

/* ===== ADMIN: announcements + logs ===== */
app.get("/api/admin/announcements", auth, adminOnly, async (req, res) => {
  try {
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
  } catch (e) {
    console.error("GET /api/admin/announcements", e);
    res.status(500).json({ error: "server error" });
  }
});

app.post("/api/admin/announcements", auth, adminOnly, async (req, res) => {
  try {
    const { title, body, isActive = true } = req.body;
    if (!title || !String(title).trim()) return res.status(400).json({ error: "title required" });

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
      data: { adminId: req.userId, action: "ANNOUNCEMENT_DELETE", entity: "Announcement", entityId: id },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/announcements/:id", e);
    res.status(500).json({ error: "Delete failed" });
  }
});

app.get("/api/admin/logs", auth, adminOnly, async (req, res) => {
  try {
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
  } catch (e) {
    console.error("GET /api/admin/logs", e);
    res.status(500).json({ error: "server error" });
  }
});

/* ------------------ PROFILE -------------------- */
app.get("/api/users/me", auth, async (req, res) => {
  try {
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
        portfolioVideos: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (e) {
    console.error("GET /api/users/me", e);
    res.status(500).json({ error: "server error" });
  }
});

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

    if (role && ["CLIENT", "VIDEOGRAPHER", "PHOTOGRAPHER", "ADMIN"].includes(role)) data.role = role;
    if (Array.isArray(specialization)) data.specialization = specialization.map(String);
    if (pricePerHour !== undefined) data.pricePerHour = Number.isFinite(+pricePerHour) ? +pricePerHour : null;

    if (latitude !== undefined) {
      const latNum = Number(latitude);
      if (!Number.isNaN(latNum)) data.latitude = latNum;
    }
    if (longitude !== undefined) {
      const lngNum = Number(longitude);
      if (!Number.isNaN(lngNum)) data.longitude = lngNum;
    }

    if (Array.isArray(portfolioVideos)) data.portfolioVideos = portfolioVideos.map(String).filter(Boolean);

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
        portfolioVideos: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (e) {
    console.error("GET /api/users/:username", e);
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

/* ---------------- AVATAR UPLOAD ---------------- */
app.post("/api/users/me/avatar", auth, uploadAvatar.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const publicUrl = `${req.protocol}://${req.get("host")}/uploads/avatars/${req.file.filename}`;
    await prisma.user.update({ where: { id: req.userId }, data: { avatarUrl: publicUrl } });
    res.json({ url: publicUrl });
  } catch (e) {
    console.error("avatar upload", e);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* -------------------- POSTS (image + video) -------------------- */
app.post("/api/posts", auth, uploadPost.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const { caption = "", location = "" } = req.body;

    const url = `${req.protocol}://${req.get("host")}/uploads/posts/${req.file.filename}`;
    const isVideo = /^video\//i.test(req.file.mimetype);

    const post = await prisma.post.create({
      data: {
        authorId: req.userId,
        imageUrl: isVideo ? "" : url,
        videoUrl: isVideo ? url : null,
        caption,
        location,
      },
      select: {
        id: true,
        imageUrl: true,
        videoUrl: true,
        caption: true,
        location: true,
        createdAt: true,
      },
    });

    res.status(201).json({ post });
  } catch (e) {
    console.error("POST /api/posts", e);
    res.status(500).json({ error: "Create post failed" });
  }
});

app.get("/api/users/:username/posts", async (req, res) => {
  try {
    const u = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true },
    });
    if (!u) return res.status(404).json({ error: "User not found" });

    const posts = await prisma.post.findMany({
      where: { authorId: u.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        imageUrl: true,
        videoUrl: true,
        caption: true,
        location: true,
        createdAt: true,
      },
    });

    res.json({ posts });
  } catch (e) {
    console.error("GET /api/users/:username/posts", e);
    res.status(500).json({ error: "server error" });
  }
});

/* -------------------- LIKES -------------------- */
app.post("/api/posts/:id/like", auth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!postId || Number.isNaN(postId)) return res.status(400).json({ error: "Invalid post id" });

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });
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

      // ✅ notify owner (not self)
      if (post.authorId !== req.userId) {
        await prisma.notification.create({
          data: {
            userId: post.authorId,
            fromUserId: req.userId,
            type: "LIKE",
            postId: post.id,
            message: "liked your post",
          },
        });
      }

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

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });
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

    if (post.authorId !== req.userId) {
      await prisma.notification.create({
        data: {
          userId: post.authorId,
          fromUserId: req.userId,
          type: "COMMENT",
          postId: post.id,
          commentId: c.id,
          message: String(c.text || "").trim(),
        },
      });
    }

    const count = await prisma.comment.count({ where: { postId } });
    res.status(201).json({ comment: c, count });
  } catch (e) {
    console.error("POST /api/posts/:id/comments", e);
    res.status(500).json({ error: "Create comment failed" });
  }
});


    


app.delete("/api/comments/:id", auth, async (req, res) => {
  try {
    const cid = Number(req.params.id);
    if (!cid || Number.isNaN(cid)) return res.status(400).json({ error: "Invalid comment id" });

    const c = await prisma.comment.findUnique({ where: { id: cid }, select: { id: true, authorId: true, postId: true } });
    if (!c) return res.status(404).json({ error: "Comment not found" });

    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
    const can = c.authorId === req.userId || me?.role === "ADMIN";
    if (!can) return res.status(403).json({ error: "Forbidden" });

    await prisma.comment.delete({ where: { id: cid } });
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
        videoUrl: true,
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
      videoUrl: p.videoUrl,
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

/* ------------------ FOLLOW ------------------- */
app.get("/api/follow/status/:userId", auth, async (req, res) => {
  try {
    const uid = Number(req.params.userId);
    if (!uid || Number.isNaN(uid)) return res.status(400).json({ error: "Invalid userId" });
    if (uid === req.userId) return res.json({ following: false });

    const rel = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.userId, followingId: uid } },
      select: { id: true },
    });
    res.json({ following: !!rel });
  } catch (e) {
    console.error("GET /api/follow/status/:userId", e);
    res.status(500).json({ error: "server error" });
  }
});

app.post("/api/follow/:userId", auth, async (req, res) => {
  try {
    const uid = Number(req.params.userId);
    if (!uid || Number.isNaN(uid)) return res.status(400).json({ error: "Invalid userId" });
    if (uid === req.userId) return res.status(400).json({ error: "Cannot follow yourself" });

    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: req.userId, followingId: uid } },
      create: { followerId: req.userId, followingId: uid },
      update: {},
    });

    await prisma.user.update({ where: { id: uid }, data: { followers: { increment: 1 } } }).catch(() => {});
    await prisma.user.update({ where: { id: req.userId }, data: { following: { increment: 1 } } }).catch(() => {});

    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/follow/:userId", e);
    res.status(500).json({ error: "Follow failed" });
  }
});

app.delete("/api/follow/:userId", auth, async (req, res) => {
  try {
    const uid = Number(req.params.userId);
    if (!uid || Number.isNaN(uid)) return res.status(400).json({ error: "Invalid userId" });
    if (uid === req.userId) return res.status(400).json({ error: "Cannot unfollow yourself" });

    const rel = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.userId, followingId: uid } },
      select: { id: true },
    });
    if (rel) await prisma.follow.delete({ where: { id: rel.id } });

    await prisma.user.update({ where: { id: uid }, data: { followers: { decrement: 1 } } }).catch(() => {});
    await prisma.user.update({ where: { id: req.userId }, data: { following: { decrement: 1 } } }).catch(() => {});

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/follow/:userId", e);
    res.status(500).json({ error: "Unfollow failed" });
  }
});

/* ------------------ PROVIDERS MAP ------------------- */
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
        latitude: true,
        longitude: true,
        specialization: true,
      },
      take: 500,
    });

    res.json({
      providers: providers.map((p) => ({
        id: p.id,
        username: p.username,
        location: p.location || "",
        lat: p.latitude,
        lng: p.longitude,
        specializations: p.specialization || [],
      })),
    });
  } catch (e) {
    console.error("GET /api/providers/map", e);
    res.status(500).json({ error: "server error" });
  }
});

/* ------------------ PROVIDER ID BY USERNAME ------------------- */
app.get("/api/provider-id/:username", async (req, res) => {
  try {
    const u = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, role: true },
    });
    if (!u) return res.status(404).json({ error: "User not found" });
    if (!isProviderRole(u.role)) return res.status(400).json({ error: "Not a provider" });
    res.json({ id: u.id });
  } catch (e) {
    console.error("GET /api/provider-id/:username", e);
    res.status(500).json({ error: "server error" });
  }
});

/* ------------------ BOOKINGS ------------------- */
app.post("/api/bookings", auth, async (req, res) => {
  try {
    const { videographerId, date, start, end, note } = req.body;
    const pid = safeInt(videographerId);
    // if (!pid) return res.status(400).json({ error: "videographerId required" });
    if (pid === req.userId) return res.status(400).json({ error: "You cannot book yourself" });

    const provider = await prisma.user.findUnique({
      where: { id: pid },
      select: { id: true, role: true },
    });
    if (!provider) return res.status(404).json({ error: "Provider not found" });
    if (!isProviderRole(provider.role)) return res.status(400).json({ error: "User is not provider" });

    let dateISO = null;
    let durationMinutes = 60;

    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return res.status(400).json({ error: "Invalid start/end" });
      const diff = Math.max(1, Math.round((e.getTime() - s.getTime()) / 60000));
      durationMinutes = diff;
      dateISO = s;
    } else if (date) {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Invalid date" });
      dateISO = d;
    } else {
      return res.status(400).json({ error: "date or (start,end) required" });
    }

    const booking = await prisma.booking.create({
      data: {
        clientId: req.userId,
        videographerId: pid,
        date: dateISO,
        note: typeof note === "string" ? note : null,
        durationMinutes,
        status: "pending",
      },
    });

    res.status(201).json({ booking });
  } catch (e) {
    console.error("POST /api/bookings", e);
    res.status(500).json({ error: "Create booking failed" });
  }
});

app.get("/api/bookings/my", auth, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { clientId: req.userId },
      orderBy: { date: "desc" },
      take: 200,
      include: {
        videographer: { select: { id: true, username: true, avatarUrl: true, role: true } },
        review: true,
      },
    });
    res.json({ bookings });
  } catch (e) {
    console.error("GET /api/bookings/my", e);
    res.status(500).json({ error: "server error" });
  }
});

app.get("/api/bookings/to-me", auth, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { videographerId: req.userId },
      orderBy: { date: "desc" },
      take: 200,
      include: {
        client: { select: { id: true, username: true, avatarUrl: true } },
        review: true,
      },
    });
    res.json({ bookings });
  } catch (e) {
    console.error("GET /api/bookings/to-me", e);
    res.status(500).json({ error: "server error" });
  }
});

app.patch("/api/bookings/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { action } = req.body;
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const b = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, clientId: true, videographerId: true, status: true, date: true, durationMinutes: true, note: true },
    });
    if (!b) return res.status(404).json({ error: "Booking not found" });

    const isClient = b.clientId === req.userId;
    const isProvider = b.videographerId === req.userId;
    if (!isClient && !isProvider) return res.status(403).json({ error: "Forbidden" });

    let nextStatus = b.status;
    if (action === "confirm" && isProvider) nextStatus = "confirmed";
    else if (action === "decline" && isProvider) nextStatus = "declined";
    else if (action === "cancel" && isClient) nextStatus = "canceled";
    else if (action === "done" && isProvider) nextStatus = "done";
    else return res.status(400).json({ error: "Invalid action or permissions" });

    const booking = await prisma.booking.update({ where: { id }, data: { status: nextStatus } });
    res.json({ booking });
  } catch (e) {
    console.error("PATCH /api/bookings/:id", e);
    res.status(500).json({ error: "Update failed" });
  }
});

/* ------------------ PROVIDER CALENDAR ------------------- */
app.get("/api/providers/:username/calendar", async (req, res) => {
  try {
    const u = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, role: true },
    });
    if (!u) return res.status(404).json({ error: "User not found" });
    if (!isProviderRole(u.role)) return res.status(400).json({ error: "Not a provider" });

    const busy = await prisma.unavailability.findMany({
      where: { providerId: u.id },
      orderBy: { startsAt: "asc" },
      take: 500,
      select: { id: true, startsAt: true, endsAt: true },
    });

    const bookings = await prisma.booking.findMany({
      where: { videographerId: u.id },
      orderBy: { date: "asc" },
      take: 500,
      select: { id: true, date: true, status: true },
    });

    res.json({ busy, bookings });
  } catch (e) {
    console.error("GET /api/providers/:username/calendar", e);
    res.status(500).json({ error: "server error" });
  }
});

/* ------------------ UNAVAILABILITY ------------------- */
app.post("/api/unavailability", auth, async (req, res) => {
  try {
    const { startsAt, endsAt } = req.body;
    const s = new Date(startsAt);
    const e = new Date(endsAt);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return res.status(400).json({ error: "Invalid dates" });
    if (e <= s) return res.status(400).json({ error: "endsAt must be after startsAt" });

    const item = await prisma.unavailability.create({
      data: { providerId: req.userId, startsAt: s, endsAt: e },
      select: { id: true, startsAt: true, endsAt: true },
    });

    res.status(201).json({ item });
  } catch (e) {
    console.error("POST /api/unavailability", e);
    res.status(500).json({ error: "Create failed" });
  }
});

app.delete("/api/unavailability/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const item = await prisma.unavailability.findUnique({ where: { id }, select: { id: true, providerId: true } });
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.providerId !== req.userId) return res.status(403).json({ error: "Forbidden" });

    await prisma.unavailability.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/unavailability/:id", e);
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ------------------ REVIEWS ------------------- */
app.post("/api/reviews", auth, async (req, res) => {
  try {
    const { bookingId, rating, text } = req.body;
    const bid = safeInt(bookingId);
    const r = safeInt(rating);

    if (!bid) return res.status(400).json({ error: "bookingId required" });
    if (!r || r < 1 || r > 5) return res.status(400).json({ error: "rating 1..5" });

    const b = await prisma.booking.findUnique({
      where: { id: bid },
      select: { id: true, clientId: true, videographerId: true, status: true },
    });
    if (!b) return res.status(404).json({ error: "Booking not found" });
    if (b.clientId !== req.userId) return res.status(403).json({ error: "Forbidden" });

    const review = await prisma.review.create({
      data: {
        bookingId: b.id,
        clientId: b.clientId,
        providerId: b.videographerId,
        rating: r,
        text: typeof text === "string" ? text : "",
      },
      select: { id: true, bookingId: true, rating: true, text: true, createdAt: true },
    });

    res.status(201).json({ review });
  } catch (e) {
    console.error("POST /api/reviews", e);
    res.status(500).json({ error: "Create review failed" });
  }
});

app.get("/api/providers/:username/reviews", async (req, res) => {
  try {
    const u = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, role: true },
    });
    if (!u) return res.status(404).json({ error: "User not found" });
    if (!isProviderRole(u.role)) return res.status(400).json({ error: "Not a provider" });

    const reviews = await prisma.review.findMany({
      where: { providerId: u.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        rating: true,
        text: true,
        createdAt: true,
        client: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    const count = await prisma.review.count({ where: { providerId: u.id } });
    const avgAgg = await prisma.review.aggregate({
      where: { providerId: u.id },
      _avg: { rating: true },
    });

    res.json({ reviews, count, avgRating: avgAgg._avg.rating || 0 });
  } catch (e) {
    console.error("GET /api/providers/:username/reviews", e);
    res.status(500).json({ error: "Failed to load reviews" });
  }
});

/* ------------------ PORTFOLIO (PortfolioItem model) ------------------- */
function mapPortfolioItem(it) {
  return {
    id: it.id,
    kind: it.type, // IMAGE/VIDEO/LINK
    title: it.title ?? null,
    url: it.url,
    thumbUrl: null, // в твоей схеме нет thumbUrl
    description: it.description ?? null,
    order: it.order ?? 0,
    createdAt: it.createdAt,
  };
}

app.get("/api/users/:username/portfolio", async (req, res) => {
  try {
    const u = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, role: true },
    });
    if (!u) return res.status(404).json({ error: "User not found" });
    if (!isProviderRole(u.role)) return res.json({ items: [] });

    const items = await prisma.portfolioItem.findMany({
      where: { providerId: u.id },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    res.json({ items: items.map(mapPortfolioItem) });
  } catch (e) {
    console.error("GET /api/users/:username/portfolio", e);
    res.status(500).json({ error: "Failed to load portfolio" });
  }
});

app.get("/api/users/me/portfolio", auth, async (req, res) => {
  try {
    const items = await prisma.portfolioItem.findMany({
      where: { providerId: req.userId },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    res.json({ items: items.map(mapPortfolioItem) });
  } catch (e) {
    console.error("GET /api/users/me/portfolio", e);
    res.status(500).json({ error: "Failed to load portfolio" });
  }
});

app.post("/api/users/me/portfolio", auth, async (req, res) => {
  try {
    const { kind, title, url, description, order } = req.body;
    if (!url || !String(url).trim()) return res.status(400).json({ error: "url required" });

    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
    if (!isProviderRole(me?.role)) return res.status(403).json({ error: "Only providers can add portfolio" });

    const type = ["IMAGE", "VIDEO", "LINK"].includes(String(kind)) ? String(kind) : "LINK";

    const item = await prisma.portfolioItem.create({
      data: {
        providerId: req.userId,
        type,
        title: typeof title === "string" ? title : null,
        description: typeof description === "string" ? description : null,
        url: String(url).trim(),
        order: Number.isFinite(+order) ? +order : 0,
      },
    });

    res.status(201).json({ item: mapPortfolioItem(item) });
  } catch (e) {
    console.error("POST /api/users/me/portfolio", e);
    res.status(500).json({ error: "Failed to add portfolio item" });
  }
});

app.patch("/api/users/me/portfolio/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const existing = await prisma.portfolioItem.findUnique({ where: { id }, select: { id: true, providerId: true } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.providerId !== req.userId) return res.status(403).json({ error: "Forbidden" });

    const { kind, title, url, description, order } = req.body;
    const data = {};
    if (kind && ["IMAGE", "VIDEO", "LINK"].includes(String(kind))) data.type = String(kind);
    if (title !== undefined) data.title = title === null ? null : String(title);
    if (url !== undefined) data.url = url === null ? null : String(url);
    if (description !== undefined) data.description = description === null ? null : String(description);
    if (order !== undefined) data.order = Number.isFinite(+order) ? +order : 0;

    const item = await prisma.portfolioItem.update({ where: { id }, data });
    res.json({ item: mapPortfolioItem(item) });
  } catch (e) {
    console.error("PATCH /api/users/me/portfolio/:id", e);
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete("/api/users/me/portfolio/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const existing = await prisma.portfolioItem.findUnique({ where: { id }, select: { id: true, providerId: true } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.providerId !== req.userId) return res.status(403).json({ error: "Forbidden" });

    await prisma.portfolioItem.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/users/me/portfolio/:id", e);
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ------------------- REPORTS (public) ------------------- */
async function createReportHandler(req, res) {
  try {
    const { targetType, postId, commentId, targetUserId, reason, message } = req.body;

    if (!targetType || !["POST", "COMMENT", "USER"].includes(String(targetType)))
      return res.status(400).json({ error: "targetType must be POST/COMMENT/USER" });
    if (!reason || !String(reason).trim()) return res.status(400).json({ error: "reason required" });

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
app.post("/api/report", auth, createReportHandler);

/* ------------------- ADMIN: reports/posts/users moderation ------------------- */
app.get("/api/admin/reports", auth, adminOnly, async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;

    const where = {};
    if (status && ["OPEN", "RESOLVED"].includes(status)) where.status = status;

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        reporter: { select: { id: true, username: true, email: true } },
        handledBy: { select: { id: true, username: true, email: true } },
        post: { select: { id: true, caption: true, imageUrl: true, videoUrl: true, createdAt: true } },
        comment: { select: { id: true, text: true, createdAt: true } },
        targetUser: { select: { id: true, username: true, email: true } },
      },
    });

    res.json({ reports });
  } catch (e) {
    console.error("GET /api/admin/reports", e);
    res.status(500).json({ error: "server error" });
  }
});

app.post("/api/admin/reports/:id/resolve", auth, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid report id" });

    const updated = await prisma.report.update({
      where: { id },
      data: { status: "RESOLVED", handledById: req.userId },
    });

    await prisma.adminLog.create({
      data: { adminId: req.userId, action: "REPORT_RESOLVE", entity: "Report", entityId: id },
    });

    res.json({ report: updated });
  } catch (e) {
    console.error("POST /api/admin/reports/:id/resolve", e);
    res.status(500).json({ error: "Resolve failed" });
  }
});

app.get("/api/admin/posts", auth, adminOnly, async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        imageUrl: true,
        videoUrl: true,
        caption: true,
        location: true,
        createdAt: true,
        author: { select: { id: true, username: true, email: true } },
        _count: { select: { likes: true, comments: true, reports: true } },
      },
    });
    res.json({ posts });
  } catch (e) {
    console.error("GET /api/admin/posts", e);
    res.status(500).json({ error: "server error" });
  }
});

// ✅ FIX: delete post without FK errors (transaction)
app.delete("/api/admin/posts/:id", auth, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid post id" });

    await prisma.$transaction(async (tx) => {
      // notifications linked to post
      await tx.notification.deleteMany({ where: { postId: id } });

      // reports linked to post
      await tx.report.deleteMany({ where: { postId: id } });

      // find comment ids
      const comments = await tx.comment.findMany({
        where: { postId: id },
        select: { id: true },
      });
      const cids = comments.map((c) => c.id);

      if (cids.length) {
        await tx.notification.deleteMany({ where: { commentId: { in: cids } } });
        await tx.report.deleteMany({ where: { commentId: { in: cids } } });
      }

      await tx.comment.deleteMany({ where: { postId: id } });
      await tx.like.deleteMany({ where: { postId: id } });

      await tx.post.delete({ where: { id } });
    });

    await prisma.adminLog.create({
      data: { adminId: req.userId, action: "POST_DELETE", entity: "Post", entityId: id },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/posts/:id", e);
    res.status(500).json({ error: "Delete failed" });
  }
});

app.post("/api/admin/users/:id/ban", auth, adminOnly, async (req, res) => {
  try {
    const uid = Number(req.params.id);
    const days = Number(req.body?.days ?? 7);
    if (!uid || Number.isNaN(uid)) return res.status(400).json({ error: "Invalid userId" });

    const until = new Date(Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000);

    const user = await prisma.user.update({
      where: { id: uid },
      data: { bannedUntil: until },
      select: { id: true, username: true, bannedUntil: true },
    });

    await prisma.adminLog.create({
      data: {
        adminId: req.userId,
        action: "USER_BAN",
        entity: "User",
        entityId: uid,
        meta: { days, until },
      },
    });

    res.json({ user });
  } catch (e) {
    console.error("POST /api/admin/users/:id/ban", e);
    res.status(500).json({ error: "Ban failed" });
  }
});

app.post("/api/admin/users/:id/warn", auth, adminOnly, async (req, res) => {
  try {
    const uid = Number(req.params.id);
    const text = String(req.body?.text || "").trim();
    if (!uid || Number.isNaN(uid)) return res.status(400).json({ error: "Invalid userId" });
    if (!text) return res.status(400).json({ error: "text required" });

    const warning = await prisma.warning.create({
      data: { userId: uid, adminId: req.userId, text },
    });

    await prisma.adminLog.create({
      data: {
        adminId: req.userId,
        action: "USER_WARN",
        entity: "User",
        entityId: uid,
        meta: { warningId: warning.id },
      },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/admin/users/:id/warn", e);
    res.status(500).json({ error: "Warn failed" });
  }
});

/* ------------------- START --------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
