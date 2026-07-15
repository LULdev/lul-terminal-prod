/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Detect image MIME from magic bytes (declared type must match). */
export function detectImageMime(buffer) {
  if (!buffer?.length || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
    && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'image/bmp';
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  return null;
}

export function assertMimeMatchesBuffer(declaredMime, buffer) {
  const detected = detectImageMime(buffer);
  if (!detected) throw new Error('Unrecognized image format');
  if (detected !== declaredMime) {
    throw new Error('Image content does not match declared type');
  }
}