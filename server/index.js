// server/index.js
const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const path = require('path')
const fs = require('fs')
const multer = require('multer')

const prisma = new PrismaClient()
const app = express()

/* -------------------- CORS -------------------- */
const isProd = process.env.NODE_ENV === 'production'
app.use(express.json())
app.use(cors({
  origin: isProd ? [process.env.CLIENT_ORIGIN] : true,
  credentials: true
}))

/* --------------- STATIC (uploads) -------------- */
const uploadsRoot = path.join(__dirname, 'uploads')
const avatarsDir  = path.join(uploadsRoot, 'avatars')
const postsDir    = path.join(uploadsRoot, 'posts')           // 👈 папка для постов
fs.mkdirSync(avatarsDir, { recursive: true })
fs.mkdirSync(postsDir, { recursive: true })
app.use('/uploads', express.static(uploadsRoot))

/* ----------------- Multer (images) ------------- */
const fileFilter = (req, file, cb) => {
  if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) cb(null, true)
  else cb(new Error('Only image files are allowed'))
}

/* для аватаров */
const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
      cb(null, `u${req.userId || 'anon'}_${Date.now()}${ext}`)
    }
  }),
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }
})

/* для постов */
const uploadPost = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, postsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
      cb(null, `p${req.userId}_${Date.now()}${ext}`)
    }
  }),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
})

/* ---------------- test ---------------- */
app.get('/api/hello', (req, res) => res.json({ message: 'Привет с backend 👋' }))

/* --------------- auth middleware --------------- */
function auth(req, res, next) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return res.status(401).json({ error: 'no token' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'invalid token' })
  }
}


async function adminOnly(req, res, next) {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true }
    });
    if (!me || me.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin only' });
    }
    next();
  } catch (e) {
    console.error('adminOnly', e);
    return res.status(500).json({ error: 'server error' });
  }
}

app.get('/api/announcements', async (req, res) => {
  try {
    const items = await prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, title: true, body: true, isActive: true, createdAt: true,
        createdBy: { select: { id: true, username: true } }
      }
    });
    res.json({ announcements: items });
  } catch (e) {
    console.error('GET /api/announcements', e);
    res.status(500).json({ error: 'Failed to load announcements' });
  }
});

// ===== ADMIN: announcements =====
app.get('/api/admin/announcements', auth, adminOnly, async (req, res) => {
  const items = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, title: true, body: true, isActive: true, createdAt: true, updatedAt: true,
      createdBy: { select: { id: true, username: true } }
    }
  });
  res.json({ announcements: items });
});

app.post('/api/admin/announcements', auth, adminOnly, async (req, res) => {
  try {
    const { title, body, isActive = true } = req.body;
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'title required' });

    const created = await prisma.announcement.create({
      data: {
        title: String(title).trim(),
        body: String(body || '').trim(),
        isActive: !!isActive,
        createdById: req.userId
      },
      select: { id: true, title: true, body: true, isActive: true, createdAt: true }
    });

    await prisma.adminLog.create({
      data: {
        adminId: req.userId,
        action: 'ANNOUNCEMENT_CREATE',
        entity: 'Announcement',
        entityId: created.id,
        meta: { title: created.title }
      }
    });

    res.status(201).json({ announcement: created });
  } catch (e) {
    console.error('POST /api/admin/announcements', e);
    res.status(500).json({ error: 'Create failed' });
  }
});

app.patch('/api/admin/announcements/:id', auth, adminOnly, async (req, res) => {
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
      select: { id: true, title: true, body: true, isActive: true, updatedAt: true }
    });

    await prisma.adminLog.create({
      data: {
        adminId: req.userId,
        action: 'ANNOUNCEMENT_UPDATE',
        entity: 'Announcement',
        entityId: id,
        meta: { title: updated.title }
      }
    });

    res.json({ announcement: updated });
  } catch (e) {
    console.error('PATCH /api/admin/announcements/:id', e);
    res.status(500).json({ error: 'Update failed' });
  }
});

app.delete('/api/admin/announcements/:id', auth, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);

    await prisma.announcement.delete({ where: { id } });

    await prisma.adminLog.create({
      data: {
        adminId: req.userId,
        action: 'ANNOUNCEMENT_DELETE',
        entity: 'Announcement',
        entityId: id
      }
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/admin/announcements/:id', e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

app.get('/api/admin/logs', auth, adminOnly, async (req, res) => {
  const items = await prisma.adminLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, action: true, entity: true, entityId: true, meta: true, createdAt: true,
      admin: { select: { id: true, username: true, email: true } }
    }
  });
  res.json({ logs: items });
});









/* ------------------- AUTH ---------------------- */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, username } = req.body
    if (!email || !password) return res.status(400).json({ error: 'email и password обязательны' })

    const existEmail = await prisma.user.findUnique({ where: { email } })
    if (existEmail) return res.status(409).json({ error: 'Пользователь уже существует' })

    const safeName = (username && username.trim()) || email.split('@')[0] + Math.floor(Math.random() * 10000)
    const existU = await prisma.user.findUnique({ where: { username: safeName } })
    if (existU) return res.status(409).json({ error: 'Такой username уже существует' })

  //  шифровка данных пользователя (bycryp)

    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, password: hash, username: safeName },
      select: { id: true, email: true, username: true }
    })
    res.status(201).json({ user })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'server error' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Неверные данные' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'Неверные данные' })
    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ 
      token, 
      user: { id: user.id, email: user.email, username: user.username, role: user.role } 
    })
    
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'server error' })
  }
})

/* ------------------ PROFILE -------------------- */
app.get('/api/users/me', auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
        id: true, email: true, username: true,
        avatarUrl: true, bio: true, location: true, links: true,
        followers: true, following: true, createdAt: true,
        role: true, specialization: true, pricePerHour: true, portfolioVideos: true,
      }
      
  })
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ user })
})

// ===== UPDATE PROFILE =====
app.patch('/api/users/me', auth, async (req, res) => {
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
        portfolioVideos,
  
        latitude,
        longitude,
      } = req.body;
  
      // Проверка: уникальный username
      if (typeof username === 'string' && username.trim()) {
        const exists = await prisma.user.findFirst({
          where: { username: username.trim(), NOT: { id: req.userId } },
          select: { id: true }
        });
        if (exists) return res.status(409).json({ error: 'Username is taken' });
      }
  
      const data = {};
      if (typeof username === 'string') data.username = username.trim();
      if (typeof avatarUrl === 'string') data.avatarUrl = avatarUrl.trim();
      if (typeof bio === 'string') data.bio = bio;
      if (typeof location === 'string') data.location = location.trim();
      if (Array.isArray(links)) data.links = links;
  
      if (role && ['CLIENT', 'VIDEOGRAPHER', 'PHOTOGRAPHER'].includes(role))
        data.role = role;
      if (Array.isArray(specialization))
        data.specialization = specialization.map(String);
      if (pricePerHour !== undefined)
        data.pricePerHour = Number.isFinite(+pricePerHour) ? +pricePerHour : null;
      if (Array.isArray(portfolioVideos))
        data.portfolioVideos = portfolioVideos.map(String);
  
      // 👇 аккуратно кладём координаты
      if (latitude !== undefined) {
        const latNum = Number(latitude);
        if (!Number.isNaN(latNum)) data.latitude = latNum;
      }
      if (longitude !== undefined) {
        const lngNum = Number(longitude);
        if (!Number.isNaN(lngNum)) data.longitude = lngNum;
      }
  
  
      // Обновление пользователя
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
          // новые поля тоже возвращаем
          role: true,
          specialization: true,
          pricePerHour: true,
          portfolioVideos: true
        }
      });
  
      res.json({ user });
    } catch (e) {
      console.error('PATCH /api/users/me', e);
      res.status(400).json({ error: 'Update failed' });
    }
  });
  

// ===== GET PUBLIC PROFILE =====
app.get('/api/users/:username', async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { username: req.params.username },
        select: {
          id: true,
          username: true,
          email: true,
          avatarUrl: true,
          bio: true,
          location: true,
          links: true,
          followers: true,
          following: true,
          createdAt: true,
  
          // 👇 добавляем новые поля профиля провайдера
          role: true,
          specialization: true,
          pricePerHour: true,
          portfolioVideos: true
        }
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to load profile' });
    }
  });
  
/* ------------------ PEOPLE --------------------- */
app.get('/api/users', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim()
    const limitRaw = parseInt(String(req.query.limit || ''), 10)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20
    const cursorParam = req.query.cursor
    const cursorId = cursorParam !== undefined ? Number(cursorParam) : undefined

    // узнаем meId (если авторизованы)
    const authHeader = req.headers.authorization || ''
    let meId = null
    if (authHeader.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET)
        meId = payload.sub
      } catch {}
    }

    const where = {
      AND: [
        meId ? { NOT: { id: meId } } : {},
        q ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ]
        } : {}
      ]
    }

    // cursor по id → сортируем по id
    const users = await prisma.user.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit,
      ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
      select: {
        id: true, username: true, email: true, avatarUrl: true,
        followers: true, following: true
      }
    })
    const nextCursor = users.length === limit ? users[users.length - 1].id : null

    // помечаем, на кого уже подписан текущий пользователь
    let followingMap = {}
    if (meId && users.length) {
      const ids = users.map(u => u.id)
      const rels = await prisma.follow.findMany({
        where: { followerId: meId, followingId: { in: ids } },
        select: { followingId: true }
      })
      for (const r of rels) followingMap[r.followingId] = true
    }

    const items = users.map(u => ({ ...u, isFollowing: !!followingMap[u.id] }))
    res.json({ users: items, nextCursor })
  } catch (e) {
    console.error('GET /api/users error:', e)
    res.status(500).json({ error: 'server error' })
  }
})


app.get('/api/providers/map', async (req, res) => {
    try {
      const providers = await prisma.user.findMany({
        where: {
          role: { in: ['VIDEOGRAPHER', 'PHOTOGRAPHER'] },
          latitude:  { not: null },
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
      })
  
      res.json({
        providers: providers.map((p) => ({
          id: p.id,
          username: p.username ?? `user${p.id}`,
          location: p.location,
          lat: p.latitude,          // используем поля из Prisma
          lng: p.longitude,
          specializations: p.specialization ?? [],
        })),
      })
    } catch (e) {
      console.error('GET /api/providers/map', e)
      res.status(500).json({ error: 'Failed to load providers' })
    }
  })
  
  

/* ---------------- AVATAR UPLOAD ---------------- */
app.post('/api/users/me/avatar', auth, uploadAvatar.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' })
    const publicUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`
    await prisma.user.update({ where: { id: req.userId }, data: { avatarUrl: publicUrl } })
    res.json({ url: publicUrl })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Upload failed' })
  }
})

/* ---------------- FOLLOW / UNFOLLOW ------------ */
app.post('/api/follow/:userId', auth, async (req, res) => {
  try {
    const targetId = Number(req.params.userId)
    const me = req.userId
    if (!targetId || Number.isNaN(targetId)) return res.status(400).json({ error: 'Invalid user id' })
    if (me === targetId) return res.status(400).json({ error: 'Нельзя подписаться на себя' })

    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } })
    if (!target) return res.status(404).json({ error: 'User not found' })

    try {
      await prisma.$transaction([
        prisma.follow.create({ data: { followerId: me, followingId: targetId } }),
        prisma.user.update({ where: { id: me }, data: { following: { increment: 1 } } }),
        prisma.user.update({ where: { id: targetId }, data: { followers: { increment: 1 } } }),
      ])
    } catch {
      return res.status(409).json({ error: 'Уже подписаны' })
    }
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'server error' })
  }
})

app.delete('/api/follow/:userId', auth, async (req, res) => {
  try {
    const targetId = Number(req.params.userId)
    const me = req.userId
    if (!targetId || Number.isNaN(targetId)) return res.status(400).json({ error: 'Invalid user id' })
    if (me === targetId) return res.status(400).json({ error: 'Нельзя отписаться от себя' })

    const deleted = await prisma.follow.deleteMany({ where: { followerId: me, followingId: targetId } })
    if (deleted.count > 0) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: me }, data: { following: { decrement: 1 } } }),
        prisma.user.update({ where: { id: targetId }, data: { followers: { decrement: 1 } } }),
      ])
    }
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'server error' })
  }
})

app.get('/api/follow/status/:userId', auth, async (req, res) => {
  try {
    const targetId = Number(req.params.userId)
    const me = req.userId
    if (!targetId || Number.isNaN(targetId)) return res.status(400).json({ error: 'Invalid user id' })
    if (me === targetId) return res.json({ following: false })
    const rel = await prisma.follow.findFirst({ where: { followerId: me, followingId: targetId }, select: { id: true } })
    res.json({ following: !!rel })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'server error' })
  }
})

/* -------------------- POSTS -------------------- */
// создать пост с изображением
app.post('/api/posts', auth, uploadPost.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' })
    const { caption = '', location = '' } = req.body
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/posts/${req.file.filename}`

    const post = await prisma.post.create({
      data: { authorId: req.userId, imageUrl, caption, location },
      select: { id: true, imageUrl: true, caption: true, location: true, createdAt: true }
    })
    res.status(201).json({ post })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Create post failed' })
  }
})

// посты пользователя (для страницы профиля)
app.get('/api/users/:username/posts', async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: { id: true }
  })
  if (!u) return res.status(404).json({ error: 'User not found' })

  const posts = await prisma.post.findMany({
    where: { authorId: u.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, imageUrl: true, caption: true, location: true, createdAt: true }
  })
  res.json({ posts })
})



// =====================
// LIKES
// =====================

// toggle like/unlike
app.post("/api/posts/:id/like", auth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!postId || Number.isNaN(postId)) return res.status(400).json({ error: "Invalid post id" });

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const existing = await prisma.like.findUnique({
      where: { userId_postId: { userId: req.userId, postId } }
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


// =====================
// COMMENTS
// =====================

// list comments for post
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
        author: { select: { id: true, username: true, avatarUrl: true } }
      }
    });

    res.json({ comments });
  } catch (e) {
    console.error("GET /api/posts/:id/comments", e);
    res.status(500).json({ error: "Failed to load comments" });
  }
});



// add comment
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
        author: { select: { id: true, username: true, avatarUrl: true } }
      }
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





// ===== BOOKINGS =====

app.post('/api/bookings', auth, async (req, res) => {
    try {
      const { videographerId, date, start, end, note } = req.body;
  
      if (!videographerId) {
        return res.status(400).json({ error: 'videographerId обязателен' });
      }
      if (Number(videographerId) === Number(req.userId)) {
        return res.status(400).json({ error: 'Nie możesz zarezerwować siebie' });
      }
      const provider = await prisma.user.findUnique({
        where: { id: Number(videographerId) },
        select: { id: true, role: true }
      });
      if (!provider || (provider.role !== 'VIDEOGRAPHER' && provider.role !== 'PHOTOGRAPHER')) {
        return res.status(400).json({ error: 'Użytkownik nie przyjmuje rezerwacji' });
      }
      // ----- CZAS -----
      const from = start ? new Date(start) : (date ? new Date(date) : null);
      const to   = end   ? new Date(end)   : (from ? new Date(from.getTime() + 60*60*1000) : null);
  
      if (!from || !to) return res.status(400).json({ error: 'podaj start/end lub date' });
      if (!(from < to))  return res.status(400).json({ error: 'Nieprawidłowy interwałv' });
      if (from < new Date()) return res.status(400).json({ error: 'Nie można dokonać rezerwacji w przeszłości ' });
      const durationMinutes = Math.max(1, Math.round((to.getTime() - from.getTime())/60000));
      const busy = await prisma.unavailability.findFirst({
        where: {
          providerId: Number(videographerId),
          startsAt: { lt: to },
          endsAt:   { gt: from }
        },
        select: { id: true }
      });
      if (busy) return res.status(400).json({ error: ' Ten przedział jest zajęty przez uslugodawce' });
  
      const windowStart = new Date(from.getTime() - 8*60*60*1000); 
      const conflicts = await prisma.booking.findMany({
        where: {
          videographerId: Number(videographerId),
          status: { in: ['pending','confirmed'] },
          date: { gt: windowStart, lt: new Date(to.getTime() + 8*60*60*1000) }
        },
        select: { id: true, date: true, durationMinutes: true }
      });
  
      const overlap = conflicts.some(b => {
        const bStart = new Date(b.date);
        const bEnd   = new Date(bStart.getTime() + (b.durationMinutes ?? 60) * 60000);
        return (bStart < to && bEnd > from);
      });
      if (overlap) return res.status(400).json({ error: ' Ten termin jest już zarezerwowany ' });
  
      const booking = await prisma.booking.create({
        data: {
          clientId: req.userId,
          videographerId: Number(videographerId),
          date: from,
          note: note || '',
          status: 'pending',
          ...(typeof durationMinutes === 'number' ? { durationMinutes } : {})
        },
        select: { id: true, status: true, date: true, durationMinutes: true }
      });
  
      res.status(201).json({ booking });
    } catch (e) {
      console.error('POST /api/bookings', e);
      res.status(500).json({ error: ' utworzenie rezerwacji nie poszlo ' });
    }
  });  
  
  
  // Список моих бронирований как клиента
  app.get('/api/bookings/my', auth, async (req, res) => {
    const list = await prisma.booking.findMany({
      where: { clientId: req.userId },
      orderBy: { date: 'desc' },
      select: {
        id: true, date: true, status: true, note: true,
        durationMinutes: true,
        videographer: { select: { id: true, username: true, avatarUrl: true, role: true } },
        review: { select: { id: true, rating: true } } // 👈 добавили
      }      
    });
    res.json({ bookings: list });
  });
  
  

  app.get('/api/bookings/to-me', auth, async (req, res) => {
    const list = await prisma.booking.findMany({
      where: { videographerId: req.userId },
      orderBy: { date: 'asc' },
      select: {
        id: true, date: true, status: true, note: true,
        durationMinutes: true,                
        client: { select: { id: true, username: true, avatarUrl: true } }
      }      
    });
    res.json({ bookings: list });
  });
  
  
  // Подтвердить/отклонить/отменить
  // server/index.js
app.patch("/api/bookings/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { action } = req.body;
  
      if (!["confirm", "decline", "done"].includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }
  
     
      const booking = await prisma.booking.findUnique({ where: { id } });

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
  
      let newStatus = booking.status;
      if (action === "confirm") newStatus = "confirmed";
      if (action === "decline") newStatus = "declined";
      if (action === "done") newStatus = "done";
  
      const updated = await prisma.booking.update({
        where: { id },
        data: { status: newStatus },
      });
  
      return res.json({ booking: updated });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/reviews", auth, async (req, res) => {
    try {
      const { bookingId, rating, text } = req.body;
      const r = Number(rating);
  
      if (!bookingId) return res.status(400).json({ error: "bookingId required" });
      if (!Number.isFinite(r) || r < 1 || r > 5) return res.status(400).json({ error: "rating must be 1..5" });
  
      const booking = await prisma.booking.findUnique({
        where: { id: Number(bookingId) },
        select: { id: true, clientId: true, videographerId: true, status: true }
      });
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.clientId !== req.userId) return res.status(403).json({ error: "Not your booking" });
      if (booking.status !== "done") return res.status(400).json({ error: "Booking is not done yet" });
  
      // запрет повторного отзыва
      const exists = await prisma.review.findUnique({ where: { bookingId: booking.id } });
      if (exists) return res.status(409).json({ error: "Review already exists" });
  
      const review = await prisma.review.create({
        data: {
          bookingId: booking.id,
          providerId: booking.videographerId,
          clientId: booking.clientId,
          rating: r,
          text: typeof text === "string" ? text : ""
        },
        select: {
          id: true, rating: true, text: true, createdAt: true,
          client: { select: { id: true, username: true, avatarUrl: true } }
        }
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
        select: { id: true, username: true }
      });
      if (!u) return res.status(404).json({ error: "User not found" });
  
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
          bookingId: true,
        }
      });
  
      const agg = await prisma.review.aggregate({
        where: { providerId: u.id },
        _avg: { rating: true },
        _count: { rating: true }
      });
  
      res.json({
        avgRating: agg._avg.rating || 0,
        count: agg._count.rating || 0,
        reviews
      });
    } catch (e) {
      console.error("GET reviews", e);
      res.status(500).json({ error: "Failed to load reviews" });
    }
  });
  
  app.get("/api/reviews/pending", auth, async (req, res) => {
    try {
      // done bookings where no review exists
      const list = await prisma.booking.findMany({
        where: { clientId: req.userId, status: "done" },
        select: { id: true }
      });
  
      const ids = list.map(b => b.id);
      if (!ids.length) return res.json({ count: 0 });
  
      const reviewed = await prisma.review.findMany({
        where: { bookingId: { in: ids } },
        select: { bookingId: true }
      });
  
      const reviewedSet = new Set(reviewed.map(x => x.bookingId));
      const pending = ids.filter(id => !reviewedSet.has(id)).length;
  
      res.json({ count: pending });
    } catch (e) {
      console.error("GET /api/reviews/pending", e);
      res.status(500).json({ error: "Failed" });
    }
  });
  
  

  
  
  // ------ BOOKING по слоту ------
// ------ BOOKING по слоту ------
app.post('/api/bookings/by-slot', auth, async (req, res) => {
    try {
      const { slotId, note } = req.body;
      const slot = await prisma.availability.findUnique({
        where: { id: Number(slotId) }
      });
      if (!slot || slot.isBooked) {
        return res.status(400).json({ error: 'Slot unavailable' });
      }
      if (slot.providerId === req.userId) {
        return res.status(400).json({ error: 'Нельзя бронировать у себя' });
      }
  
      // длительность слота в минутах
      const durationMinutes = Math.max(
        1,
        Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60000)
      );
  
      // Проверка конфликтов на всякий случай (повторяем логику из POST /api/bookings)
      const from = slot.startsAt;
      const to   = slot.endsAt;
  
      const busy = await prisma.unavailability.findFirst({
        where: {
          providerId: slot.providerId,
          startsAt: { lt: to },
          endsAt:   { gt: from }
        },
        select: { id: true }
      });
      if (busy) return res.status(400).json({ error: 'Этот интервал занят провайдером' });
  
      const windowStart = new Date(from.getTime() - 8*60*60*1000);
      const conflicts = await prisma.booking.findMany({
        where: {
          videographerId: slot.providerId,
          status: { in: ['pending','confirmed'] },
          date: { gt: windowStart, lt: new Date(to.getTime() + 8*60*60*1000) }
        },
        select: { id: true, date: true, durationMinutes: true }
      });
      const overlap = conflicts.some(b => {
        const bStart = new Date(b.date);
        const bEnd   = new Date(bStart.getTime() + (b.durationMinutes ?? 60) * 60000);
        return (bStart < to && bEnd > from);
      });
      if (overlap) return res.status(400).json({ error: 'Это время уже забронировано' });
  
      const booking = await prisma.booking.create({
        data: {
          clientId: req.userId,
          videographerId: slot.providerId,
          date: slot.startsAt,
          durationMinutes,
          note: note || '',
          status: 'pending'
        },
        select: { id: true, status: true, date: true, durationMinutes: true }
      });
  
      await prisma.availability.update({
        where: { id: slot.id },
        data: { isBooked: true }
      });
  
      res.status(201).json({ booking });
    } catch (e) {
      console.error('POST /api/bookings/by-slot', e);
      res.status(500).json({ error: 'Booking failed' });
    }
  });
  




// ===== FEED: мои посты + посты тех, на кого я подписан =====
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

        likes: {
          where: { userId: req.userId },
          select: { id: true },
          take: 1,
        },

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
      lastComments: [...p.comments].reverse(), // чтобы показывать по времени (старые→новые)
    }));

    const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null;
    res.json({ posts: shaped, nextCursor });
  } catch (e) {
    console.error("GET /api/feed error:", e);
    res.status(500).json({ error: "server error" });
  }
});




  // ------ AVAILABILITY (для провайдеров) ------

// Создать слот (только провайдер)
app.post('/api/availability', auth, async (req, res) => {
    try {
      const me = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true }
      });
      if (!me || (me.role !== 'VIDEOGRAPHER' && me.role !== 'PHOTOGRAPHER')) {
        return res.status(403).json({ error: 'Only providers can create availability' });
      }
  
      const { startsAt, endsAt } = req.body;
      if (!startsAt || !endsAt) {
        return res.status(400).json({ error: 'startsAt и endsAt обязательны' });
      }
  
      const s = new Date(startsAt);
      const e = new Date(endsAt);
      if (!(s < e)) return res.status(400).json({ error: 'Некорректный интервал' });
  
      const slot = await prisma.availability.create({
        data: { providerId: req.userId, startsAt: s, endsAt: e },
        select: { id: true, startsAt: true, endsAt: true, isBooked: true }
      });
      res.status(201).json({ slot });
    } catch (e) {
      console.error('POST /api/availability', e);
      res.status(500).json({ error: 'Create slot failed' });
    }
  });
  
  // Удалить свой слот (если не забронирован)
  app.delete('/api/availability/:id', auth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const slot = await prisma.availability.findUnique({ where: { id } });
      if (!slot || slot.providerId !== req.userId) {
        return res.status(404).json({ error: 'Not found' });
      }
      if (slot.isBooked) {
        return res.status(400).json({ error: 'Slot already booked' });
      }
  
      await prisma.availability.delete({ where: { id } });
      res.json({ ok: true });
    } catch (e) {
      console.error('DELETE /api/availability/:id', e);
      res.status(500).json({ error: 'Delete slot failed' });
    }
  });
  
  // Публично: свободные слоты провайдера по username
  app.get('/api/providers/:username/availability', async (req, res) => {
    try {
      const u = await prisma.user.findUnique({
        where: { username: req.params.username },
        select: { id: true, role: true }
      });
      if (!u) return res.status(404).json({ error: 'User not found' });
      if (u.role !== 'VIDEOGRAPHER' && u.role !== 'PHOTOGRAPHER') {
        return res.json({ slots: [] });
      }
  
      const slots = await prisma.availability.findMany({
        where: { providerId: u.id, isBooked: false, startsAt: { gt: new Date() } },
        orderBy: { startsAt: 'asc' },
        select: { id: true, startsAt: true, endsAt: true, isBooked: true }
      });
      res.json({ slots });
    } catch (e) {
      console.error('GET /api/providers/:username/availability', e);
      res.status(500).json({ error: 'Load slots failed' });
    }
  });


  // провайдер помечает "занято"
app.post('/api/unavailability', auth, async (req, res) => {
    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
    if (!me || (me.role !== 'VIDEOGRAPHER' && me.role !== 'PHOTOGRAPHER')) {
      return res.status(403).json({ error: 'Only providers can mark busy' });
    }
    const { startsAt, endsAt } = req.body;
    if (!startsAt || !endsAt) return res.status(400).json({ error: 'startsAt/endsAt required' });
  
    const s = new Date(startsAt), e = new Date(endsAt);
    if (!(s < e)) return res.status(400).json({ error: 'Invalid interval' });
  
    const item = await prisma.unavailability.create({
      data: { providerId: req.userId, startsAt: s, endsAt: e },
      select: { id: true, startsAt: true, endsAt: true }
    });
    res.status(201).json({ item });
  });
  
  // удалить свою занятость
  app.delete('/api/unavailability/:id', auth, async (req, res) => {
    const id = Number(req.params.id);
    const item = await prisma.unavailability.findUnique({ where: { id } });
    if (!item || item.providerId !== req.userId) return res.status(404).json({ error: 'Not found' });
    await prisma.unavailability.delete({ where: { id } });
    res.json({ ok: true });
  });
  
  // публичный календарь провайдера (занято + брони)

// публичный календарь провайдера (занято + брони)
app.get('/api/providers/:username/calendar', async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, role: true }
    });
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (u.role !== 'VIDEOGRAPHER' && u.role !== 'PHOTOGRAPHER') {
      return res.json({ busy: [], bookings: [] });
    }
  
    const busy = await prisma.unavailability.findMany({
      where: { providerId: u.id, endsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, endsAt: true }
    });
  
    const bookings = await prisma.booking.findMany({
      where: { videographerId: u.id, date: { gt: new Date() } },
      orderBy: { date: 'asc' },
      // ▼ ДОБАВИЛИ durationMinutes
      select: { id: true, date: true, status: true, durationMinutes: true }
    });
  
    res.json({ busy, bookings });
  });
  
  
  
  // получить id провайдера по username (для брони)
  app.get('/api/provider-id/:username', async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, role: true }
    });
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (u.role !== 'VIDEOGRAPHER' && u.role !== 'PHOTOGRAPHER') {
      return res.status(400).json({ error: 'Not a provider' });
    }
    res.json({ id: u.id });
  });
  

  /* ------------------- START --------------------- */
const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`API listening on ${PORT}`))
