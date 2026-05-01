export const MAX_RECORDING_SECONDS = 120;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export function formatAudioLimit(bytes = MAX_AUDIO_BYTES) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}
