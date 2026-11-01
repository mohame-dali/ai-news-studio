import { Tab } from "@/types";

/**
 * Generate a fingerprint of all script segments across all tabs
 * This includes segment count, text content, and ordering
 * Used to detect any changes to the approved script
 */
export function generateScriptFingerprint(tabs: Tab[]): string {
  if (!tabs || tabs.length === 0) {
    return "empty";
  }

  const fingerprintParts: string[] = [];

  tabs.forEach((tab, tabIndex) => {
    const segments = tab.manuscript?.segments || [];
    
    segments.forEach((seg, segIndex) => {
      // Include: tab index, segment index, segment text
      // This detects: text changes, reordering, additions, deletions
      const segmentFingerprint = `${tabIndex}:${segIndex}:${seg.text || ""}`;
      fingerprintParts.push(segmentFingerprint);
    });
  });

  // Sort to normalize order for comparison? No, we want to detect reordering
  // Join with a delimiter that won't appear in text
  return fingerprintParts.join("|||");
}

/**
 * Compare current script with approved snapshot
 * Returns true if they match exactly (no changes)
 */
export function isScriptUnchanged(tabs: Tab[], approvedSnapshot: string[]): boolean {
  if (!approvedSnapshot || approvedSnapshot.length === 0) {
    return false; // No snapshot means no approval
  }

  const currentFingerprint = generateScriptFingerprint(tabs);
  const approvedFingerprint = approvedSnapshot.join("|||");

  return currentFingerprint === approvedFingerprint;
}

/**
 * Create a snapshot of all script text for storage
 */
export function createScriptSnapshot(tabs: Tab[]): string[] {
  const snapshot: string[] = [];
  
  tabs.forEach((tab) => {
    const segments = tab.manuscript?.segments || [];
    segments.forEach((seg) => {
      snapshot.push(seg.text || "");
    });
  });

  return snapshot;
}
