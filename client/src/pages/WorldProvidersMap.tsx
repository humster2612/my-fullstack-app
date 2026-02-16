// client/src/pages/WorldProvidersMap.tsx
import { useEffect, useState } from "react";
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

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export default function WorldProvidersMap() {
  const [items, setItems] = useState<ProviderMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);

  const [zoom, setZoom] = useState(1.5);
  const [center, setCenter] = useState<[number, number]>([10, 50]); // Европа по центру (lng, lat)

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
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Zoom buttons (внутри карты, не ломают layout) */}
      <div
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 5,
        }}
      >
        {/* <button
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
        </button> */}
      </div>

      <ComposableMap projection="geoMercator" style={{ width: "100%", height: "100%" }}>
        <ZoomableGroup
          center={center}
          zoom={zoom}
          minZoom={1}
          maxZoom={8}
          onMoveEnd={(pos: any) => {
            if (pos?.coordinates) setCenter(pos.coordinates as [number, number]);
            if (pos?.zoom) setZoom(pos.zoom as number);
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

          {items.map((p) => (
            <Marker
              key={p.id}
              coordinates={[p.lng, p.lat]}
              onMouseEnter={() => setHoverId(p.id)}
              onMouseLeave={() => setHoverId((cur) => (cur === p.id ? null : cur))}
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

      {/* tooltip внизу карты */}
      {(hovered || loading || err) && (
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            padding: "10px 12px",
            borderRadius: 14,
            background: "rgba(0,0,0,.65)",
            border: "1px solid rgba(255,255,255,.12)",
            backdropFilter: "blur(6px)",
            fontSize: 13,
            zIndex: 5,
          }}
        >
          {loading && <span style={{ opacity: 0.85 }}>Loading…</span>}
          {err && <span style={{ color: "salmon" }}>{err}</span>}
          {!loading && !err && hovered && (
            <>
              <div style={{ fontWeight: 700 }}>@{hovered.username}</div>
              {hovered.location ? <div style={{ opacity: 0.8 }}>{hovered.location}</div> : null}
              {hovered.specializations?.length ? (
                <div style={{ marginTop: 4, opacity: 0.85 }}>
                  {hovered.specializations.join(" • ")}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// const zoomButton: React.CSSProperties = {
//   width: 44,
//   height: 44,
//   borderRadius: 12,
//   border: "1px solid rgba(255,255,255,.18)",
//   background: "rgba(20,20,20,.9)",
//   color: "#fff",
//   fontSize: 22,
//   cursor: "pointer",
//   fontWeight: 700,
// };
