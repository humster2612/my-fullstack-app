import { useEffect, useMemo, useState } from "react";
import { getMe, getProviderUnavailability, createUnavailability, deleteUnavailability } from "../api";
import CalendarGrid from "./CalendarGrid";

export default function ProviderSchedulePage() {
  const [me, setMe] = useState<{username?:string}|null>(null);
  const [busy, setBusy] = useState<{id:number;startsAt:string;endsAt:string}[]|null>(null);
  const [bookings, setBookings] = useState<{id:number;date:string;status:string}[]|null>(null);
  const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  const [err, setErr] = useState<string|null>(null);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); const day = (d.getDay()+6)%7; d.setHours(0,0,0,0); d.setDate(d.getDate()-day); return d;
  });

  useEffect(() => { (async () => {
    try {
      const m = await getMe(); setMe(m.user ?? null);
      if (m.user?.username) {
        const cal = await getProviderUnavailability(m.user.username);
        setBusy(cal.busy); setBookings(cal.bookings);
      }
    } catch { setErr("Failed to load schedule"); }
  })(); }, []);

  const items = useMemo(() => {
    const list: any[] = [];
    if (busy) busy.forEach(b=>list.push({type:"busy", id:b.id, from:new Date(b.startsAt), to:new Date(b.endsAt)}));
    if (bookings) bookings.forEach(b=>list.push({type:"booking", id:b.id, from:new Date(b.date), status:b.status}));
    return list.sort((a,b)=>a.from.getTime()-b.from.getTime());
  }, [busy, bookings]);

  async function onAddBusy(e:React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (!start || !end) { setErr("Заполни от и до"); return; }
    try {
      const res = await createUnavailability(new Date(start).toISOString(), new Date(end).toISOString());
      setBusy(p => p ? [...p, res.item] : [res.item]); setStart(""); setEnd("");
    } catch (e:any) { setErr(e?.response?.data?.error || "Не удалось добавить"); }
  }
  async function onDelBusy(id:number){ await deleteUnavailability(id); setBusy(p=>p? p.filter(x=>x.id!==id):p); }

  return (
    <div style={{display:"grid", gap:16}}>
      <h2>My schedule</h2>

      <div style={{display:"flex", gap:8, alignItems:"center"}}>
        <button onClick={()=>{const d=new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d)}}>← Prev</button>
        <div style={{opacity:.8}}>
          {new Date(weekStart).toLocaleDateString()} — {new Date(weekStart.getTime()+6*86400000).toLocaleDateString()}
        </div>
        <button onClick={()=>{const d=new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d)}}>Next →</button>
      </div>

      <form onSubmit={onAddBusy} style={{display:"grid", gap:8, maxWidth:420}}>
        <h3>+ Mark busy</h3>
        <label>From <input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} /></label>
        <label>To   <input type="datetime-local" value={end}   onChange={e=>setEnd(e.target.value)} /></label>
        <button>Save</button>
      </form>
      {err && <div style={{color:"crimson"}}>{err}</div>}

      <CalendarGrid weekStart={weekStart} items={items} onRemoveBusy={onDelBusy} />
    </div>
  );
}
