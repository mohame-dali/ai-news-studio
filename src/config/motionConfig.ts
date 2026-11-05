export const motionConfig = {
  previewDriftThresholdSeconds: 0.08,
  highlightColor: "#FFE500",
  popDurationSeconds: 0.16,
  popScale: 1.12,
  safeZones: {
    topPercent: 10,
    bottomPercent: 25,
    leftPercent: 8,
    rightPercent: 15,
  },
  ducking: {
    duckLevel: 0.15,
    restoreLevel: 0.5,
    rampDownSeconds: 0.2,
    rampUpSeconds: 0.4,
  },
  presets: {
    Actu: { pop: true, colourHighlight: true },
    Sobre: { pop: false, colourHighlight: false },
    "Mouvement réduit": { pop: false, colourHighlight: true },
  },
  maxSubtitleLines: 2,
  maxSubtitleCharactersPerLine: 30,
  logoMaxWidthSafeAreaRatio: 0.25,
  sourceBadgeMaxWidthSafeAreaRatio: 0.55,
  logoReservedWidthRem: 5.5,
  logoHeightPercent: 4.5,
  verticalSubtitleFontRatio: 0.048,
  horizontalSubtitleFontRatio: 0.028,
  subtitleLineHeightRatio: 1.35,
  subtitlePaddingVerticalRatio: 0.65,
  subtitlePaddingHorizontalRatio: 0.9,
  subtitleOutlineWidthRatio: 0.07,
  subtitleOutlineWidthPx: 1.5,
} as const;

export type MotionPreset = keyof typeof motionConfig.presets;
