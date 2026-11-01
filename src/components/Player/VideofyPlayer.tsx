import React, { useEffect, useMemo, useRef, useState } from "react";
import { PlayerConfig, ProcessedManuscript, SegmentType } from "@/types";
import {
  CaretRightOutlined,
  PauseOutlined,
  ReloadOutlined,
  SoundOutlined,
} from "@ant-design/icons";
import MapComponent from "../Map/MapComponent";

interface Props {
  manuscripts: ProcessedManuscript[];
  width?: number;
  height?: number;
  playerConfig?: PlayerConfig;
  style?: React.CSSProperties;
  voice?: boolean;
  backgroundMusic?: boolean;
  disabledLogo?: boolean;
}

export const VideofyPlayer: React.FC<Props> = ({
  manuscripts,
  playerConfig,
  style,
  voice = true,
  backgroundMusic = true,
  disabledLogo = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  // Flatten all segments across manuscripts
  const allSegments = useMemo(() => {
    let offset = 0;
    const segments: (SegmentType & { globalStart: number; globalEnd: number; manuscriptIndex: number })[] = [];

    manuscripts.forEach((m, mIdx) => {
      (m.segments || []).forEach((s) => {
        const segDuration = Math.max(1, (s.end ?? 4) - (s.start ?? 0));
        const globalStart = offset;
        const globalEnd = offset + segDuration;
        offset = globalEnd;

        segments.push({
          ...s,
          globalStart,
          globalEnd,
          manuscriptIndex: mIdx,
        });
      });
    });

    return segments;
  }, [manuscripts]);

  const totalDuration = useMemo(() => {
    if (allSegments.length === 0) return 0;
    return allSegments[allSegments.length - 1].globalEnd;
  }, [allSegments]);

  // Current segment
  const currentSegment = useMemo(() => {
    if (allSegments.length === 0) return null;
    const found = allSegments.find(
      (s) => currentTime >= s.globalStart && currentTime < s.globalEnd
    );
    return found || allSegments[allSegments.length - 1];
  }, [allSegments, currentTime]);

  // Playhead animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimestampRef.current = null;
      return;
    }

    const step = (now: number) => {
      if (lastTimestampRef.current !== null) {
        const delta = (now - lastTimestampRef.current) / 1000;
        setCurrentTime((prev) => {
          const next = prev + delta;
          if (next >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return next;
        });
      }
      lastTimestampRef.current = now;
      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, totalDuration]);

  // Sync background music
  useEffect(() => {
    if (!bgMusicRef.current) return;
    if (isPlaying && backgroundMusic && !isMuted) {
      bgMusicRef.current.volume = (playerConfig?.backgroundMusicVolume ?? 0.35) * 0.8;
      bgMusicRef.current.play().catch(() => {});
    } else {
      bgMusicRef.current.pause();
    }
  }, [isPlaying, backgroundMusic, isMuted, playerConfig?.backgroundMusicVolume]);

  const togglePlay = () => {
    if (currentTime >= totalDuration && totalDuration > 0) {
      setCurrentTime(0);
      setIsPlaying(true);
      return;
    }
    setIsPlaying(!isPlaying);
  };

  const seek = (time: number) => {
    const clamped = Math.max(0, Math.min(time, totalDuration));
    setCurrentTime(clamped);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  // Ken-Burns style dynamic transform for current segment
  const segmentProgress = useMemo(() => {
    if (!currentSegment) return 0;
    const segLen = currentSegment.globalEnd - currentSegment.globalStart;
    if (segLen <= 0) return 0;
    return Math.max(0, Math.min(1, (currentTime - currentSegment.globalStart) / segLen));
  }, [currentSegment, currentTime]);

  const mediaTransform = useMemo(() => {
    if (!currentSegment) return "scale(1)";
    const cam = currentSegment.cameraMovement;
    const p = segmentProgress;

    switch (cam) {
      case "zoom-in":
        return `scale(${1 + p * 0.16})`;
      case "zoom-out":
        return `scale(${1.16 - p * 0.16})`;
      case "pan-left":
        return `scale(1.1) translateX(${(0.5 - p) * 6}%)`;
      case "pan-right":
        return `scale(1.1) translateX(${-(0.5 - p) * 6}%)`;
      case "pan-up":
        return `scale(1.1) translateY(${(0.5 - p) * 6}%)`;
      case "pan-down":
        return `scale(1.1) translateY(${-(0.5 - p) * 6}%)`;
      case "zoom-rotate-left":
        return `scale(${1 + p * 0.12}) rotate(${-(p * 1.5)}deg)`;
      case "zoom-rotate-right":
        return `scale(${1 + p * 0.12}) rotate(${p * 1.5}deg)`;
      default:
        return "scale(1.02)";
    }
  }, [currentSegment, segmentProgress]);

  const textColor = playerConfig?.colors?.text?.text || "#ffffff";
  const textBgColor = playerConfig?.colors?.text?.background || "#2C4FE3";
  const progressActiveBg = playerConfig?.colors?.progress?.active?.background || "#2C4FE3";
  const progressInactiveBg = playerConfig?.colors?.progress?.inactive?.background || "rgba(0,0,0,0.5)";

  const activeMedia = currentSegment?.mainMedia;
  const isVideo = activeMedia?.type === "video";
  const isMap = activeMedia?.type === "map";
  const isImage = !isVideo && !isMap;

  // Text placement positioning classes
  const placementClass = useMemo(() => {
    const style = currentSegment?.style || "bottom";
    switch (style) {
      case "top":
        return "top-14 justify-start";
      case "middle":
        return "top-1/2 -translate-y-1/2 justify-center";
      case "bottom":
      default:
        return "bottom-14 justify-end";
    }
  }, [currentSegment?.style]);

  return (
    <div
      className="relative flex flex-col items-center justify-center bg-black overflow-hidden select-none rounded-xl shadow-2xl"
      style={style}
    >
      {/* Background audio tracks */}
      {playerConfig?.backgroundMusic && (
        <audio
          ref={bgMusicRef}
          src={playerConfig.backgroundMusic}
          loop
          preload="none"
        />
      )}

      {/* Media Canvas Area */}
      <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
        {/* IMAGE ASSET */}
        {isImage && activeMedia?.url && (
          <div
            className="w-full h-full absolute inset-0 bg-cover bg-center transition-transform ease-linear duration-100"
            style={{
              backgroundImage: `url(${activeMedia.url})`,
              transform: mediaTransform,
              transformOrigin: activeMedia.hotspot
                ? `${((activeMedia.hotspot.x_norm ?? 0.5) * 100).toFixed(0)}% ${((activeMedia.hotspot.y_norm ?? 0.5) * 100).toFixed(0)}%`
                : "center center",
            }}
          />
        )}

        {/* VIDEO ASSET */}
        {isVideo && activeMedia?.url && (
          <video
            ref={videoElementRef}
            src={activeMedia.url}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover absolute inset-0"
            style={{ transform: mediaTransform }}
          />
        )}

        {/* MAP ASSET */}
        {isMap && activeMedia?.location && (
          <div className="w-full h-full absolute inset-0">
            <MapComponent
              location={activeMedia.location}
              zoom={activeMedia.location.zoomStart || 6}
              styles={{ width: "100%", height: "100%", borderRadius: 0 }}
            />
          </div>
        )}

        {/* Dark subtle vignette / gradient for text readability */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/60" />

        {/* Progress Bar (Segment indicators at top) */}
        <div className="absolute top-3 left-4 right-4 z-20 flex gap-1.5 h-1.5">
          {allSegments.map((seg, idx) => {
            const segDuration = seg.globalEnd - seg.globalStart;
            const isCompleted = currentTime >= seg.globalEnd;
            const isCurrent = currentTime >= seg.globalStart && currentTime < seg.globalEnd;
            const fillPct = isCompleted
              ? 100
              : isCurrent
              ? Math.max(0, Math.min(100, ((currentTime - seg.globalStart) / segDuration) * 100))
              : 0;

            return (
              <div
                key={idx}
                className="h-full rounded-full overflow-hidden flex-1 backdrop-blur-xs transition-all"
                style={{ backgroundColor: progressInactiveBg }}
              >
                <div
                  className="h-full transition-all duration-75"
                  style={{
                    width: `${fillPct}%`,
                    backgroundColor: progressActiveBg,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Brand Logo Overlay */}
        {!disabledLogo && playerConfig?.logo && (
          <div
            className="absolute z-20 pointer-events-none transition-all drop-shadow-md"
            style={{
              top: "24px",
              right: "20px",
            }}
          >
            <img
              src={playerConfig.logo}
              alt="Brand Logo"
              className="max-h-8 max-w-24 object-contain"
              onError={(e) => {
                // fallback to svg if broken
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        {/* Captions Overlay */}
        {currentSegment && (
          <div
            className={`absolute left-4 right-4 z-20 flex flex-col items-center pointer-events-none ${placementClass}`}
          >
            <div
              className="inline-block px-4 py-2.5 rounded-lg text-center text-sm sm:text-base font-bold shadow-lg max-w-[90%] leading-relaxed transition-all duration-200"
              style={{
                backgroundColor: textBgColor,
                color: textColor,
              }}
            >
              {currentSegment.text || (currentSegment.texts && currentSegment.texts[0]?.displayText) || ""}
            </div>
          </div>
        )}

        {/* Photo / Footage Credits */}
        {activeMedia?.byline && (
          <div
            className="absolute bottom-10 left-4 z-20 flex items-center gap-1.5 text-[11px] font-medium tracking-wide drop-shadow-md pointer-events-none"
            style={{
              color: playerConfig?.colors?.fotoCredits?.text || "#d1d5db",
            }}
          >
            <span className="opacity-75">📷 {activeMedia.byline}</span>
          </div>
        )}
      </div>

      {/* Floating Bottom Control Bar */}
      <div className="absolute bottom-2 left-3 right-3 z-30 flex items-center justify-between bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-lg px-3 py-1.5 text-white transition-all text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="hover:text-blue-400 p-1 cursor-pointer transition-colors"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <PauseOutlined className="text-base" />
            ) : (
              <CaretRightOutlined className="text-base" />
            )}
          </button>
          <button
            type="button"
            onClick={() => seek(0)}
            className="hover:text-blue-400 p-1 cursor-pointer transition-colors"
            title="Restart video"
          >
            <ReloadOutlined />
          </button>
          <span className="font-mono text-[11px] text-gray-300">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>

        {/* Progress Scrubber */}
        <div className="flex-1 mx-3 flex items-center">
          <input
            type="range"
            min={0}
            max={totalDuration || 1}
            step={0.05}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className={`p-1 cursor-pointer ${isMuted ? "text-red-400" : "text-gray-300 hover:text-white"}`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            <SoundOutlined />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideofyPlayer;
