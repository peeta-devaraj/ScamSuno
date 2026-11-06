export const RECORD_SECONDS = 15;
export const WAV_LIMIT = 600_000;

export function readWav(bytes: Uint8Array) {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => view.getUint32(at);
  if (tag(0) !== 0x52494646 || tag(8) !== 0x57415645 ||
      view.getUint32(4, true) + 8 !== bytes.length) return null;
  let sampleRate = 0;
  let dataBytes = 0;
  let dataOffset = 0;
  let at = 12;
  while (at + 8 <= bytes.length) {
    const size = view.getUint32(at + 4, true);
    const start = at + 8;
    if (start + size + (size % 2) > bytes.length) return null;
    if (tag(at) === 0x666d7420) {
      if (size < 16 || sampleRate || view.getUint16(start, true) !== 1 ||
          view.getUint16(start + 2, true) !== 1 || view.getUint16(start + 14, true) !== 16) return null;
      sampleRate = view.getUint32(start + 4, true);
      if (sampleRate < 8000 || sampleRate > 44100 ||
          view.getUint32(start + 8, true) !== sampleRate * 2 ||
          view.getUint16(start + 12, true) !== 2) return null;
    }
    if (tag(at) === 0x64617461) {
      if (dataOffset || size % 2) return null;
      dataOffset = start;
      dataBytes = size;
    }
    at = start + size + (size % 2);
  }
  return sampleRate && dataBytes && at === bytes.length
    ? { sampleRate, dataBytes, dataOffset, seconds: dataBytes / (sampleRate * 2) } : null;
}

export function encodeWav(samples: Float32Array, inputRate: number) {
  const outputRate = 16000;
  const ratio = inputRate / outputRate;
  const count = Math.floor(samples.length / ratio);
  const bytes = new Uint8Array(44 + count * 2);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x52494646);
  view.setUint32(4, bytes.length - 8, true);
  view.setUint32(8, 0x57415645);
  view.setUint32(12, 0x666d7420);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outputRate, true);
  view.setUint32(28, outputRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461);
  view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.max(start + 1, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    const value = Math.max(-1, Math.min(1, sum / (end - start)));
    view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}

export function audible(samples: Float32Array) {
  let peak = 0;
  let energy = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
    energy += sample * sample;
  }
  return peak >= 0.02 && Math.sqrt(energy / samples.length) >= 0.005;
}
