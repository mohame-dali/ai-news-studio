import { Config, ManuscriptType, ProcessedManuscript } from "@/types";

export const parsePronunciationText = (text: string): [string, string] => {
  const displayText = text.replace(/\s*\[[^\]]+\]/g, "");
  const ttsText = text.replace(/([\p{L}0-9_-]+)\s*\[([^\]]+)\]/gu, "$2");
  return [displayText, ttsText];
};

export async function processManuscriptLocally(
  manuscript: ManuscriptType,
  _config: Config
): Promise<ProcessedManuscript> {
  // Simulate processing time
  await new Promise((res) => setTimeout(res, 400));

  const safeManuscript = manuscript || ({} as ManuscriptType);
  const safeMeta = safeManuscript.meta || ({} as any);
  const fallbackId = safeMeta.uniqueId || safeMeta.uniquId || `gen-${Date.now()}`;

  let currentCursor = 0;
  const processedSegments = (safeManuscript.segments || []).map((seg, segIdx) => {
    const rawText = seg?.text || (seg?.texts && seg.texts[0]?.text) || "";
    const [displayText, ttsText] = parsePronunciationText(rawText);
    const words = ttsText.trim().split(/\s+/).filter(Boolean);
    const duration = Math.max(3.0, words.length * 0.42);

    const segmentStart = currentCursor;
    const segmentEnd = Math.round((currentCursor + duration) * 10) / 10;
    currentCursor = segmentEnd + 0.3; // brief pause

    const texts = [
      {
        type: "text" as const,
        text: ttsText,
        displayText,
        line_id: segIdx + 1,
        who: "default",
        start: segmentStart,
        end: segmentEnd,
      },
    ];

    const mainMedia = seg?.mainMedia || (seg?.images && seg.images[0]);

    return {
      ...seg,
      id: seg?.id ?? `seg-${segIdx + 1}`,
      text: rawText,
      texts,
      mainMedia,
      images: mainMedia ? [mainMedia] : [],
      start: segmentStart,
      end: segmentEnd,
    };
  });

  return {
    meta: {
      ...safeMeta,
      title: safeMeta.title || "Sujet d'actualité",
      pubdate: safeMeta.pubdate || new Date().toISOString(),
      byline: safeMeta.byline || "Rédaction AI News Studio",
      uniqueId: fallbackId,
      uniquId: fallbackId,
      audio: safeMeta.audio || {
        src: "/assets/voice-sample.wav",
      },
    },
    uniqueId: fallbackId,
    uniquId: fallbackId,
    segments: processedSegments,
    media: processedSegments.map((s) => s.mainMedia!).filter(Boolean),
  };
}
