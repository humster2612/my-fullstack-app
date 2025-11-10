// import { useEffect, useMemo, useState } from "react";
// import { createAvailability, deleteAvailability, getProviderAvailability } from "../api";

// type Slot = { id:number; startsAt:string; endsAt:string; isBooked:boolean };

// function startOfWeek(d = new Date()) {
//   const x = new Date(d);
//   const day = (x.getDay() + 6) % 7; // Mon=0
//   x.setHours(0,0,0,0);
//   x.setDate(x.getDate() - day);
//   return x;
// }

// function addDays(d: Date, i: number) {
//   const x = new Date(d); x.setDate(x.getDate()+i); return x;
// }

// function fmt(dt: string | Date) {
//   const x = (typeof dt === "string") ? new Date(dt) : dt;
//   return x.toLocaleString();
// }

// export default function SchedulePage() {
//   const [mode, setMode] = useState<"week"|"month">("week");
//   const [weekStart, setWeekStart] = useState<Date>(startOfWeek());
//   const [username, setUsername] = useState<string>(""); // подставим из /me
//   const [slots, setSlots] = useState<Slot[]|null>(null);
//   const [err, setErr] = useState<string|null>(null);

//   // для создания слота
//   const [date, setDate] = useState<string>(""); // yyyy-mm-dd
//   const [from, setFrom] = useState<string>("09:00");
//   const [to, setTo] = useState<string>("10:00");
//   const [creating, setCreating] = useState(false);

//   // загрузим username из /me, а затем слоты
//   useEffect(() => {
//     (async () => {
//       try {
//         const meRes = await (await fetch("/api/users/me", {
//           headers: { Authorization: `Bearer ${localStorage.getItem("token")||""}` }
//         })).json();
//         setUsername(meRes?.user?.username || "");
//       } catch {}
//     })();
//   }, []);

//   useEffect(() => {
//     if (!username) return;
//     getProviderAvailability(username)
//       .then(d => setSlots(d.slots))
//       .catch(()=> setSlots([]));
//   }, [username, weekStart, mode]);

//   const weekDays = useMemo(
//     () => Array.from({length:7}, (_,i) => addDays(weekStart, i)),
//     [weekStart]
//   );

//   async function onCreate(e: React.FormEvent) {
//     e.preventDefault();
//     if (!date || !from || !to) return;
//     setErr(null); setCreating(true);
//     try {
//       const startsAt = new Date(`${date}T${from}:00`);
//       const endsAt   = new Date(`${date}T${to}:00`);
//       const { slot } = await createAvailability(startsAt.toISOString(), endsAt.toISOString());
//       setSlots(s => s ? [...s, slot].sort((a,b)=>+new Date(a.startsAt)-+new Date(b.startsAt)) : [slot]);
//     } catch (e:any) {
//       setErr(e?.response?.data?.error || "Create failed");
//     } finally {
//       setCreating(false);
//     }
//   }

//   async function removeSlot(id:number) {
//     setErr(null);
//     try {
//       await deleteAvailability(id);
//       setSlots(s => s ? s.filter(x=>x.id!==id) : s);
//     } catch (e:any) {
//       setErr(e?.response?.data?.error || "Delete failed");
//     }
//   }

//   return (
//     <div style={{display:"grid", gap:16}}>
//       <h2>My schedule</h2>

//       <div style={{display:"flex", gap:8, alignItems:"center"}}>
//         <button onClick={()=>setMode("week")} disabled={mode==="week"}>Week</button>
//         <button onClick={()=>setMode("month")} disabled={mode==="month"}>Month</button>
//         <div style={{marginLeft:"auto"}} />
//         {mode==="week" && (
//           <>
//             <button onClick={()=>setWeekStart(addDays(weekStart,-7))}>← Prev week</button>
//             <div style={{opacity:.8}}>
//               {weekDays[0].toLocaleDateString()} – {weekDays[6].toLocaleDateString()}
//             </div>
//             <button onClick={()=>setWeekStart(addDays(weekStart,7))}>Next week →</button>
//           </>
//         )}
//       </div>

//       {/* Форма создания слота */}
//       <form onSubmit={onCreate} style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"center"}}>
//         <label>Day <input type="date" value={date} onChange={e=>setDate(e.target.value)} required /></label>
//         <label>From <input type="time" value={from} onChange={e=>setFrom(e.target.value)} required /></label>
//         <label>To <input type="time" value={to} onChange={e=>setTo(e.target.value)} required /></label>
//         <button disabled={creating}>{creating?"Adding...":"Add slot"}</button>
//       </form>

//       {err && <div style={{color:"crimson"}}>{err}</div>}

//       {/* Календарь недели (простая сетка) */}
//       {mode==="week" && (
//         <div style={{
//           display:"grid",
//           gridTemplateColumns:"120px repeat(7, 1fr)",
//           border:"1px solid #333", borderRadius:12, overflow:"hidden"
//         }}>
//           {/* Заголовок дней */}
//           <div style={{background:"#151515"}} />
//           {weekDays.map(d=>(
//             <div key={d.toDateString()} style={{padding:8, background:"#151515", textAlign:"center"}}>
//               <b>{d.toLocaleDateString(undefined,{weekday:"short"})}</b><br/>{d.getDate()}
//             </div>
//           ))}

//           {/* Часы слева + колонки */}
//           {Array.from({length:12},(_,h)=>h+8).map(h=>(
//             <>
//               <div key={`h-${h}`} style={{padding:8, borderTop:"1px solid #333"}}>{h}:00</div>
//               {weekDays.map((d,i)=>(
//                 <DayCell key={`${h}-${i}`} day={d} hour={h} slots={slots||[]} onRemove={removeSlot}/>
//               ))}
//             </>
//           ))}
//         </div>
//       )}

//       {/* Месяц — просто список ближайших слотов */}
//       {mode==="month" && (
//         !slots ? <div>Loading…</div> :
//         slots.length ? (
//           <ul>
//             {slots
//               .sort((a,b)=>+new Date(a.startsAt)-+new Date(b.startsAt))
//               .map(s=>(
//               <li key={s.id} style={{margin:"6px 0"}}>
//                 {fmt(s.startsAt)} – {new Date(s.endsAt).toLocaleTimeString()}
//                 {!s.isBooked && (
//                   <button style={{marginLeft:8}} onClick={()=>removeSlot(s.id)}>Delete</button>
//                 )}
//                 {s.isBooked && <span style={{marginLeft:8, opacity:.8}}>booked</span>}
//               </li>
//             ))}
//           </ul>
//         ) : <div>No slots yet</div>
//       )}
//     </div>
//   );
// }

// function DayCell({day, hour, slots, onRemove}:{day:Date; hour:number; slots:Slot[]; onRemove:(id:number)=>void}) {
//   const cellStart = new Date(day); cellStart.setHours(hour,0,0,0);
//   const cellEnd   = new Date(day); cellEnd.setHours(hour+1,0,0,0);

//   const items = slots.filter(s=>{
//     const a = new Date(s.startsAt), b = new Date(s.endsAt);
//     return (a < cellEnd && b > cellStart); // пересечение с часом
//   });

//   return (
//     <div style={{borderTop:"1px solid #333", borderLeft:"1px solid #333", minHeight:48, padding:4}}>
//       {items.map(s=>(
//         <div key={s.id} style={{
//           fontSize:12, padding:"2px 6px", borderRadius:8,
//           background: s.isBooked ? "#4c2a" : "#2a4c",
//           display:"inline-block", marginRight:4
//         }}>
//           {new Date(s.startsAt).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
//           {"–"}
//           {new Date(s.endsAt).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
//           {!s.isBooked && <button style={{marginLeft:6}} onClick={()=>onRemove(s.id)}>×</button>}
//         </div>
//       ))}
//     </div>
//   );
// }
