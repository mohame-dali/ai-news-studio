import React, { useEffect, useMemo, useRef, useState } from "react";
import { BlurRegion, MediaAssetType, PlayerConfig, ProcessedManuscript, SegmentType } from "@/types";
import { parsePronunciationText } from "@/lib/manuscriptProcessor";
import { fetchEdgeTts, TtsSpeechData } from "@/services/ttsService";
import { motionConfig } from "@/config/motionConfig";
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

function getMediaUrl(media?: MediaAssetType): string | undefined {
  if (!media) return undefined;
  if ("url" in media && typeof media.url === "string") {
    return media.url;
  }
  return undefined;
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

  // Segment-level TTS cache: segmentId -> TtsSpeechData
  const [ttsMap, setTtsMap] = useState<Record<string, TtsSpeechData>>({});
  const [currentSpeech, setCurrentSpeech] = useState<TtsSpeechData | null>(null);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const musicAudioContextRef = useRef<AudioContext | null>(null);
  const musicGainNodeRef = useRef<GainNode | null>(null);
  const musicSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const currentSegmentIdRef = useRef<string | number | null>(null);
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);

  // Flatten all segments across manuscripts
  const allSegments = useMemo(() => {
    let offset = 0;
    const segments: (SegmentType & { globalStart: number; globalEnd: number; manuscriptIndex: number; uniqueId?: string; uniquId?: string })[] = [];

    (manuscripts || []).forEach((m, mIdx) => {
      if (!m) return;
      const mId = m.meta?.uniqueId || (m.meta as any)?.uniquId || (m as any).uniqueId || (m as any).uniquId || `m-${mIdx}`;
      (m.segments || []).forEach((s, sIdx) => {
        if (!s) return;
        const segDuration = Math.max(2, (s.end ?? 4) - (s.start ?? 0));
        const globalStart = offset;
        const globalEnd = offset + segDuration;
        offset = globalEnd;
        const segId = s.id ?? (s as any).uniqueId ?? (s as any).uniquId ?? `seg-${mIdx}-${sIdx}`;

        segments.push({
          ...s,
          id: segId,
          uniqueId: String(segId),
          uniquId: String(segId),
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

  // Preload Edge-TTS speech and word timestamps for all segments
  useEffect(() => {
    let isCancelled = false;

    const preloadAllTts = async () => {
      for (const seg of allSegments) {
        const rawText = seg.text || (seg.texts && seg.texts[0]?.displayText) || "";
        const [, spokenText] = parsePronunciationText(rawText);
        if (spokenText.trim()) {
          const segKey = String(seg?.id ?? (seg as any)?.uniqueId ?? (seg as any)?.uniquId ?? "seg-0");
          try {
            const data = await fetchEdgeTts(spokenText, "fr-FR-DeniseNeural");
            if (!isCancelled && data.audioBase64) {
              setTtsMap((prev) => ({
                ...prev,
                [segKey]: data,
              }));
            }
          } catch (err) {
            console.warn(`[VideofyPlayer] Preload TTS failed for segment ${segKey}:`, err);
          }
        }
      }
    };

    preloadAllTts();
    return () => {
      isCancelled = true;
    };
  }, [allSegments]);

  // The narration element is the preview clock while speech is playing.
  useEffect(() => {
    if (!isPlaying) {
      lastTimestampRef.current = null;
      return;
    }

    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = lastTimestampRef.current === null ? 0 : (now - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = now;
      setCurrentTime((previousTime) => {
        const segment = allSegments.find(
          (item) => previousTime >= item.globalStart && previousTime < item.globalEnd
        );
        const narration = ttsAudioRef.current;
        const audioClockTime =
          voice && !isMuted && segment && narration && !narration.paused && narration.readyState >= 2
            ? segment.globalStart + narration.currentTime
            : previousTime + delta;
        if (audioClockTime >= totalDuration) {
          setIsPlaying(false);
          return totalDuration;
        }
        return audioClockTime;
      });
    }, 30);

    return () => window.clearInterval(timer);
  }, [allSegments, isMuted, isPlaying, totalDuration, voice]);

  // Edge-TTS audio playback & synchronization
  useEffect(() => {
    if (!ttsAudioRef.current) return;

    if (!isPlaying || isMuted || !voice) {
      ttsAudioRef.current.pause();
      return;
    }

    if (!currentSegment) return;

    const segKey = String(currentSegment.id ?? (currentSegment as any).uniqueId ?? (currentSegment as any).uniquId ?? "seg-0");
    const speechData = ttsMap[segKey];

    const currentSegId = currentSegment.id ?? (currentSegment as any).uniqueId ?? (currentSegment as any).uniquId ?? "seg-0";
    if (currentSegmentIdRef.current !== currentSegId) {
      currentSegmentIdRef.current = currentSegId;

      if (speechData && speechData.audioBase64) {
        setCurrentSpeech(speechData);
        ttsAudioRef.current.src = speechData.audioBase64;
        const relTime = Math.max(0, currentTime - currentSegment.globalStart);
        ttsAudioRef.current.currentTime = relTime;
        ttsAudioRef.current.play().catch(() => {});
      } else {
        // Fetch on the fly if not preloaded yet
        const rawText = currentSegment.text || (currentSegment.texts && currentSegment.texts[0]?.displayText) || "";
        const [, spokenText] = parsePronunciationText(rawText);
        if (spokenText.trim()) {
          fetchEdgeTts(spokenText, "fr-FR-DeniseNeural")
            .then((data) => {
              if (data.audioBase64 && ttsAudioRef.current) {
                setTtsMap((prev) => ({ ...prev, [segKey]: data }));
                setCurrentSpeech(data);
                ttsAudioRef.current.src = data.audioBase64;
                const relTime = Math.max(0, currentTime - currentSegment.globalStart);
                ttsAudioRef.current.currentTime = relTime;
                ttsAudioRef.current.play().catch(() => {});
              }
            })
            .catch((err) => {
              console.warn(`[VideofyPlayer] On-demand TTS failed for segment ${segKey}:`, err);
            });
        }
      }
    } else {
      // Still in same segment, ensure playing
      if (ttsAudioRef.current.paused && speechData && speechData.audioBase64) {
        ttsAudioRef.current.play().catch(() => {});
      }
    }
  }, [isPlaying, isMuted, voice, currentSegment, ttsMap]);

  useEffect(() => {
    const musicElement = bgMusicRef.current;
    if (!musicElement) return;

    try {
      let audioContext = musicAudioContextRef.current;
      let source = musicSourceNodeRef.current;
      let gain = musicGainNodeRef.current;
      if (!audioContext || !source || !gain) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContext = new AudioContextClass();
        source = audioContext.createMediaElementSource(musicElement);
        gain = audioContext.createGain();
        musicAudioContextRef.current = audioContext;
        musicSourceNodeRef.current = source;
        musicGainNodeRef.current = gain;
      }
      source.connect(gain);
      gain.connect(audioContext.destination);
      musicElement.volume = 1;
    } catch (err) {
      console.warn("[VideofyPlayer] Music gain setup failed:", err);
    }

    return () => {
      musicSourceNodeRef.current?.disconnect();
      musicGainNodeRef.current?.disconnect();
    };
  }, [playerConfig?.backgroundMusic]);

  // Sync background music with audio ducking when TTS is talking
  useEffect(() => {
    if (!bgMusicRef.current) return;
    if (isPlaying && backgroundMusic && !isMuted) {
      const audioContext = musicAudioContextRef.current;
      const gain = musicGainNodeRef.current?.gain;
      if (audioContext && gain) {
        void audioContext.resume();
        const baseVol = playerConfig?.backgroundMusicVolume ?? 0.35;
        const ducking = motionConfig.ducking;
        const speaking = voice && isVoiceSpeaking;
        const targetVolume = Math.max(baseVol * (speaking ? ducking.duckLevel : ducking.restoreLevel), 0.0001);
        const now = audioContext.currentTime;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
        gain.exponentialRampToValueAtTime(
          targetVolume,
          now + (speaking ? ducking.rampDownSeconds : ducking.rampUpSeconds)
        );
      }
      bgMusicRef.current.play().catch(() => {});
    } else {
      bgMusicRef.current.pause();
    }
  }, [isPlaying, backgroundMusic, isMuted, voice, isVoiceSpeaking, playerConfig?.backgroundMusicVolume]);

  const togglePlay = () => {
    if (currentTime >= totalDuration && totalDuration > 0) {
      currentSegmentIdRef.current = null;
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
      }
      setCurrentTime(0);
      setIsPlaying(true);
      return;
    }

    if (isPlaying) {
      if (ttsAudioRef.current) ttsAudioRef.current.pause();
    }
    setIsPlaying(!isPlaying);
  };

  const seek = (time: number) => {
    const clamped = Math.max(0, Math.min(time, totalDuration));
    setCurrentTime(clamped);

    // Synchronize TTS audio offset
    if (currentSegment && ttsAudioRef.current) {
      const relTime = Math.max(0, clamped - currentSegment.globalStart);
      try {
        ttsAudioRef.current.currentTime = relTime;
      } catch {
        // audio element may still be buffering
      }
    }
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

  // Synchronized Subtitle rendering with word-level highlight
  const renderedSubtitle = useMemo(() => {
    if (!currentSegment) return null;
    const rawText = currentSegment.text || (currentSegment.texts && currentSegment.texts[0]?.displayText) || "";
    const [displayText] = parsePronunciationText(rawText);
    if (!displayText.trim()) return null;

    const segKey = String(currentSegment.id ?? (currentSegment as any).uniqueId ?? (currentSegment as any).uniquId ?? "seg-0");
    const speechData = ttsMap[segKey] || currentSpeech;
    const relTime = currentTime - currentSegment.globalStart;

    // If we have precise word boundaries from Edge-TTS
    if (speechData && speechData.words && speechData.words.length > 0) {
      return (
        <span className="flex flex-wrap justify-center gap-x-1.5 gap-y-1">
          {speechData.words.map((w, idx) => {
            const isSpoken = relTime >= w.offsetSec;
            const isCurrent =
              relTime >= w.offsetSec && relTime < w.offsetSec + w.durationSec + 0.15;

            return (
              <span
                key={idx}
                className={`transition-all duration-100 rounded-sm px-0.5 ${
                  isCurrent
                    ? "text-yellow-300 font-extrabold scale-110 drop-shadow-[0_2px_8px_rgba(250,204,21,0.6)]"
                    : isSpoken
                    ? "text-white font-bold opacity-100"
                    : "text-white/70 font-medium"
                }`}
              >
                {w.text}
              </span>
            );
          })}
        </span>
      );
    }

    // Fallback: whole sentence display
    return <span>{displayText}</span>;
  }, [currentSegment, currentTime, ttsMap, currentSpeech]);

  const rawText = currentSegment?.text || (currentSegment?.texts && currentSegment.texts[0]?.displayText) || "";
  const [cleanCaption] = parsePronunciationText(rawText);
  // Number extraction regex: strictly requires units (%, pour cent, €, euros, dollars, millions, milliards) to prevent false positives on years
  const numberMatch = cleanCaption.match(
    /\b(\d+(?:[.,]\d+)?\s*(?:%|pour cent|€|euros?|dollars?|millions?|milliards?))(?!\w)/i
  );
  const quoteMatch = cleanCaption.match(/[«"“]([^»"”]+)[»"”]/);
  const isDramatic = /mort|décès|crise|baisse|guerre|danger|chute|alerte|perte|victime|attentat|sanction/i.test(cleanCaption);

  const textColor = playerConfig?.colors?.text?.text || "#ffffff";
  const textBgColor = playerConfig?.colors?.text?.background || "#2C4FE3";
  const progressActiveBg = playerConfig?.colors?.progress?.active?.background || "#2C4FE3";
  const progressInactiveBg = playerConfig?.colors?.progress?.inactive?.background || "rgba(0,0,0,0.5)";

  const activeMedia = currentSegment?.mainMedia;
  const mediaUrl = getMediaUrl(activeMedia);
  const isVideo =
    activeMedia?.type === "video" ||
    (Boolean(mediaUrl) &&
      (mediaUrl!.includes(".mp4") || mediaUrl!.includes(".webm")));
  const isMap = activeMedia?.type === "map";
  const isFallbackDataUrl = Boolean(mediaUrl && mediaUrl.startsWith("data:image/svg+xml"));
  const isImage = !isVideo && !isMap && Boolean(mediaUrl) && !isFallbackDataUrl;

  // Determine effective graphic fallback mode
  let effectiveGraphicMode: "none" | "number" | "quote" | "map" = "none";
  if (currentSegment?.graphicMode && currentSegment.graphicMode !== "auto") {
    effectiveGraphicMode = currentSegment.graphicMode;
  } else {
    // Auto mode: if no real external image or video
    const hasRealMedia = (isVideo || isImage) && !isFallbackDataUrl;
    if (!hasRealMedia) {
      if (isMap) {
        effectiveGraphicMode = "map";
      } else if (numberMatch) {
        effectiveGraphicMode = "number";
      } else if (quoteMatch) {
        effectiveGraphicMode = "quote";
      }
    }
  }

  const isFallback = effectiveGraphicMode === "none" && !isImage && !isVideo && !isMap;

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

      {/* Pro Edge-TTS Audio Narration Track */}
      <audio
        ref={ttsAudioRef}
        preload="auto"
        className="hidden"
        onPlay={() => setIsVoiceSpeaking(true)}
        onPause={() => setIsVoiceSpeaking(false)}
        onEnded={() => {
          setIsVoiceSpeaking(false);
        }}
        onTimeUpdate={() => {
          const audio = ttsAudioRef.current;
          if (!audio || !voice || isMuted || audio.paused) return;
          const segment = allSegments.find(
            (item) => currentTime >= item.globalStart && currentTime < item.globalEnd
          );
          if (segment) setCurrentTime(segment.globalStart + audio.currentTime);
        }}
      />

      {/* Media Canvas Area */}
      <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
        {/* 1. GRAPHIC FALLBACK CARD: BIG NUMBER */}
        {effectiveGraphicMode === "number" && (
          <div
            className={`w-full h-full absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none ${
              isDramatic
                ? "bg-gradient-to-br from-red-950 via-neutral-950 to-black"
                : "bg-gradient-to-br from-blue-950 via-slate-950 to-black"
            }`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18),transparent_70%)] pointer-events-none" />
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 shadow-md border ${
                isDramatic
                  ? "bg-red-900/60 border-red-500/40 text-red-200"
                  : "bg-blue-900/60 border-blue-500/40 text-blue-200"
              }`}
            >
              {isDramatic ? "⚠️ CHIFFRE MARQUANT" : "📊 LE CHIFFRE CLÉ"}
            </span>

            <span
              className="font-black text-6xl sm:text-7xl md:text-8xl text-yellow-400 tracking-tight transition-transform duration-300 drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]"
              style={{
                WebkitTextStroke: "2.5px #000000",
                textShadow: "0 0 20px rgba(250, 204, 21, 0.4)",
              }}
            >
              {numberMatch ? numberMatch[1] : "100%"}
            </span>

            <p className="mt-3 text-xs sm:text-sm font-semibold text-gray-200 max-w-[85%] line-clamp-2 drop-shadow-md">
              {cleanCaption}
            </p>
          </div>
        )}

        {/* 2. GRAPHIC FALLBACK CARD: QUOTE */}
        {effectiveGraphicMode === "quote" && (
          <div
            className={`w-full h-full absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none ${
              isDramatic
                ? "bg-gradient-to-br from-red-950/90 via-slate-950 to-black"
                : "bg-gradient-to-br from-slate-950 via-indigo-950/80 to-black"
            }`}
          >
            <span className="text-sky-400/25 font-serif text-8xl -mb-10 select-none">“</span>
            <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider mb-3 bg-sky-950/70 border border-sky-400/40 text-sky-300">
              💬 DÉCLARATION
            </span>
            <blockquote className="text-base sm:text-lg font-bold italic text-white max-w-[85%] leading-snug drop-shadow-lg">
              « {quoteMatch ? quoteMatch[1] : cleanCaption} »
            </blockquote>
          </div>
        )}

        {/* 3. SOLID EDITORIAL BACKGROUND FALLBACK */}
        {isFallback && (
          <div className="w-full h-full absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center select-none">
            <span className="text-white/10 font-black text-3xl sm:text-4xl tracking-widest uppercase">
              ACTU DIRECT
            </span>
          </div>
        )}

        {/* IMAGE ASSET */}
        {effectiveGraphicMode === "none" && isImage && mediaUrl && (
          <div
            className="w-full h-full absolute inset-0 bg-cover bg-center transition-transform ease-linear duration-100"
            style={{
              backgroundImage: `url(${mediaUrl})`,
              transform: mediaTransform,
              transformOrigin:
                activeMedia && "hotspot" in activeMedia && activeMedia.hotspot
                  ? `${((activeMedia.hotspot.x_norm ?? 0.5) * 100).toFixed(0)}% ${((activeMedia.hotspot.y_norm ?? 0.5) * 100).toFixed(0)}%`
                  : "center center",
            }}
          >
            {/* STEP 4: Blur Regions (Visages & Plaques) */}
            {((activeMedia && "blurRegions" in activeMedia ? activeMedia.blurRegions : undefined) || currentSegment?.blurRegions)?.map((r: BlurRegion, bIdx: number) => (
              <div
                key={bIdx}
                className="absolute pointer-events-none rounded border border-dashed border-red-500/80"
                style={{
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.w * 100}%`,
                  height: `${r.h * 100}%`,
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  backgroundColor: "rgba(0, 0, 0, 0.25)",
                }}
              />
            ))}
          </div>
        )}

        {/* VIDEO ASSET */}
        {effectiveGraphicMode === "none" && isVideo && mediaUrl && (
          <div className="w-full h-full absolute inset-0">
            <video
              ref={videoElementRef}
              src={mediaUrl}
              autoPlay
              loop
              muted
              playsInline
              crossOrigin="anonymous"
              className="w-full h-full object-cover absolute inset-0"
              style={{ transform: mediaTransform }}
            />
            {/* STEP 4: Blur Regions on Video */}
            {((activeMedia && "blurRegions" in activeMedia ? activeMedia.blurRegions : undefined) || currentSegment?.blurRegions)?.map((r: BlurRegion, bIdx: number) => (
              <div
                key={bIdx}
                className="absolute pointer-events-none rounded border border-dashed border-red-500/80"
                style={{
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.w * 100}%`,
                  height: `${r.h * 100}%`,
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  backgroundColor: "rgba(0, 0, 0, 0.25)",
                }}
              />
            ))}
          </div>
        )}

        {/* MAP ASSET */}
        {activeMedia?.type === "map" && activeMedia.location && (
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
                key={seg?.id ?? (seg as any)?.uniqueId ?? (seg as any)?.uniquId ?? idx}
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
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        {/* Dynamic Synchronized Captions Overlay */}
        {currentSegment && renderedSubtitle && (
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
              {renderedSubtitle}
            </div>
          </div>
        )}

        {/* Photo / Footage Legal Attribution Badge (TOP-LEFT safe zone, avoiding TikTok overlay) */}
        {effectiveGraphicMode === "none" &&
          (activeMedia?.author || activeMedia?.byline || activeMedia?.source) && (
            <div className="absolute top-7 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/85 backdrop-blur-xs border border-white/15 text-[10px] font-medium tracking-wide text-gray-200 drop-shadow-md pointer-events-none max-w-[55%] truncate">
              <span>
                {activeMedia?.type === "video" ? "🎥 Vidéo : " : "📷 Photo : "}
                {activeMedia?.author ||
                  (activeMedia?.byline ? activeMedia.byline.replace(/^📷\s*/, "") : "")}
                {activeMedia?.license ? ` · ${activeMedia.license}` : ""}
                {activeMedia?.source ? ` · ${activeMedia.source}` : ""}
              </span>
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
            title="Recommencer la vidéo"
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
            title={isMuted ? "Activer le son" : "Couper le son"}
          >
            <SoundOutlined />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideofyPlayer;
