import React from "react";

interface Props {
  location?: {
    lat: number;
    lon: number;
  };
  zoom?: number;
  onEdit?: () => void;
  styles?: React.CSSProperties;
  onClick?: () => void;
  interactive?: boolean;
}

export const MapComponent: React.FC<Props> = ({
  location,
  zoom = 6,
  onEdit,
  styles,
  onClick,
}) => {
  if (!location || typeof location.lat !== "number" || typeof location.lon !== "number") {
    return (
      <div className="flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500 text-sm">
        Please specify valid map coordinates.
      </div>
    );
  }

  // Create an OpenStreetMap static tile or iframe embed URL safely
  const lat = location.lat;
  const lon = location.lon;
  const bboxDelta = 0.08 / Math.pow(1.5, Math.max(1, zoom - 4));
  const minLon = lon - bboxDelta;
  const maxLon = lon + bboxDelta;
  const minLat = lat - bboxDelta;
  const maxLat = lat + bboxDelta;

  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lon}`;

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "180px",
        borderRadius: "0.5rem",
        overflow: "hidden",
        backgroundColor: "#e5e7eb",
        ...styles,
      }}
      className="group"
    >
      <iframe
        title={`Map location ${lat}, ${lon}`}
        src={embedUrl}
        className="w-full h-full border-0 pointer-events-none"
        loading="lazy"
      />
      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[11px] px-2 py-0.5 rounded backdrop-blur-xs font-mono">
        {lat.toFixed(4)}°, {lon.toFixed(4)}°
      </div>

      {onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white text-gray-800 text-xs font-semibold px-2.5 py-1.5 rounded shadow transition-all cursor-pointer"
        >
          Edit map
        </button>
      )}
    </div>
  );
};

export default MapComponent;
