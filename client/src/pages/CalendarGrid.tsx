// client/src/components/CalendarGrid.tsx
import React from "react";

export type GridItem = {
  type: "busy" | "booking";
  id?: number;
  from: Date;
  to: Date;
  status?: string;
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 08–19

function getBookingColor(status?: string) {
  switch (status) {
    case "confirmed":
      return "#2e7d32"; // зелёный
    case "pending":
      return "#5b458a"; // фиолетовый
    case "declined":
    case "cancelled":
    case "canceled":
      return "#555555"; // серый
    case "done":
      return "#1976d2"; // синий
    default:
      return "#5b458a";
  }
}

export default function CalendarGrid({
  weekStart,
  items,
  onRemoveBusy,
}: {
  weekStart: Date;
  items: GridItem[];
  onRemoveBusy?: (id: number) => void;
}) {
  const weekDays = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px repeat(7, 1fr)",
        border: "1px solid #333",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* header пустой слева */}
      <div style={{ background: "#151515" }} />
      {weekDays.map((d) => (
        <div
          key={d.toDateString()}
          style={{ padding: 8, background: "#151515", textAlign: "center" }}
        >
          <b>{d.toLocaleDateString(undefined, { weekday: "short" })}</b>
          <br />
          {d.getDate()}
        </div>
      ))}

      {HOURS.map((h) => (
        <div key={`row-${h}`} style={{ display: "contents" }}>
          <div style={{ padding: 8, borderTop: "1px solid #333" }}>{h}:00</div>
          {weekDays.map((d, i) => (
            <HourCell
              key={`${h}-${i}`}
              day={d}
              hour={h}
              items={items}
              onRemoveBusy={onRemoveBusy}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function HourCell({
  day,
  hour,
  items,
  onRemoveBusy,
}: {
  day: Date;
  hour: number;
  items: GridItem[];
  onRemoveBusy?: (id: number) => void;
}) {
  const cellStart = new Date(day);
  cellStart.setHours(hour, 0, 0, 0);
  const cellEnd = new Date(day);
  cellEnd.setHours(hour + 1, 0, 0, 0);

  const inCell = items.filter(
    (it) => it.from < cellEnd && it.to > cellStart
  );

  return (
    <div
      style={{
        borderTop: "1px solid #333",
        borderLeft: "1px solid #333",
        minHeight: 48,
        padding: 4,
      }}
    >
      {inCell.map((it, idx) => {
        const isBusy = it.type === "busy";
        const bg = isBusy ? "#444444" : getBookingColor(it.status);
        const faded =
          !isBusy &&
          (it.status === "declined" ||
            it.status === "cancelled" ||
            it.status === "canceled");

        return (
          <span
            key={idx}
            style={{
              fontSize: 12,
              padding: "2px 6px",
              borderRadius: 8,
              background: bg,
              display: "inline-block",
              marginRight: 4,
              opacity: faded ? 0.5 : 1,
            }}
          >
            {isBusy ? "busy " : `${it.status} `}
            {it.from.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–
            {it.to.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}

            {isBusy && typeof it.id === "number" && onRemoveBusy && (
              <button
                style={{ marginLeft: 6 }}
                onClick={() => onRemoveBusy(it.id!)}
              >
                ×
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
