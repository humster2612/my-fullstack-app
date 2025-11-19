// client/src/pages/WorldProvidersMap.tsx

import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";

import { getProvidersMap } from "../api";
import type { ProviderMapItem } from "../api";



const geoUrl =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export default function WorldProvidersMap() {
  const [items, setItems] = useState<ProviderMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);

  const [zoom, setZoom] = useState(1.5);
  const [center, setCenter] = useState<[number, number]>([10, 30]); // Европа по центру

  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const data = await getProvidersMap();
        setItems(data.providers || []);
      } catch (e: any) {
        console.error(e);
        setErr("Failed to load map");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hovered = hoverId != null ? items.find((p) => p.id === hoverId) : null;

  return (
    <div
      style={container} // 👈 контейнер на всю ширину экрана
    >
      <div style={headerRow}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 20 }}>
            Explore videographers on the map
          </div>
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            Scroll or press +/− to zoom. Drag map to move. Click pin to open
            profile.
          </div>
        </div>
      </div>

      {/* Zoom buttons */}
      <div style={zoomWrapper}>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(z + 0.5, 8))}
          style={zoomButton}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(z - 0.5, 1))}
          style={zoomButton}
        >
          –
        </button>
      </div>

      {/* MAP */}
      <div style={{ width: "100%", height: 420 }}>
        <ComposableMap
          projection="geoMercator"
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup
            center={center}
            zoom={zoom}
            minZoom={1}
            maxZoom={8}
            // при окончании движения/зумирования сохраняем центр и zoom
            onMoveEnd={(pos: any) => {
              if (pos?.coordinates) {
                setCenter(pos.coordinates as [number, number]);
              }
              if (pos?.zoom) {
                setZoom(pos.zoom as number);
              }
            }}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }: { geographies: any[] }) =>
                geographies.map((geo: any) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#222"
                    stroke="#444"
                    style={{
                      default: { outline: "none" },
                      hover: { fill: "#333", outline: "none" },
                      pressed: { fill: "#333", outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>

            {/* MARKERS */}
            {items.map((p) => (
              <Marker
                key={p.id}
                coordinates={[p.lng, p.lat]}
                onMouseEnter={() => setHoverId(p.id)}
                onMouseLeave={() =>
                  setHoverId((cur) => (cur === p.id ? null : cur))
                }
                onClick={() => navigate(`/profile/${p.username}`)}
              >
                <circle
                  r={7}
                  fill="#ffcc00"
                  stroke="#000"
                  strokeWidth={2}
                  style={{
                    filter: "drop-shadow(0px 0px 4px #ffcc00)",
                    cursor: "pointer",
                  }}
                />
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Tooltip под картой */}
      {hovered && (
        <div style={tooltip}>
          <div style={{ fontWeight: 600 }}>@{hovered.username}</div>
          {hovered.location && (
            <div style={{ opacity: 0.8 }}>{hovered.location}</div>
          )}
          {hovered.specializations?.length ? (
            <div style={{ marginTop: 4, opacity: 0.8 }}>
              {hovered.specializations.join(" • ")}
            </div>
          ) : null}
        </div>
      )}

      {loading && (
        <div style={statusRight}>Loading…</div>
      )}
      {err && (
        <div style={{ ...statusRight, color: "salmon" }}>{err}</div>
      )}
    </div>
  );
}

/* ====== стили ====== */

// контейнер тянется на ширину экрана, даже если родитель уже
const container: CSSProperties = {
  position: "relative",
  width: "100vw",
  marginLeft: "50%",
  transform: "translateX(-50%)", // центрируем относительно экрана
  background: "#000",
  borderRadius: 20,
  padding: 20,
  color: "#fff",
  marginBottom: 40,
  boxSizing: "border-box",
};

const headerRow: CSSProperties = {
  marginBottom: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const zoomWrapper: CSSProperties = {
  position: "absolute",
  left: 24,
  top: 70,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  zIndex: 20,
};

const zoomButton: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  border: "2px solid #444",
  background: "#141414",
  color: "#fff",
  fontSize: 24,
  cursor: "pointer",
  fontWeight: 600,
  lineHeight: "38px",
  textAlign: "center",
};

const tooltip: CSSProperties = {
  marginTop: 10,
  background: "#111",
  padding: "10px 14px",
  borderRadius: 14,
  fontSize: 14,
};

const statusRight: CSSProperties = {
  position: "absolute",
  right: 20,
  top: 22,
  fontSize: 12,
  opacity: 0.7,
};
