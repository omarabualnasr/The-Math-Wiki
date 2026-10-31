export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/** Create a standards-compliant ZIP archive using the STORE method (no compression). */
export function createZipArchive(files: ZipEntry[]): Blob {
  if (files.length > 0xffff) throw new Error('A ZIP archive cannot contain more than 65,535 entries.');
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    if (name.length > 0xffff) throw new Error(`ZIP entry name is too long: ${file.name}`);
    const crc = crc32(file.data);
    const local = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
      u32(crc), u32(file.data.length), u32(file.data.length), u16(name.length), u16(0), name, file.data,
    ]);
    localParts.push(local);

    const central = concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
      u32(crc), u32(file.data.length), u32(file.data.length), u16(name.length), u16(0),
      u16(0), u16(0), u16(0), u32(0), u32(localOffset), name,
    ]);
    centralParts.push(central);
    localOffset += local.length;
  }

  const centralDirectory = concat(centralParts);
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralDirectory.length), u32(localOffset), u16(0),
  ]);
  const archive = concat([...localParts, centralDirectory, end]);
  return new Blob([archive.buffer as ArrayBuffer], { type: 'application/zip' });
}

export interface ExtractedZipEntry {
  name: string;
  data: Uint8Array;
}

/** Read ZIP files produced with the STORE method by createZipArchive. */
export function extractStoredZipArchive(input: ArrayBuffer, limits: { maxBytes?: number; maxEntries?: number } = {}): ExtractedZipEntry[] {
  const bytes = new Uint8Array(input);
  const view = new DataView(input);
  const maxBytes = limits.maxBytes ?? 80 * 1024 * 1024;
  const maxEntries = limits.maxEntries ?? 2000;
  if (bytes.byteLength > maxBytes) throw new Error('This archive is larger than the allowed backup size.');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const entries: ExtractedZipEntry[] = [];
  const names = new Set<string>();
  let offset = 0;
  let totalUncompressed = 0;

  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    if (entries.length >= maxEntries) throw new Error('This archive contains too many files.');
    if (offset + 30 > bytes.length) throw new Error('The ZIP archive has a truncated local header.');
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const expectedCrc = view.getUint32(offset + 14, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    if ((flags & 0x0001) !== 0 || (flags & 0x0008) !== 0) throw new Error('Encrypted or streaming ZIP entries are not supported.');
    if (method !== 0 || compressedSize !== uncompressedSize) throw new Error('This backup uses an unsupported ZIP compression method.');
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length || dataStart < nameStart) throw new Error('The ZIP archive contains a truncated file.');
    let name: string;
    try { name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength)); }
    catch { throw new Error('The ZIP archive contains an invalid filename.'); }
    if (!name || name.startsWith('/') || name.includes('..') || name.includes('\\') || names.has(name)) throw new Error('The ZIP archive contains an unsafe or duplicate filename.');
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > maxBytes) throw new Error('The uncompressed backup exceeds the allowed size.');
    const data = bytes.slice(dataStart, dataEnd);
    if (crc32(data) !== expectedCrc) throw new Error(`The ZIP entry “${name}” failed its integrity check.`);
    names.add(name);
    entries.push({ name, data });
    offset = dataEnd;
  }

  if (entries.length === 0 || offset + 4 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
    throw new Error('This file is not a supported Mathematics Wiki backup archive.');
  }
  return entries;
}
