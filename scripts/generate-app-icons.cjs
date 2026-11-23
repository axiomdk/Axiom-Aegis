const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Packs an array of { width, height, pngBuffer } into a standard Windows .ico binary buffer.
 * Supports 256x256 (stored as width=0, height=0 in ICONDIRENTRY per ICO spec), 64x64, 32x32, 16x16.
 */
function buildIcoFromPngBuffers(frames) {
  const count = frames.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirTableSize = count * dirEntrySize;
  let dataOffset = headerSize + dirTableSize;

  const totalPayloadSize = frames.reduce((acc, f) => acc + f.pngBuffer.length, 0);
  const icoBuffer = Buffer.alloc(headerSize + dirTableSize + totalPayloadSize);

  // ICONDIR header (6 bytes)
  icoBuffer.writeUInt16LE(0, 0); // Reserved (must be 0)
  icoBuffer.writeUInt16LE(1, 2); // Type (1 = ICO)
  icoBuffer.writeUInt16LE(count, 4); // Number of images

  for (let i = 0; i < count; i++) {
    const frame = frames[i];
    const entryOffset = headerSize + i * dirEntrySize;
    const wByte = frame.width >= 256 ? 0 : frame.width;
    const hByte = frame.height >= 256 ? 0 : frame.height;

    icoBuffer.writeUInt8(wByte, entryOffset + 0); // Width
    icoBuffer.writeUInt8(hByte, entryOffset + 1); // Height
    icoBuffer.writeUInt8(0, entryOffset + 2); // Color palette count (0 for PNG/32bpp)
    icoBuffer.writeUInt8(0, entryOffset + 3); // Reserved (0)
    icoBuffer.writeUInt16LE(1, entryOffset + 4); // Color planes (1)
    icoBuffer.writeUInt16LE(32, entryOffset + 6); // Bits per pixel (32)
    icoBuffer.writeUInt32LE(frame.pngBuffer.length, entryOffset + 8); // Image data size in bytes
    icoBuffer.writeUInt32LE(dataOffset, entryOffset + 12); // Offset to image data

    frame.pngBuffer.copy(icoBuffer, dataOffset);
    dataOffset += frame.pngBuffer.length;
  }

  return icoBuffer;
}

function renderSquarePngBuffer(sourcePath, size) {
  // Use ffmpeg with center square crop + Lanczos scaling to stdout PNG pipe (~15ms)
  return execFileSync(
    'ffmpeg',
    [
      '-loglevel',
      'error',
      '-i',
      sourcePath,
      '-vf',
      `crop='min(iw,ih)':'min(iw,ih)',scale=${size}:${size}:flags=lanczos`,
      '-frames:v',
      '1',
      '-f',
      'image2pipe',
      '-vcodec',
      'png',
      '-',
    ],
    { maxBuffer: 20 * 1024 * 1024 }
  );
}

function main() {
  const publicDir = path.join(__dirname, '../public');
  const sourceEmblem = path.join(
    publicDir,
    'assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw__2__e45572b5.jpg'
  );

  if (!fs.existsSync(sourceEmblem)) {
    throw new Error(`Source emblem not found at ${sourceEmblem}`);
  }

  // Generate public/icon-180.png, public/icon-192.png, public/icon-512.png
  const png180 = renderSquarePngBuffer(sourceEmblem, 180);
  const png192 = renderSquarePngBuffer(sourceEmblem, 192);
  const png512 = renderSquarePngBuffer(sourceEmblem, 512);

  fs.writeFileSync(path.join(publicDir, 'icon-180.png'), png180);
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), png192);
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), png512);

  // Generate multi-size Windows .ico frames: 256x256, 64x64, 32x32, 16x16
  const icoSizes = [256, 64, 32, 16];
  const frames = icoSizes.map((sz) => ({
    width: sz,
    height: sz,
    pngBuffer: renderSquarePngBuffer(sourceEmblem, sz),
  }));

  const icoBuffer = buildIcoFromPngBuffers(frames);
  fs.writeFileSync(path.join(publicDir, 'Axiom-Aegis.ico'), icoBuffer);

  // Build public/favicon.svg embedding the 192x192 PNG so SVG favicon is 100% self-contained
  const icon192B64 = png192.toString('base64');
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <rect width="192" height="192" rx="36" fill="#000000"/>
  <image href="data:image/png;base64,${icon192B64}" width="192" height="192" preserveAspectRatio="xMidYMid slice"/>
</svg>
`;
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg, 'utf8');

  console.log(
    `Generated native Axiom Aegis icons: icon-180.png (${png180.length}B), icon-192.png (${png192.length}B), icon-512.png (${png512.length}B), favicon.svg, Axiom-Aegis.ico (${icoBuffer.length}B)`
  );
}

main();
