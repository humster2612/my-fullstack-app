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
    res.json({ token, user: { id: user.id, email: user.email, username: user.username } })
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
        portfolioVideos
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
  
      // --- Новые поля для видеографов/фотографов ---
      if (role && ['CLIENT', 'VIDEOGRAPHER', 'PHOTOGRAPHER'].includes(role))
        data.role = role;
      if (Array.isArray(specialization))
        data.specialization = specialization.map(String);
      if (pricePerHour !== undefined)
        data.pricePerHour = Number.isFinite(+pricePerHour)
          ? +pricePerHour
          : null;
      if (Array.isArray(portfolioVideos))
        data.portfolioVideos = portfolioVideos.map(String);
  
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




// ===== BOOKINGS =====

// Создать запрос брони к видеографу/фотографу
app.post('/api/bookings', auth, async (req, res) => {
    try {
      const { videographerId, date, note } = req.body;
      if (!videographerId || !date) return res.status(400).json({ error: 'videographerId и date обязательны' });
  
      // нельзя бронировать самому себя
      if (Number(videographerId) === Number(req.userId)) {
        return res.status(400).json({ error: 'Нельзя бронировать себя' });
      }
  
      // проверим, что целевой пользователь — провайдер
      const provider = await prisma.user.findUnique({ where: { id: Number(videographerId) }, select: { id: true, role: true } });
      if (!provider || (provider.role !== 'VIDEOGRAPHER' && provider.role !== 'PHOTOGRAPHER')) {
        return res.status(400).json({ error: 'Пользователь не принимает брони' });
      }
  
      const booking = await prisma.booking.create({
        data: {
          clientId: req.userId,
          videographerId: Number(videographerId),
          date: new Date(date),
          note: note || null
        }
      });
      res.status(201).json({ booking });
    } catch (e) {
      console.error('POST /api/bookings', e);
      res.status(500).json({ error: 'create booking failed' });
    }
  });
  
  // Список моих бронирований как клиента
  app.get('/api/bookings/my', auth, async (req, res) => {
    const list = await prisma.booking.findMany({
      where: { clientId: req.userId },
      orderBy: { date: 'desc' },
      select: {
        id: true, date: true, status: true, note: true,
        videographer: { select: { id: true, username: true, avatarUrl: true, role: true } }
      }
    });
    res.json({ bookings: list });
  });
  
  // Список запросов ко мне как к провайдеру
  app.get('/api/bookings/to-me', auth, async (req, res) => {
    const list = await prisma.booking.findMany({
      where: { videographerId: req.userId },
      orderBy: { date: 'asc' },
      select: {
        id: true, date: true, status: true, note: true,
        client: { select: { id: true, username: true, avatarUrl: true } }
      }
    });
    res.json({ bookings: list });
  });
  
  // Подтвердить/отклонить/отменить
  app.patch('/api/bookings/:id', auth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { action } = req.body; // confirm | decline | cancel | done
  
      const b = await prisma.booking.findUnique({ where: { id }, select: { videographerId: true, clientId: true, status: true } });
      if (!b) return res.status(404).json({ error: 'Not found' });
  
      // правила: подтверждать/отклонять может только провайдер; cancel — клиент; done — провайдер
      const me = Number(req.userId);
      let next = b.status;
  
      if (action === 'confirm' && me === b.videographerId) next = 'confirmed';
      else if (action === 'decline' && me === b.videographerId) next = 'declined';
      else if (action === 'cancel' && me === b.clientId) next = 'cancelled';
      else if (action === 'done' && me === b.videographerId) next = 'done';
      else return res.status(403).json({ error: 'not allowed' });
  
      const updated = await prisma.booking.update({ where: { id }, data: { status: next } });
      res.json({ booking: updated });
    } catch (e) {
      console.error('PATCH /api/bookings/:id', e);
      res.status(500).json({ error: 'update failed' });
    }
  });
  

/* ------------------- START --------------------- */
const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`API listening on ${PORT}`))



// ===== FEED: мои посты + посты тех, на кого я подписан =====
app.get('/api/feed', auth, async (req, res) => {
    try {
      const limitRaw = parseInt(String(req.query.limit || ''), 10)
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : 10
      const cursorParam = req.query.cursor
      const cursorId = cursorParam !== undefined ? Number(cursorParam) : undefined
  
      // кого читаем: я + те, на кого подписан
      const rels = await prisma.follow.findMany({
        where: { followerId: req.userId },
        select: { followingId: true }
      })
      const authorIds = [req.userId, ...rels.map(r => r.followingId)]
  
      const posts = await prisma.post.findMany({
        where: { authorId: { in: authorIds } },
        orderBy: { id: 'desc' },                 // пагинация по id
        take: limit,
        ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
        select: {
          id: true, imageUrl: true, caption: true, location: true, createdAt: true,
          author: { select: { id: true, username: true, avatarUrl: true } }
        }
      })
  
      const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null
      res.json({ posts, nextCursor })
    } catch (e) {
      console.error('GET /api/feed error:', e)
      res.status(500).json({ error: 'server error' })
    }
  })
  