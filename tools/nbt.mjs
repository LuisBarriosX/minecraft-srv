import { gunzipSync, gzipSync } from 'node:zlib';

// Keep untouched tags byte-for-byte, including Java's modified UTF-8 strings.
export function readNbt(compressed) {
  const buffer = compressed[0] === 0x1f && compressed[1] === 0x8b ? gunzipSync(compressed) : compressed;
  let offset = 0;
  function take(length) {
    if (!Number.isSafeInteger(length) || length < 0 || offset + length > buffer.length) {
      throw new Error(`Invalid NBT length ${length} at ${offset}`);
    }
    const bytes = buffer.subarray(offset, offset + length);
    offset += length;
    return bytes;
  }
  function string() { return take(take(2).readUInt16BE()).toString('utf8'); }
  function payload(type) {
    switch (type) {
      case 1: return take(1).readInt8();
      case 2: return take(2).readInt16BE();
      case 3: return take(4).readInt32BE();
      case 4: return take(8).readBigInt64BE();
      case 5: return take(4).readFloatBE();
      case 6: return take(8).readDoubleBE();
      case 7: return take(take(4).readInt32BE());
      case 8: return string();
      case 9: {
        const elementType = take(1)[0];
        const length = take(4).readInt32BE();
        if (length < 0 || length > buffer.length || (elementType === 0 && length !== 0)) throw new Error('Invalid NBT list');
        return { elementType, items: Array.from({ length }, () => payload(elementType)) };
      }
      case 10: {
        const fields = [];
        while (true) {
          const start = offset;
          const fieldType = take(1)[0];
          if (fieldType === 0) return fields;
          const name = string();
          const value = payload(fieldType);
          fields.push({ type: fieldType, name, value, raw: buffer.subarray(start, offset) });
        }
      }
      case 11: return take(take(4).readInt32BE() * 4);
      case 12: return take(take(4).readInt32BE() * 8);
      default: throw new Error(`Unsupported NBT tag ${type}`);
    }
  }
  const type = take(1)[0];
  if (type !== 10) throw new Error('Expected an NBT compound root');
  const name = string();
  const fields = payload(type);
  if (offset !== buffer.length) throw new Error('Trailing NBT data');
  return { name, fields, buffer };
}

function number(length, method, value) {
  const buffer = Buffer.alloc(length);
  buffer[method](value);
  return buffer;
}
function asciiString(value) {
  if (!/^[\x00-\x7f]*$/.test(value) || value.includes('\0')) throw new Error('New NBT strings must be ASCII');
  const bytes = Buffer.from(value);
  return Buffer.concat([number(2, 'writeUInt16BE', bytes.length), bytes]);
}
function payload(type, value) {
  switch (type) {
    case 1: return number(1, 'writeInt8', value);
    case 2: return number(2, 'writeInt16BE', value);
    case 3: return number(4, 'writeInt32BE', value);
    case 4: return number(8, 'writeBigInt64BE', value);
    case 5: return number(4, 'writeFloatBE', value);
    case 6: return number(8, 'writeDoubleBE', value);
    case 8: return asciiString(value);
    case 9: return Buffer.concat([Buffer.from([value.elementType]), number(4, 'writeInt32BE', value.items.length), ...value.items.map(item => payload(value.elementType, item))]);
    case 10: return Buffer.concat([...value.map(encodeTag), Buffer.from([0])]);
    default: throw new Error(`New NBT tag type ${type} is not supported`);
  }
}
export function encodeTag(tag) {
  return tag.raw ?? Buffer.concat([Buffer.from([tag.type]), asciiString(tag.name), payload(tag.type, tag.value)]);
}
export function writeNbt(root) {
  return gzipSync(Buffer.concat([Buffer.from([10]), asciiString(root.name), payload(10, root.fields)]));
}
export function field(fields, name) { return fields.find(tag => tag.name === name); }
export function plain(tag) {
  if (!tag) return undefined;
  if (tag.type === 10) return Object.fromEntries(tag.value.map(child => [child.name, plain(child)]));
  if (tag.type === 9) return tag.value.items.map(value => plain({ type: tag.value.elementType, value }));
  if (Buffer.isBuffer(tag.value)) return `[${tag.value.length} bytes]`;
  return typeof tag.value === 'bigint' ? tag.value.toString() : tag.value;
}
