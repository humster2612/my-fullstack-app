import { useEffect, useState } from 'react'

export default function App() {
  const [msg, setMsg] = useState('...')
  useEffect(() => {
    // локально пойдёт через Vite proxy → на http://localhost:4000/api/hello
    // В проде используем переменную окружения VITE_API_URL (см. ниже)
    const base = import.meta.env.VITE_API_URL || ''
    fetch(`${base}/api/hello`)
      .then(r => r.json())
      .then(d => setMsg(d.message))
      .catch(() => setMsg('API error'))
  }, [])
  return <div style={{padding: 24}}>
    <h1>Full-Stack React App</h1>
    <p>Ответ API: {msg}</p>
  </div>
}
