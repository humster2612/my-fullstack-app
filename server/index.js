import express from 'express'
import cors from 'cors'
import 'dotenv/config'

const app = express()
app.use(express.json())

// Разрешаем CORS с прод-домена фронта (подставишь позже)
// Локально Vite-прокси обойдёт CORS.
const allowedOrigin = process.env.CLIENT_ORIGIN
app.use(cors({
  origin: allowedOrigin ? [allowedOrigin] : true,
  credentials: true
}))

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Привет с backend 👋' })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`API listening on ${PORT}`))
