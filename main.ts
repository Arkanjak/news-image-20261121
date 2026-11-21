// news-image-20261121 — Node 22 stdlib-only PNG validator.
// Validates entry.png and copies it byte-for-byte to MAKEFUN_OUTPUT_DIR
// (or /output) as entry.png. Exits non-zero with a clear error on failure.
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = "entry.png";
const MAX_BYTES = 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// CRC-32 (IEEE 802.3) table, built once at startup.
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function main(): void {
  let buf: Buffer;
  try {
    buf = readFileSync(SRC);
  } catch {
    fail(`cannot read ${SRC} (missing or unreadable)`);
  }

  if (buf!.length > MAX_BYTES) {
    fail(`${SRC} is ${buf!.length} bytes, over the 1 MiB limit`);
  }
  if (buf!.length < 8 || !buf!.subarray(0, 8).equals(PNG_MAGIC)) {
    fail(`${SRC} does not start with the PNG magic bytes`);
  }

  // Walk the chunk stream: length (4 BE) + type (4) + data + CRC (4).
  let offset = 8;
  let width = 0;
  let height = 0;
  let seenIhdr = false;
  let seenIend = false;
  let seenIdat = false;
  let first = true;

  while (offset + 8 <= buf!.length) {
    const length = buf!.readUInt32BE(offset);
    const type = buf!.subarray(offset + 4, offset + 8).toString("latin1");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;
    if (crcEnd > buf!.length) {
      fail(`chunk ${type} at offset ${offset} is truncated`);
    }
    const storedCrc = buf!.readUInt32BE(dataEnd);
    const actualCrc = crc32(buf!.subarray(offset + 4, dataEnd));
    if (storedCrc !== actualCrc) {
      fail(`chunk ${type} at offset ${offset} has a bad CRC-32`);
    }

    if (type === "IHDR" && seenIhdr) fail("duplicate IHDR chunk");
    if (first) {
      if (type !== "IHDR") fail(`first chunk is ${type}, expected IHDR`);
      if (length !== 13) fail(`IHDR length is ${length}, expected 13 bytes`);
      width = buf!.readUInt32BE(dataStart);
      height = buf!.readUInt32BE(dataStart + 4);
      const bitDepth = buf![dataStart + 8];
      const colourType = buf![dataStart + 9];
      if (width === 0 || height === 0) fail("IHDR dimensions must be non-zero");
      if (width > 1024 || height > 1024) {
        fail(`dimensions ${width}x${height} exceed the 1024x1024 limit`);
      }
      if (bitDepth !== 8) fail(`bit depth is ${bitDepth}, expected 8`);
      if (colourType !== 2 && colourType !== 6) {
        fail(`colour type is ${colourType}, expected 2 (RGB) or 6 (RGBA)`);
      }
      const compression = buf![dataStart + 10];
      const filter = buf![dataStart + 11];
      const interlace = buf![dataStart + 12];
      if (compression !== 0) fail(`IHDR compression method is ${compression}, expected 0`);
      if (filter !== 0) fail(`IHDR filter method is ${filter}, expected 0`);
      if (interlace !== 0 && interlace !== 1) {
        fail(`IHDR interlace method is ${interlace}, expected 0 or 1`);
      }
      seenIhdr = true;
      first = false;
    }
    if (type === "IDAT") {
      if (length === 0) fail("IDAT chunk must not be empty");
      seenIdat = true;
    }
    if (type === "IEND") {
      if (length !== 0) fail("IEND chunk must have zero-length data");
      if (crcEnd !== buf!.length) {
        fail(`trailing bytes after IEND (${buf!.length - crcEnd} bytes)`);
      }
      seenIend = true;
      offset = crcEnd;
      break;
    }
    offset = crcEnd;
  }

  if (!seenIhdr) fail("no IHDR chunk found");
  if (!seenIdat) fail("no IDAT chunk found (image carries no pixel data)");
  if (!seenIend) fail("no complete IEND chunk at the end of the file");

  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  const dest = join(outDir, "entry.png");
  copyFileSync(SRC, dest);
  const copied = statSync(dest).size;
  if (copied !== buf!.length) {
    fail(`copied ${copied} bytes but source is ${buf!.length} bytes`);
  }
  console.log(`ok: entry.png ${width}x${height}, ${buf!.length} bytes -> ${dest}`);
}

main();
