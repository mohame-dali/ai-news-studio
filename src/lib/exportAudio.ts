export function getEnabledExportAudioTracks(
  audio: boolean,
  voice: boolean,
  music: boolean,
  hasBackgroundMusic: boolean,
): { voiceEnabled: boolean; musicEnabled: boolean } {
  return {
    voiceEnabled: audio && voice,
    musicEnabled: audio && music && hasBackgroundMusic,
  };
}

export function combineExportTracks<T>(
  videoTracks: T[],
  audioTracks: T[],
  includeAudio: boolean,
): T[] {
  return includeAudio ? [...videoTracks, ...audioTracks] : [...videoTracks];
}
