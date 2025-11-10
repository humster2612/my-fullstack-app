// client/src/components/CalendarGrid.tsx
import { useMemo } from "react";

type Item =
  | { type: "busy"; id?: number; from: Date; to: Date }
  | { type: "booking"; id?: number; from: Date; status: string };

export default function CalendarGrid({
  weekStart,
  items,
  onRemoveBusy,
  readOnly = false,
}: {
  weekStart: Date;
  items: Item[];
  onRemoveBusy?: (id: number) => void;
  readOnly?: boolean;
}) {
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );

  // показываем 8:00–20:00
  const hours = Array.from({ length: 12 }, (_, i) => i + 8);

  // группируем элементы по ячейкам «день+час» для простого отображения
  function inHourCell(it: Item, day: Date, hour: number) {
    const cellStart = new Date(day); cellStart.setHours(hour, 0, 0, 0);
    const cellEnd   = new Date(day); cellEnd.setHours(hour + 1, 0, 0, 0);
    const from = it.from;
    const to = it.type === "busy" ? it.to : new Date(it.from.getTime() + 60 * 60 * 1000);
    return from < cellEnd && to > cellStart;
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "120px repeat(7, 1fr)",
      border: "1px solid #333", borderRadius: 12, overflow: "hidden"
    }}>
      {/* header */}
      <div style={{ background: "#151515" }} />
      {weekDays.map((d) => (
        <div key={d.toDateString()} style={{ padding: 8, background: "#151515", textAlign: "center" }}>
          <b>{d.toLocaleDateString(undefined, { weekday: "short" })}</b><br />{d.getDate()}
        </div>
      ))}

      {hours.map((h) => (
        <>
          <div key={`h-${h}`} style={{ padding: 8, borderTop: "1px solid #333" }}>{h}:00</div>
          {weekDays.map((d, i) => (
            <div key={`${h}-${i}`} style={{ borderTop: "1px solid #333", borderLeft: "1px solid #333", minHeight: 48, padding: 4 }}>
              {items.filter(it => inHourCell(it, d, h)).map((it, idx) => (
                <span key={idx} style={{
                  fontSize: 12, padding: "2px 6px", borderRadius: 8,
                  background: it.type === "busy" ? "#444" : "#6b46c1",
                  display: "inline-block", marginRight: 4, color: "white"
                }}>
                  {it.from.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {it.type === "busy" ? (
                    <>
                      {"–"}
                      {(it as any).to?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {!readOnly && it.id && onRemoveBusy &&
                        <button onClick={() => onRemoveBusy(it.id!)} style={{ marginLeft: 6 }}>×</button>}
                    </>
                  ) : (
                    <> [{(it as any).status}]</>
                  )}
                </span>
              ))}
            </div>
          ))}
        </>
      ))}
    </div>
  );
}
