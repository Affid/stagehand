// A minimal zip writer for test packages (updates plan, live tests): files
// stored without compression, which Foundry's installer reads like any zip.
// No dependency: Node has CRC-32 (zlib.crc32) since 22.2.
import { crc32 } from "node:zlib";

export interface ZipEntry {
  readonly name: string;
  readonly data: Buffer;
}

/** MS-DOS date for 1980-01-01, the earliest a zip can say. */
const DOS_DATE = 0x21;
const VERSION = 20;

function localHeader(name: Buffer, data: Buffer, crc: number): Buffer {
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0);
  h.writeUInt16LE(VERSION, 4);
  h.writeUInt16LE(0, 6); // flags
  h.writeUInt16LE(0, 8); // stored
  h.writeUInt16LE(0, 10); // time
  h.writeUInt16LE(DOS_DATE, 12);
  h.writeUInt32LE(crc, 14);
  h.writeUInt32LE(data.length, 18);
  h.writeUInt32LE(data.length, 22);
  h.writeUInt16LE(name.length, 26);
  h.writeUInt16LE(0, 28); // extra
  return h;
}

function centralHeader(
  name: Buffer,
  data: Buffer,
  crc: number,
  offset: number,
): Buffer {
  const h = Buffer.alloc(46);
  h.writeUInt32LE(0x02014b50, 0);
  h.writeUInt16LE(VERSION, 4); // made by
  h.writeUInt16LE(VERSION, 6); // needed
  h.writeUInt16LE(0, 8);
  h.writeUInt16LE(0, 10);
  h.writeUInt16LE(0, 12);
  h.writeUInt16LE(DOS_DATE, 14);
  h.writeUInt32LE(crc, 16);
  h.writeUInt32LE(data.length, 20);
  h.writeUInt32LE(data.length, 24);
  h.writeUInt16LE(name.length, 28);
  // extra, comment, disk, internal and external attributes: all zero
  h.writeUInt32LE(offset, 42);
  return h;
}

function endRecord(count: number, size: number, offset: number): Buffer {
  const h = Buffer.alloc(22);
  h.writeUInt32LE(0x06054b50, 0);
  h.writeUInt16LE(count, 8);
  h.writeUInt16LE(count, 10);
  h.writeUInt32LE(size, 12);
  h.writeUInt32LE(offset, 16);
  return h;
}

/** A zip of these files, in order. */
export function zip(entries: readonly ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data);
    const local = Buffer.concat([localHeader(name, e.data, crc), name, e.data]);
    centrals.push(
      Buffer.concat([centralHeader(name, e.data, crc, offset), name]),
    );
    locals.push(local);
    offset += local.length;
  }
  const central = Buffer.concat(centrals);
  return Buffer.concat([
    ...locals,
    central,
    endRecord(entries.length, central.length, offset),
  ]);
}
