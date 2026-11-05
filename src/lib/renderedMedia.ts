import type { BlurRegion, MediaAssetType, SegmentType } from "../types";

export function getRenderedMedia(segment: SegmentType): MediaAssetType[] {
  if (segment.graphicMode === "number" || segment.graphicMode === "quote") return [];
  if (segment.graphicMode === "map") {
    return segment.mainMedia?.type === "map" ? [segment.mainMedia] : [];
  }
  const media = segment.mainMedia || segment.images?.[0];
  return media ? [media] : [];
}

export function isExternalMedia(media: MediaAssetType): boolean {
  const url = "url" in media ? media.url : "";
  const hasExternalAttribution = Boolean(media.source || media.license || media.licenseUrl || media.byline || media.author);
  if (url.startsWith("data:")) return hasExternalAttribution;
  return (
    /^https?:\/\//i.test(url) ||
    hasExternalAttribution
  );
}

export function getUnvalidatedRenderedMedia(segment: SegmentType): MediaAssetType[] {
  return getRenderedMedia(segment).filter(
    (media) => isExternalMedia(media) && media.licenseValidated !== true
  );
}

export function getUnvalidatedRenderedMediaForManuscripts(
  manuscripts: Array<{ segments?: SegmentType[] }>
): Array<{ segmentIdx: number; media: MediaAssetType }> {
  const issues: Array<{ segmentIdx: number; media: MediaAssetType }> = [];
  let segmentIdx = 0;
  for (const manuscript of manuscripts) {
    for (const segment of manuscript.segments || []) {
      segmentIdx++;
      for (const media of getUnvalidatedRenderedMedia(segment)) {
        issues.push({ segmentIdx, media });
      }
    }
  }
  return issues;
}

export function getNumberCardValue(text: string): string | null {
  return text.match(/\b(\d+(?:[.,]\d+)?\s*(?:%|pour cent|€|euros?|dollars?|millions?|milliards?)?)(?!\w)/i)?.[1] || null;
}

export function isValidBlurRegion(region: BlurRegion): boolean {
  return (
    [region.x, region.y, region.w, region.h].every(Number.isFinite) &&
    region.x >= 0 &&
    region.y >= 0 &&
    region.w > 0 &&
    region.h > 0 &&
    region.x + region.w <= 1 &&
    region.y + region.h <= 1
  );
}

export function getInvalidBlurRegions(segment: SegmentType): BlurRegion[] {
  const media = getRenderedMedia(segment)[0];
  const regions = [
    ...(segment.blurRegions || []),
    ...(media && "blurRegions" in media ? media.blurRegions || [] : []),
  ];
  return regions.filter((region) => !isValidBlurRegion(region));
}

export function assertValidBlurRegions(segments: SegmentType[]): void {
  for (let index = 0; index < segments.length; index++) {
    if (getInvalidBlurRegions(segments[index]).length > 0) {
      throw new Error(`Zone de floutage invalide dans la séquence ${index + 1} (${segments[index].id}).`);
    }
  }
}
