/**
 * AI News Studio — Pro TTS Service (Edge-TTS Microsoft Neural Voices)
 * Interacts with the Vite server proxy (/api/tts) to provide neural audio
 * and word-level timestamps for synchronized animated captions.
 */

export interface TtsWord {
  text: string;
  offsetSec: number;
  durationSec: number;
}

export interface TtsSpeechData {
  audioBase64: string;
  durationSec: number;
  words: TtsWord[];
  mimeType: string;
  voice: string;
}

// Client-side cache: textKey -> TtsSpeechData
const clientTtsCache = new Map<string, TtsSpeechData>();
const pendingRequests = new Map<string, Promise<TtsSpeechData>>();

/**
 * Extracts and sanitizes clean speech text.
 */
export function cleanSpokenText(text: string): string {
  if (!text) return "";
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\+[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Requests synthesized speech with word-level timestamps from the server proxy.
 */
export async function fetchEdgeTts(
  text: string,
  voice = "fr-FR-DeniseNeural",
  timeoutMs = 30000
): Promise<TtsSpeechData> {
  const clean = cleanSpokenText(text);
  if (!clean) {
    return {
      audioBase64: "",
      durationSec: 0,
      words: [],
      mimeType: "audio/mp3",
      voice,
    };
  }

  const cacheKey = `${voice}:::${clean}`;
  if (clientTtsCache.has(cacheKey)) {
    return clientTtsCache.get(cacheKey)!;
  }

  // Prevent duplicate in-flight requests for the exact same text
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const requestPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: clean,
          voice,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Réponse TTS invalide");
      }

      if (typeof data.audioBase64 !== "string" || !data.audioBase64.trim()) {
        throw new Error("La réponse TTS ne contient pas d’audio.");
      }

      const speechData: TtsSpeechData = {
        audioBase64: data.audioBase64,
        durationSec: data.durationSec || 0,
        words: Array.isArray(data.words) ? data.words : [],
        mimeType: data.mimeType || "audio/mp3",
        voice,
      };

      clientTtsCache.set(cacheKey, speechData);
      return speechData;
    } catch (err) {
      console.warn("[TTS Service] Failed to synthesize:", err);
      throw new Error("Échec de la génération audio (TTS)");
    } finally {
      clearTimeout(timeoutId);
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

/**
 * Converts a base64 audio data URI to an AudioBuffer via Web Audio API.
 */
export async function decodeAudioBase64(
  audioCtx: AudioContext,
  dataUri: string
): Promise<AudioBuffer | null> {
  if (!dataUri || !dataUri.includes(",")) return null;

  try {
    const base64Content = dataUri.split(",")[1];
    const binaryStr = atob(base64Content);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // decodeAudioData consumes the buffer
    const arrayBuffer = bytes.buffer;
    return await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) {
    console.warn("[TTS Service] AudioBuffer decode error:", err);
    return null;
  }
}
