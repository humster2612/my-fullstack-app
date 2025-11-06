import { useState } from "react";

// компактный SVG как data URL — без внешних доменов
const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
      <rect width="100%" height="100%" fill="#2a2a2a"/>
      <circle cx="128" cy="96" r="56" fill="#444"/>
      <rect x="48" y="168" width="160" height="56" rx="28" fill="#444"/>
    </svg>`
  );

export default function Avatar({
  src,
  size = 96,
  alt = "",
  style = {},
}: {
  src?: string | null;
  size?: number;
  alt?: string;
  style?: React.CSSProperties;
}) {
  const [broken, setBroken] = useState(false);
  const url = !src || broken ? DEFAULT_AVATAR : src;
  return (
    <img
      src={url}
      width={size}
      height={size}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      style={{ borderRadius: "50%", objectFit: "cover", ...style }}
    />
  );
}
