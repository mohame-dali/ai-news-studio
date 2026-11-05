import { motionConfig } from "@/config/motionConfig";

export interface SpeechInterval {
  startSeconds: number;
  endSeconds: number;
}

interface AudioParamAutomation {
  cancelScheduledValues(startTime: number): void;
  setValueAtTime(value: number, startTime: number): void;
  linearRampToValueAtTime(value: number, endTime: number): void;
}

export function scheduleMusicDucking(
  gain: AudioParamAutomation,
  intervals: SpeechInterval[],
  audioClockStart: number,
  baseGain: number,
): void {
  const { duckLevel, restoreLevel, rampDownSeconds, rampUpSeconds } = motionConfig.ducking;
  gain.cancelScheduledValues(audioClockStart);
  gain.setValueAtTime(baseGain * restoreLevel, audioClockStart);
  for (const interval of [...intervals].sort((a, b) => a.startSeconds - b.startSeconds)) {
    const start = audioClockStart + interval.startSeconds;
    const end = audioClockStart + interval.endSeconds;
    gain.setValueAtTime(baseGain * restoreLevel, start);
    gain.linearRampToValueAtTime(baseGain * duckLevel, start + rampDownSeconds);
    gain.setValueAtTime(baseGain * duckLevel, end);
    gain.linearRampToValueAtTime(baseGain * restoreLevel, end + rampUpSeconds);
  }
}
