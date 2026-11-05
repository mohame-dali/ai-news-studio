import { motionConfig, type MotionPreset } from "@/config/motionConfig";

export interface TimedWord {
  text: string;
  offsetSec: number;
  durationSec: number;
}

export interface WordHighlightState {
  wordIndex: number;
  scale: number;
  highlighted: boolean;
}

export function getSubtitleTokens(text: string): string[] {
  return text.trim().split(/\s+/u).filter(Boolean);
}

export function getWordTimings(
  text: string,
  receivedWords: TimedWord[] | undefined,
  durationSeconds: number,
): TimedWord[] {
  if (receivedWords?.length) {
    return receivedWords.map((word) => ({
      text: word.text,
      offsetSec: word.offsetSec,
      durationSec: word.durationSec,
    }));
  }
  const tokens = getSubtitleTokens(text);
  const characterCount = [...text.replace(/\s+/gu, "")].length;
  if (!tokens.length || durationSeconds <= 0 || characterCount === 0) return [];
  let consumedCharacters = 0;
  return tokens.map((token) => {
    const tokenCharacters = [...token].length;
    const offsetSec = (consumedCharacters / characterCount) * durationSeconds;
    const durationSec = (tokenCharacters / characterCount) * durationSeconds;
    consumedCharacters += tokenCharacters;
    return { text: token, offsetSec, durationSec };
  });
}

export function getWordHighlightState(
  words: TimedWord[],
  timeSeconds: number,
  preset: MotionPreset,
): WordHighlightState {
  const index = words.findIndex(
    (word) => timeSeconds >= word.offsetSec && timeSeconds < word.offsetSec + word.durationSec,
  );
  const settings = motionConfig.presets[preset];
  if (index < 0 || !settings.pop) {
    return { wordIndex: index, scale: 1, highlighted: index >= 0 && settings.colourHighlight };
  }
  const elapsed = timeSeconds - words[index].offsetSec;
  const progress = Math.min(elapsed / motionConfig.popDurationSeconds, 1);
  const pop = Math.sin(progress * Math.PI);
  return {
    wordIndex: index,
    scale: 1 + (motionConfig.popScale - 1) * pop,
    highlighted: settings.colourHighlight,
  };
}

export interface SafeTextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function fitTextBoxToSafeArea(
  box: SafeTextBox,
  canvasWidth: number,
  canvasHeight: number,
): SafeTextBox {
  const zones = motionConfig.safeZones;
  const left = (canvasWidth * zones.leftPercent) / 100;
  const top = (canvasHeight * zones.topPercent) / 100;
  const right = canvasWidth * (1 - zones.rightPercent / 100);
  const bottom = canvasHeight * (1 - zones.bottomPercent / 100);
  const width = Math.min(box.width, right - left);
  const height = Math.min(box.height, bottom - top);
  return {
    x: Math.max(left, Math.min(box.x, right - width)),
    y: Math.max(top, Math.min(box.y, bottom - height)),
    width,
    height,
  };
}
