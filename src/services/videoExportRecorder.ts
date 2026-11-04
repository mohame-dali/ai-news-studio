/**
 * AI News Studio — Client-Side Video Export Recorder with Pro Edge-TTS Audio
 * Renders the actual preview player frames onto an HTML5 Canvas at 30 FPS.
 * Mixes real neural French voiceover (Edge-TTS) and background music with Web Audio API.
 * Records the resulting video using the MediaRecorder API into a genuine MP4/WebM file.
 */

import { BlurRegion, MediaAssetType, PlayerConfig, ProcessedManuscript, SegmentType } from "@/types";
import { parsePronunciationText } from "@/lib/manuscriptProcessor";
import { fetchEdgeTts, decodeAudioBase64, TtsWord } from "@/services/ttsService";

function getMediaUrl(media?: MediaAssetType): string | undefined {
  if (!media) return undefined;
  if ("url" in media && typeof media.url === "string") {
    return media.url;
  }
  return undefined;
}

export interface ExportOptions {
  title: string;
  exportType: "Vertical" | "Horizontal" | string;
  logo: boolean;
  audio: boolean;
  voice: boolean;
  music: boolean;
}

export interface ExportProgress {
  percent: number;
  message: string;
}

/**
 * Preloads an image with crossOrigin anonymous to prevent canvas tainting.
 */
function preloadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Retry without crossOrigin
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = () => resolve(null);
      fallbackImg.src = url;
    };
    img.src = url;
  });
}

/**
 * Preloads and starts an HTML5 Video element with crossOrigin anonymous for Canvas drawing.
 */
function preloadVideo(url: string): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = "auto";
    video.src = url;

    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        video.play().catch(() => {});
        resolve(video);
      }
    };

    video.onloadeddata = finish;
    video.oncanplay = finish;
    video.onerror = () => {
      // Fallback without crossOrigin
      const fallback = document.createElement("video");
      fallback.muted = true;
      fallback.playsInline = true;
      fallback.loop = true;
      fallback.preload = "auto";
      fallback.src = url;
      fallback.onloadeddata = () => {
        fallback.play().catch(() => {});
        resolve(fallback);
      };
      fallback.onerror = () => resolve(null);
      fallback.load();
    };

    video.load();

    setTimeout(() => {
      if (!done) {
        done = true;
        if (video.readyState >= 1) {
          video.play().catch(() => {});
          resolve(video);
        } else {
          resolve(null);
        }
      }
    }, 6000);
  });
}

/**
 * Helper to wrap text into multiple lines for Canvas drawing.
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Executes a full client-side recording of the news video with real Edge-TTS audio.
 */
export async function recordPlayerVideo(
  manuscripts: ProcessedManuscript[],
  playerConfig: PlayerConfig | undefined,
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void
): Promise<{ blob: Blob; url: string; filename: string }> {
  // 1. Flatten segments
  let offset = 0;
  const allSegments: (SegmentType & { globalStart: number; globalEnd: number })[] = [];

  manuscripts.forEach((m) => {
    (m.segments || []).forEach((s) => {
      const segDuration = Math.max(2, (s.end ?? 4) - (s.start ?? 0));
      const globalStart = offset;
      const globalEnd = offset + segDuration;
      offset = globalEnd;

      allSegments.push({
        ...s,
        globalStart,
        globalEnd,
      });
    });
  });

  const totalDuration = allSegments.length > 0 ? allSegments[allSegments.length - 1].globalEnd : 10;
  const isVertical = options.exportType === "Vertical";

  // Canvas dimensions (HD quality)
  const width = isVertical ? 1080 : 1920;
  const height = isVertical ? 1920 : 1080;

  onProgress?.({ percent: 5, message: "Préparation des visuels et médias..." });

  // 2. Preload images and video B-roll assets
  const preloadedImages = new Map<string, HTMLImageElement | null>();
  const preloadedVideos = new Map<string, HTMLVideoElement | null>();

  for (const seg of allSegments) {
    const media = seg.mainMedia || (seg.images && seg.images[0]);
    const mediaUrl = getMediaUrl(media);
    const isVideoMedia = media?.type === "video" || (mediaUrl && (mediaUrl.includes(".mp4") || mediaUrl.includes(".webm")));

    if (mediaUrl) {
      if (isVideoMedia && !preloadedVideos.has(mediaUrl)) {
        const loadedVideo = await preloadVideo(mediaUrl);
        preloadedVideos.set(mediaUrl, loadedVideo);
      } else if (!isVideoMedia && !preloadedImages.has(mediaUrl)) {
        const loaded = await preloadImage(mediaUrl);
        preloadedImages.set(mediaUrl, loaded);
      }
    }
  }

  // Preload logo
  let preloadedLogo: HTMLImageElement | null = null;
  if (options.logo && playerConfig?.logo) {
    preloadedLogo = await preloadImage(playerConfig.logo);
  }

  // 3. Setup AudioContext and Destination
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  let audioCtx: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;

  try {
    audioCtx = new AudioContextClass();
    audioDest = audioCtx.createMediaStreamDestination();
  } catch (err) {
    console.warn("[VideoExport] AudioContext initialization failed:", err);
  }

  // 4. Generate & Decode Edge-TTS audio for each segment
  const segmentSpeechMap = new Map<
    number,
    { buffer: AudioBuffer | null; words: TtsWord[]; durationSec: number }
  >();

  if (options.voice && audioCtx && audioDest) {
    onProgress?.({ percent: 12, message: "Génération de la voix off neurale (Edge-TTS)..." });

    for (let i = 0; i < allSegments.length; i++) {
      const seg = allSegments[i];
      const rawText = seg.text || (seg.texts && seg.texts[0]?.displayText) || "";
      const [, spokenText] = parsePronunciationText(rawText);

      if (spokenText.trim()) {
        try {
          const ttsData = await fetchEdgeTts(spokenText, "fr-FR-DeniseNeural");
          let audioBuffer: AudioBuffer | null = null;
          if (ttsData.audioBase64) {
            audioBuffer = await decodeAudioBase64(audioCtx, ttsData.audioBase64);
          }
          segmentSpeechMap.set(i, {
            buffer: audioBuffer,
            words: ttsData.words || [],
            durationSec: ttsData.durationSec || 0,
          });
        } catch (ttsErr) {
          console.warn(`[VideoExport] TTS error for segment ${i}:`, ttsErr);
        }
      }
    }
  }

  onProgress?.({ percent: 20, message: "Mixage des pistes audio et synchronisation..." });

  // 5. Pipe Audio Tracks to Destination
  if (audioCtx && audioDest) {
    // A) Background Music
    if (options.music && playerConfig?.backgroundMusic) {
      try {
        const bgAudio = new Audio(playerConfig.backgroundMusic);
        bgAudio.crossOrigin = "anonymous";
        bgAudio.loop = true;
        const source = audioCtx.createMediaElementSource(bgAudio);
        const gainNode = audioCtx.createGain();
        // Duck background music slightly during export for crystal-clear voice
        gainNode.gain.value = (playerConfig.backgroundMusicVolume ?? 0.35) * 0.4;
        source.connect(gainNode);
        gainNode.connect(audioDest);
        bgAudio.play().catch(() => {});
      } catch (err) {
        console.warn("[VideoExport] Background music audio pipe failed:", err);
      }
    }

    // B) Voice Narration AudioBuffers scheduled at segment globalStart
    if (options.voice) {
      allSegments.forEach((seg, idx) => {
        const speech = segmentSpeechMap.get(idx);
        if (speech && speech.buffer && audioCtx && audioDest) {
          const source = audioCtx.createBufferSource();
          source.buffer = speech.buffer;
          const voiceGain = audioCtx.createGain();
          voiceGain.gain.value = 1.0;
          source.connect(voiceGain);
          voiceGain.connect(audioDest);
          // Precise start time aligned with segment
          source.start(audioCtx.currentTime + seg.globalStart);
        }
      });
    }
  }

  // 6. Setup Canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Impossible d'initialiser le contexte de rendu Canvas 2D.");
  }

  // 7. Capture Stream & Merge Audio Tracks
  const videoStream = canvas.captureStream(30);
  const streamTracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

  if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
    streamTracks.push(...audioDest.stream.getAudioTracks());
  }

  const combinedStream = new MediaStream(streamTracks);

  // 8. Select MediaRecorder MIME Type
  const mimeTypes = [
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const chosenMimeType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";
  const fileExtension = chosenMimeType.includes("mp4") ? "mp4" : "webm";

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: chosenMimeType,
    videoBitsPerSecond: 6000000,
  });

  const recordedChunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  recorder.start(100);

  // Colors
  const textBgColor = playerConfig?.colors?.text?.background || "#002664";
  const textColor = playerConfig?.colors?.text?.text || "#ffffff";
  const progressActiveBg = playerConfig?.colors?.progress?.active?.background || "#ED1C24";
  const progressInactiveBg = playerConfig?.colors?.progress?.inactive?.background || "rgba(0,0,0,0.5)";

  // 9. Render Frames sequentially (30 FPS)
  const fps = 30;
  const frameDuration = 1 / fps;
  const totalFrames = Math.ceil(totalDuration * fps);

  for (let frame = 0; frame < totalFrames; frame++) {
    const currentTime = frame * frameDuration;

    // Find current segment
    let segIdx = allSegments.findIndex((s) => currentTime >= s.globalStart && currentTime < s.globalEnd);
    if (segIdx === -1) segIdx = allSegments.length - 1;
    const seg = allSegments[segIdx];

    const segDuration = seg.globalEnd - seg.globalStart;
    const progress = Math.max(0, Math.min(1, (currentTime - seg.globalStart) / segDuration));

    // Clear background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    // Parse segment caption for text extraction and fallback cards
    const rawSegText = seg.text || (seg.texts && seg.texts[0]?.displayText) || "";
    const [cleanCaption] = parsePronunciationText(rawSegText);

    // Number extraction regex: strictly requires units (%, pour cent, €, euros, dollars, millions, milliards) to prevent false positives on years
    const numberMatch = cleanCaption.match(
      /\b(\d+(?:[.,]\d+)?\s*(?:%|pour cent|€|euros?|dollars?|millions?|milliards?))(?!\w)/i
    );
    // Quote extraction regex: e.g. « ... » or " ... " or " ... "
    const quoteMatch = cleanCaption.match(/[«"“]([^»"”]+)[»"”]/);

    // DRAW MEDIA (Video B-roll, Scraped Image, or High-Quality Graphic Fallback Card)
    const media = seg.mainMedia || (seg.images && seg.images[0]);
    const mediaUrl = getMediaUrl(media);
    const isVideoMedia = media?.type === "video" || (mediaUrl && (mediaUrl.includes(".mp4") || mediaUrl.includes(".webm")));
    const isFallbackDataUrl = Boolean(mediaUrl && mediaUrl.startsWith("data:image/svg+xml"));
    const videoElem = isVideoMedia && mediaUrl ? preloadedVideos.get(mediaUrl) : null;
    const imgElem = !isVideoMedia && mediaUrl && !isFallbackDataUrl ? preloadedImages.get(mediaUrl) : null;

    // Determine effective graphic fallback mode
    let effectiveGraphicMode: "none" | "number" | "quote" | "map" = "none";
    if (seg.graphicMode && seg.graphicMode !== "auto") {
      effectiveGraphicMode = seg.graphicMode;
    } else {
      // Auto mode: if no real external image or video is available
      const hasRealMedia = (videoElem && videoElem.videoWidth > 0) || (imgElem && imgElem.naturalWidth > 0);
      if (!hasRealMedia) {
        if (media?.type === "map") {
          effectiveGraphicMode = "map";
        } else if (numberMatch) {
          effectiveGraphicMode = "number";
        } else if (quoteMatch) {
          effectiveGraphicMode = "quote";
        }
      }
    }

    const hasActiveMediaRender =
      effectiveGraphicMode === "none" &&
      ((videoElem && (videoElem.readyState >= 2 || videoElem.videoWidth > 0)) ||
        (imgElem && imgElem.naturalWidth > 0));

    if (hasActiveMediaRender && videoElem && (videoElem.readyState >= 2 || videoElem.videoWidth > 0)) {
      ctx.save();

      // Subtle Ken Burns motion on B-roll video
      let scale = 1.04;
      let transX = 0;
      let transY = 0;

      switch (seg.cameraMovement) {
        case "zoom-in":
          scale = 1.0 + progress * 0.12;
          break;
        case "zoom-out":
          scale = 1.12 - progress * 0.12;
          break;
        case "pan-left":
          scale = 1.08;
          transX = (0.5 - progress) * (width * 0.05);
          break;
        case "pan-right":
          scale = 1.08;
          transX = -(0.5 - progress) * (width * 0.05);
          break;
        default:
          scale = 1.03;
      }

      ctx.translate(width / 2 + transX, height / 2 + transY);
      ctx.scale(scale, scale);

      // Keep video looping and aligned with segment time
      const segTime = currentTime - seg.globalStart;
      if (videoElem.duration && Number.isFinite(videoElem.duration) && videoElem.duration > 0) {
        videoElem.currentTime = segTime % videoElem.duration;
      }

      const vW = videoElem.videoWidth || 1080;
      const vH = videoElem.videoHeight || 1920;
      const vidRatio = vW / vH;
      const canvasRatio = width / height;
      let renderW = width;
      let renderH = height;

      if (vidRatio > canvasRatio) {
        renderW = height * vidRatio;
      } else {
        renderH = width / vidRatio;
      }

      try {
        ctx.drawImage(videoElem, -renderW / 2, -renderH / 2, renderW, renderH);

        // STEP 4: Real Blur Tool — apply ctx.filter = 'blur(16px)' on blur regions (visages, plaques)
        const videoBlurRegions = (media && "blurRegions" in media ? media.blurRegions : undefined) || seg.blurRegions;
        if (videoBlurRegions && videoBlurRegions.length > 0) {
          videoBlurRegions.forEach((r: BlurRegion) => {
            const rx = -renderW / 2 + r.x * renderW;
            const ry = -renderH / 2 + r.y * renderH;
            const rw = r.w * renderW;
            const rh = r.h * renderH;

            ctx.save();
            ctx.beginPath();
            ctx.rect(rx, ry, rw, rh);
            ctx.clip();
            ctx.filter = "blur(18px)";
            try {
              ctx.drawImage(videoElem, -renderW / 2, -renderH / 2, renderW, renderH);
            } catch (e) {}
            ctx.restore();
          });
        }
      } catch (err) {
        // Silent fallback if cross-origin policy prevents canvas reading
      }

      ctx.restore();
    } else if (hasActiveMediaRender && imgElem && imgElem.naturalWidth > 0) {
      ctx.save();

      // Ken Burns camera movement
      let scale = 1.05;
      let transX = 0;
      let transY = 0;

      switch (seg.cameraMovement) {
        case "zoom-in":
          scale = 1.0 + progress * 0.15;
          break;
        case "zoom-out":
          scale = 1.15 - progress * 0.15;
          break;
        case "pan-left":
          scale = 1.1;
          transX = (0.5 - progress) * (width * 0.06);
          break;
        case "pan-right":
          scale = 1.1;
          transX = -(0.5 - progress) * (width * 0.06);
          break;
        case "pan-up":
          scale = 1.1;
          transY = (0.5 - progress) * (height * 0.06);
          break;
        case "pan-down":
          scale = 1.1;
          transY = -(0.5 - progress) * (height * 0.06);
          break;
        case "zoom-rotate-left":
          scale = 1.0 + progress * 0.12;
          ctx.rotate((-progress * 1.5 * Math.PI) / 180);
          break;
        case "zoom-rotate-right":
          scale = 1.0 + progress * 0.12;
          ctx.rotate((progress * 1.5 * Math.PI) / 180);
          break;
        default:
          scale = 1.03;
      }

      ctx.translate(width / 2 + transX, height / 2 + transY);
      ctx.scale(scale, scale);

      // Object cover calculation
      const imgRatio = imgElem.naturalWidth / imgElem.naturalHeight;
      const canvasRatio = width / height;
      let renderW = width;
      let renderH = height;

      if (imgRatio > canvasRatio) {
        renderW = height * imgRatio;
      } else {
        renderH = width / imgRatio;
      }

      ctx.drawImage(imgElem, -renderW / 2, -renderH / 2, renderW, renderH);

      // STEP 4: Real Blur Tool — apply ctx.filter = 'blur(16px)' on blur regions (visages, plaques)
      const imgBlurRegions = (media && "blurRegions" in media ? media.blurRegions : undefined) || seg.blurRegions;
      if (imgBlurRegions && imgBlurRegions.length > 0) {
        imgBlurRegions.forEach((r: BlurRegion) => {
          const rx = -renderW / 2 + r.x * renderW;
          const ry = -renderH / 2 + r.y * renderH;
          const rw = r.w * renderW;
          const rh = r.h * renderH;

          ctx.save();
          ctx.beginPath();
          ctx.rect(rx, ry, rw, rh);
          ctx.clip();
          ctx.filter = "blur(18px)";
          try {
            ctx.drawImage(imgElem, -renderW / 2, -renderH / 2, renderW, renderH);
          } catch (e) {}
          ctx.restore();
        });
      }

      ctx.restore();
    } else {
      // HIGH-QUALITY GRAPHIC FALLBACK CARD (Big Numbers, Quotes, Maps, Animated Gradients)
      const isDramatic = /mort|décès|crise|baisse|guerre|danger|chute|alerte|perte|victime|attentat|sanction/i.test(cleanCaption);
      
      // Dynamic animated gradient based on editorial tone
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      if (isDramatic) {
        gradient.addColorStop(0, "#2d080c");
        gradient.addColorStop(0.5, "#150305");
        gradient.addColorStop(1, "#050102");
      } else {
        gradient.addColorStop(0, "#081329");
        gradient.addColorStop(0.45, "#0d1b3e");
        gradient.addColorStop(1, "#030712");
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Dynamic ambient radial glow
      const radialGlow = ctx.createRadialGradient(
        width / 2,
        height * 0.38,
        10,
        width / 2,
        height * 0.38,
        width * 0.65
      );
      radialGlow.addColorStop(0, isDramatic ? "rgba(239, 68, 68, 0.22)" : "rgba(59, 130, 246, 0.22)");
      radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, width, height);

      ctx.save();

      if (effectiveGraphicMode === "number") {
        // --- 1. BIG NUMBER CARD ---
        const numberVal = numberMatch ? numberMatch[1] : "100%";
        const pulse = 1.0 + Math.sin(progress * Math.PI) * 0.04;

        ctx.translate(width / 2, height * 0.38);
        ctx.scale(pulse, pulse);

        // Tag pill "LE CHIFFRE CLÉ"
        const tagFontSize = Math.round(isVertical ? width * 0.03 : width * 0.02);
        const tagText = isDramatic ? "⚠️ CHIFFRE MARQUANT" : "📊 LE CHIFFRE CLÉ";
        ctx.font = `800 ${tagFontSize}px sans-serif`;
        const tagW = ctx.measureText(tagText).width + tagFontSize * 2;
        const tagH = tagFontSize * 1.8;
        const tagY = -(isVertical ? width * 0.16 : width * 0.1);

        ctx.fillStyle = isDramatic ? "rgba(185, 28, 28, 0.6)" : "rgba(30, 58, 138, 0.6)";
        ctx.beginPath();
        ctx.roundRect(-tagW / 2, tagY, tagW, tagH, tagH / 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isDramatic ? "rgba(252, 165, 165, 0.4)" : "rgba(147, 197, 253, 0.4)";
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(tagText, 0, tagY + tagH / 2);

        // Giant yellow number with thick black outline
        const numFontSize = Math.round(isVertical ? width * 0.19 : width * 0.13);
        ctx.font = `900 ${numFontSize}px -apple-system, BlinkMacSystemFont, "Impact", "Arial Black", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.lineJoin = "round";
        ctx.lineWidth = Math.round(width * 0.024);
        ctx.strokeStyle = "#000000";
        ctx.strokeText(numberVal, 0, 0);

        ctx.fillStyle = "#facc15"; // Vibrant yellow
        ctx.fillText(numberVal, 0, 0);

        // Context / headline summary text below number
        ctx.restore();
        ctx.save();
        const ctxFontSize = Math.round(isVertical ? width * 0.04 : width * 0.024);
        ctx.font = `700 ${ctxFontSize}px sans-serif`;
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
        ctx.shadowBlur = 10;

        const maxContextW = width * 0.82;
        const contextLines = wrapCanvasText(ctx, cleanCaption, maxContextW).slice(0, 2);
        const lineH = ctxFontSize * 1.35;
        const startY = height * 0.47;
        contextLines.forEach((l, idx) => {
          ctx.fillText(l, width / 2, startY + idx * lineH);
        });

      } else if (effectiveGraphicMode === "quote") {
        // --- 2. QUOTE CARD ---
        const quoteText = quoteMatch ? quoteMatch[1] : cleanCaption;

        // Big decorative quote glyph
        ctx.font = `bold ${Math.round(width * 0.32)}px Georgia, serif`;
        ctx.fillStyle = isDramatic ? "rgba(248, 113, 113, 0.18)" : "rgba(56, 189, 248, 0.22)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("“", width / 2, height * 0.26);

        // Category Tag
        const tagFontSize = Math.round(isVertical ? width * 0.03 : width * 0.02);
        const tagText = "💬 DÉCLARATION";
        ctx.font = `800 ${tagFontSize}px sans-serif`;
        const tagW = ctx.measureText(tagText).width + tagFontSize * 2;
        const tagH = tagFontSize * 1.8;
        const tagY = height * 0.21;

        ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
        ctx.beginPath();
        ctx.roundRect(width / 2 - tagW / 2, tagY, tagW, tagH, tagH / 2);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
        ctx.stroke();

        ctx.fillStyle = "#38bdf8";
        ctx.fillText(tagText, width / 2, tagY + tagH / 2);

        // Italic quote block
        const qFontSize = Math.round(isVertical ? width * 0.046 : width * 0.028);
        ctx.font = `italic 700 ${qFontSize}px Georgia, -apple-system, sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
        ctx.shadowBlur = 12;

        const maxQuoteW = width * 0.8;
        const qLines = wrapCanvasText(ctx, `« ${quoteText} »`, maxQuoteW).slice(0, 4);
        const qLineH = qFontSize * 1.4;
        const qStartY = height * 0.31;
        qLines.forEach((l, idx) => {
          ctx.fillText(l, width / 2, qStartY + idx * qLineH);
        });

      } else if (effectiveGraphicMode === "map" || media?.type === "map") {
        // --- 3. MAP CARD ---
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.round(width * 0.04)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("📍 REPÈRE GÉOGRAPHIQUE", width / 2, height * 0.30);

        // Draw compass radar circles
        ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
        ctx.lineWidth = 2;
        [0.15, 0.25, 0.35].forEach((r) => {
          ctx.beginPath();
          ctx.arc(width / 2, height * 0.42, width * r, 0, Math.PI * 2);
          ctx.stroke();
        });

        if (media?.type === "map" && media.location) {
          ctx.font = `bold ${Math.round(width * 0.048)}px sans-serif`;
          ctx.fillStyle = "#facc15";
          ctx.fillText("Localisation", width / 2, height * 0.40);

          ctx.font = `${Math.round(width * 0.024)}px monospace`;
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(
            `Coordonnées : ${media.location.lat.toFixed(4)}° N, ${media.location.lon.toFixed(4)}° E`,
            width / 2,
            height * 0.46
          );
        }
      } else {
        // Subtle editorial branded fallback
        ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
        ctx.font = `900 ${Math.round(width * 0.11)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("ACTU DIRECT", width / 2, height * 0.42);
      }
      ctx.restore();
    }

    // DRAW VIGNETTE GRADIENTS
    const topGrad = ctx.createLinearGradient(0, 0, 0, height * 0.22);
    topGrad.addColorStop(0, "rgba(0,0,0,0.65)");
    topGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, width, height * 0.22);

    const botGrad = ctx.createLinearGradient(0, height * 0.7, 0, height);
    botGrad.addColorStop(0, "rgba(0,0,0,0)");
    botGrad.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, height * 0.7, width, height * 0.3);

    // DRAW PROGRESS BARS AT TOP
    const barMargin = width * 0.04;
    const barTop = height * 0.025;
    const barHeight = height * 0.006;
    const availableW = width - barMargin * 2;
    const barCount = allSegments.length;
    const barGap = width * 0.012;
    const barW = (availableW - barGap * (barCount - 1)) / barCount;

    allSegments.forEach((s, idx) => {
      const sDur = s.globalEnd - s.globalStart;
      const isDone = currentTime >= s.globalEnd;
      const isCur = currentTime >= s.globalStart && currentTime < s.globalEnd;
      const fill = isDone ? 1 : isCur ? (currentTime - s.globalStart) / sDur : 0;
      const barX = barMargin + idx * (barW + barGap);

      ctx.fillStyle = progressInactiveBg;
      ctx.beginPath();
      ctx.roundRect(barX, barTop, barW, barHeight, barHeight / 2);
      ctx.fill();

      if (fill > 0) {
        ctx.fillStyle = progressActiveBg;
        ctx.beginPath();
        ctx.roundRect(barX, barTop, barW * fill, barHeight, barHeight / 2);
        ctx.fill();
      }
    });

    // DRAW BRAND LOGO
    if (preloadedLogo && preloadedLogo.naturalWidth > 0) {
      const logoH = height * 0.045;
      const logoW = (preloadedLogo.naturalWidth / preloadedLogo.naturalHeight) * logoH;
      const logoX = width - barMargin - logoW;
      const logoY = barTop + barHeight + height * 0.02;
      ctx.drawImage(preloadedLogo, logoX, logoY, logoW, logoH);
    }

    // DRAW CAPTION CARTOUCHE WITH WORD-LEVEL SYNCHRONIZATION
    if (cleanCaption.trim()) {
      const fontSize = Math.round(isVertical ? width * 0.048 : width * 0.028);
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const maxCaptionW = width * 0.85;
      const captionLines = wrapCanvasText(ctx, cleanCaption, maxCaptionW);
      const lineHeight = fontSize * 1.35;
      const boxPadY = fontSize * 0.65;
      const boxPadX = fontSize * 0.9;
      const boxHeight = captionLines.length * lineHeight + boxPadY * 2;

      let maxLineW = 0;
      captionLines.forEach((l) => {
        maxLineW = Math.max(maxLineW, ctx.measureText(l).width);
      });
      const boxWidth = Math.min(width * 0.92, maxLineW + boxPadX * 2);

      let boxY = height * 0.82 - boxHeight; // default bottom
      if (seg.style === "top") {
        boxY = height * 0.15;
      } else if (seg.style === "middle") {
        boxY = (height - boxHeight) / 2;
      }

      const boxX = (width - boxWidth) / 2;

      // Draw rounded background cartouche
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = textBgColor;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 14);
      ctx.fill();
      ctx.restore();

      // Check current active word for highlight
      const speech = segmentSpeechMap.get(segIdx);
      const relTime = currentTime - seg.globalStart;
      let currentWordText = "";

      if (speech && speech.words && speech.words.length > 0) {
        const found = speech.words.find(
          (w) => relTime >= w.offsetSec && relTime < w.offsetSec + w.durationSec + 0.12
        );
        if (found) currentWordText = found.text.toLowerCase().replace(/[.,!?;:]/g, "");
      }

      // Draw caption text lines
      captionLines.forEach((lineText, lineIdx) => {
        const textY = boxY + boxPadY + lineIdx * lineHeight + lineHeight / 2;

        if (currentWordText) {
          // Render words with highlighting for the active word
          const wordsInLine = lineText.split(" ");
          const lineTotalW = ctx.measureText(lineText).width;
          let currentX = width / 2 - lineTotalW / 2;

          wordsInLine.forEach((word) => {
            const cleanW = word.toLowerCase().replace(/[.,!?;:]/g, "");
            const isMatch = cleanW === currentWordText;

            ctx.save();
            if (isMatch) {
              ctx.fillStyle = "#facc15"; // Vibrant yellow highlight
              ctx.shadowColor = "rgba(250, 204, 21, 0.7)";
              ctx.shadowBlur = 8;
            } else {
              ctx.fillStyle = textColor;
            }
            ctx.textAlign = "left";
            ctx.fillText(word, currentX, textY);
            ctx.restore();

            currentX += ctx.measureText(word + " ").width;
          });
        } else {
          ctx.fillStyle = textColor;
          ctx.fillText(lineText, width / 2, textY);
        }
      });
    }

    // DRAW PHOTO / FOOTAGE LEGAL CREDITS & WATERMARK (High-contrast badge in TOP-LEFT safe zone, safe from TikTok UI)
    const mediaAuthor = media?.author || (media?.byline ? media.byline.replace(/^📷\s*/, "") : "");
    const mediaLicense = media?.license || (media?.source === "Pexels" ? "Licence Pexels" : "");
    const mediaSource = media?.source || (mediaUrl?.includes("pexels") ? "Pexels" : mediaUrl?.includes("wikimedia") ? "Wikimedia Commons" : "");

    let legalBadge = "";
    if (mediaAuthor && mediaLicense && mediaSource) {
      legalBadge = `${isVideoMedia ? "Vidéo" : "Photo"} : ${mediaAuthor} · ${mediaLicense} · ${mediaSource}`;
    } else if (mediaAuthor && mediaSource) {
      legalBadge = `${isVideoMedia ? "Vidéo" : "Photo"} : ${mediaAuthor} · ${mediaSource}`;
    } else if (mediaAuthor && mediaLicense) {
      legalBadge = `${isVideoMedia ? "Vidéo" : "Photo"} : ${mediaAuthor} · ${mediaLicense}`;
    } else if (media?.byline) {
      legalBadge = media.byline.replace(/^📷\s*/, "");
    } else if (mediaSource) {
      legalBadge = `Source : ${mediaSource}`;
    }

    if (legalBadge && effectiveGraphicMode === "none") {
      // Small 14px readable badge (top-left, below progress bar)
      const badgeFontSize = Math.max(13, Math.round(isVertical ? width * 0.016 : width * 0.012));
      ctx.font = `600 ${badgeFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      const maxBadgeW = width * 0.55; // Prevent overlap with top-right channel logo
      const textMetrics = ctx.measureText(legalBadge);
      const padX = badgeFontSize * 0.8;
      const padY = badgeFontSize * 0.45;
      const badgeH = badgeFontSize + padY * 2;
      const badgeW = Math.min(maxBadgeW, textMetrics.width + padX * 2);

      // Top-left safe zone: x=24 or barMargin, y=50px (below progress indicators)
      const badgeX = barMargin;
      const badgeY = barTop + barHeight + Math.round(height * 0.018);

      ctx.save();
      // Translucent high-contrast pill
      ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.stroke();

      // Clip text to avoid overflow beyond badgeW
      ctx.beginPath();
      ctx.rect(badgeX, badgeY, badgeW - padX, badgeH);
      ctx.clip();

      // Attribution text
      ctx.fillStyle = "#f3f4f6";
      ctx.fillText(legalBadge, badgeX + padX, badgeY + badgeH / 2);
      ctx.restore();
    }

    // Update progress callback every few frames
    if (frame % 6 === 0 || frame === totalFrames - 1) {
      const percent = Math.min(95, 25 + Math.round((frame / totalFrames) * 70));
      onProgress?.({
        percent,
        message: `Rendu HD avec synchronisation vocale (${currentTime.toFixed(1)}s / ${totalDuration.toFixed(1)}s)...`,
      });
      await new Promise((res) => setTimeout(res, 4));
    }
  }

  onProgress?.({ percent: 96, message: "Finalisation du fichier vidéo et audio..." });

  // 10. Stop recorder and produce Blob
  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      try {
        const blob = new Blob(recordedChunks, { type: chosenMimeType });
        const url = URL.createObjectURL(blob);
        const filename = `${options.title || "video-actualite"}-${options.exportType.toLowerCase()}.${fileExtension}`;
        onProgress?.({ percent: 100, message: "Rendu vidéo & audio terminé avec succès !" });
        resolve({ blob, url, filename });
      } catch (err) {
        reject(err);
      } finally {
        if (audioCtx) {
          audioCtx.close().catch(() => {});
        }
      }
    };

    recorder.onerror = (e) => {
      reject(new Error(`Erreur lors de l'enregistrement MediaRecorder : ${e}`));
    };

    recorder.stop();
  });
}
