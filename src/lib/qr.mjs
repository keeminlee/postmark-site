// qr.mjs — a QR encoder, byte mode, ECC level M, versions 1–10, rendered as
// inline SVG. Zero dependencies and zero network: the published page's CSP
// blocks external hosts, and a money surface must not be the place the town
// discovers that. An <img src="https://some-qr-api/..."> for an INTAKE ADDRESS
// would also hand a third party the ability to change where money goes.
//
// WHY THIS IS HERE AT ALL, given the size of it: the alternative was a text
// address a patron retypes by hand. A mistyped address on Base is money gone,
// unrecoverably, with no one to appeal to. A scanner does not typo.
//
// AND WHY IT IS VERIFIED RATHER THAN TRUSTED: a QR that encodes the wrong bytes
// is worse than no QR — it misdirects real money while looking authoritative.
// So test/qr.test.mjs decodes what this produces with an INDEPENDENT decoder
// (jsQR) and asserts the round-trip. The encoder is not believed; it is checked.
//
// ECC level M is chosen deliberately: ~15% recovery, which is what lets a phone
// read the code off a screen at an angle. L would fit more data in a smaller
// grid and read worse in exactly the conditions this will be used in.

// ── GF(256) — the Reed-Solomon field, generator 2, primitive poly 0x11d ──────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// The generator polynomial for `n` ECC codewords: (x−α⁰)(x−α¹)…(x−αⁿ⁻¹).
//
// It is built ASCENDING (poly[k] is the coefficient of xᵏ, so poly[0] is the
// constant term and the leading 1 lands last) and RETURNED DESCENDING, because
// the division loop below indexes gen[0] as the leading coefficient. Getting
// this backwards produces a polynomial with exactly the right coefficients in
// exactly the wrong order — which yields plausible-looking ECC bytes and a
// symbol no scanner can read. That is precisely what the round-trip test caught.
function rsGenerator(n) {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= mul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly.reverse();
}

function rsEncode(data, ecLen) {
  const gen = rsGenerator(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < ecLen; i++) res[i] ^= mul(gen[i + 1], factor);
  }
  return res;
}

// ── the version tables, ECC level M only, versions 1–10 ─────────────────────
// [ total codewords, ec codewords per block, [ [blocks, dataCodewords], … ] ]
const M = {
  1: [26, 10, [[1, 16]]],
  2: [44, 16, [[1, 28]]],
  3: [70, 26, [[1, 44]]],
  4: [100, 18, [[2, 32]]],
  5: [134, 24, [[2, 43]]],
  6: [172, 16, [[4, 27]]],
  7: [196, 18, [[4, 31]]],
  8: [242, 22, [[2, 38], [2, 39]]],
  9: [292, 22, [[3, 36], [2, 37]]],
  10: [346, 26, [[4, 43], [1, 44]]],
};
const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

const dataCodewordsFor = (v) => M[v][2].reduce((s, [n, d]) => s + n * d, 0);
// byte mode: 4 bits mode + 8 bits count (v1–9) or 16 bits (v10+)
const countBits = (v) => (v <= 9 ? 8 : 16);
const byteCapacity = (v) => Math.floor((dataCodewordsFor(v) * 8 - 4 - countBits(v)) / 8);

export function pickVersion(byteLen) {
  for (let v = 1; v <= 10; v++) if (byteLen <= byteCapacity(v)) return v;
  throw new Error(`${byteLen} bytes is past this encoder's ceiling (${byteCapacity(10)} at version 10, level M)`);
}

// ── the bitstream ───────────────────────────────────────────────────────────
function buildCodewords(bytes, version) {
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);                       // byte mode
  push(bytes.length, countBits(version));
  for (const b of bytes) push(b, 8);

  const totalData = dataCodewordsFor(version);
  const capacity = totalData * 8;
  push(0, Math.min(4, capacity - bits.length));       // terminator
  while (bits.length % 8) bits.push(0);               // pad to a byte
  const words = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    words.push(b);
  }
  const PAD = [0xec, 0x11];
  for (let i = 0; words.length < totalData; i++) words.push(PAD[i % 2]);

  // split into blocks, ECC each, then interleave (data first, then ECC)
  const [, ecLen, groups] = M[version];
  const dataBlocks = [];
  const ecBlocks = [];
  let at = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i++) {
      const block = words.slice(at, at + size);
      at += size;
      dataBlocks.push(block);
      ecBlocks.push(rsEncode(block, ecLen));
    }
  }
  const out = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecLen; i++) for (const b of ecBlocks) out.push(b[i]);
  return out;
}

// ── the matrix ──────────────────────────────────────────────────────────────
function newMatrix(size) {
  return {
    size,
    m: Array.from({ length: size }, () => new Array(size).fill(null)), // null = free
    get(x, y) { return this.m[y][x]; },
    set(x, y, v) { this.m[y][x] = v; },
  };
}

function placeFunctionPatterns(mx, version) {
  const n = mx.size;
  const finder = (cx, cy) => {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const inRing = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const on = inRing && (dx === 0 || dx === 6 || dy === 0 || dy === 6 ||
          (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        mx.set(x, y, on ? 1 : 0);
      }
    }
  };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);

  // timing
  for (let i = 8; i < n - 8; i++) {
    const v = i % 2 === 0 ? 1 : 0;
    if (mx.get(i, 6) === null) mx.set(i, 6, v);
    if (mx.get(6, i) === null) mx.set(6, i, v);
  }

  // alignment
  const centers = ALIGN[version];
  for (const cy of centers) {
    for (const cx of centers) {
      // skip the three that collide with finders
      if ((cx <= 8 && cy <= 8) || (cx >= n - 9 && cy <= 8) || (cx <= 8 && cy >= n - 9)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const on = Math.max(Math.abs(dx), Math.abs(dy)) !== 1 ? 1 : 0;
          mx.set(cx + dx, cy + dy, on);
        }
      }
    }
  }

  // the dark module — always on, always here
  mx.set(8, n - 8, 1);

  // reserve format areas (marked 0 for now; written after masking)
  for (let i = 0; i < 9; i++) {
    if (mx.get(i, 8) === null) mx.set(i, 8, 0);
    if (mx.get(8, i) === null) mx.set(8, i, 0);
  }
  for (let i = 0; i < 8; i++) {
    if (mx.get(n - 1 - i, 8) === null) mx.set(n - 1 - i, 8, 0);
    if (mx.get(8, n - 1 - i) === null) mx.set(8, n - 1 - i, 0);
  }
  // version info (v >= 7)
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const b = (bits >> i) & 1;
      const a = Math.floor(i / 3), c = i % 3;
      mx.set(a, n - 11 + c, b);
      mx.set(n - 11 + c, a, b);
    }
  }
}

function versionBits(version) {
  let d = version << 12;
  for (let i = 0; i < 6; i++) if ((d >> (17 - i)) & 1) d ^= 0x1f25 << (5 - i);
  return (version << 12) | (d & 0xfff);
}

function formatBits(maskId) {
  // ECC level M = 0b00; 5 data bits = level(2) + mask(3)
  const data = (0b00 << 3) | maskId;
  let d = data << 10;
  for (let i = 0; i < 5; i++) if ((d >> (14 - i)) & 1) d ^= 0x537 << (4 - i);
  return ((data << 10) | (d & 0x3ff)) ^ 0x5412;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function placeData(mx, codewords, reserved) {
  const n = mx.size;
  const bits = [];
  for (const w of codewords) for (let i = 7; i >= 0; i--) bits.push((w >> i) & 1);
  let bi = 0;
  let upward = true;
  for (let right = n - 1; right > 0; right -= 2) {
    if (right === 6) right = 5; // the vertical timing column is skipped entirely
    for (let step = 0; step < n; step++) {
      const y = upward ? n - 1 - step : step;
      for (const x of [right, right - 1]) {
        if (reserved[y][x]) continue;
        mx.set(x, y, bi < bits.length ? bits[bi++] : 0);
      }
    }
    upward = !upward;
  }
}

function penalty(m, n) {
  let score = 0;
  const at = (x, y) => m[y][x];
  // rule 1 — runs of 5+
  for (let i = 0; i < n; i++) {
    for (const line of [
      Array.from({ length: n }, (_, j) => at(j, i)),
      Array.from({ length: n }, (_, j) => at(i, j)),
    ]) {
      let run = 1;
      for (let j = 1; j < n; j++) {
        if (line[j] === line[j - 1]) { run++; } else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
  }
  // rule 2 — 2x2 blocks
  for (let y = 0; y < n - 1; y++)
    for (let x = 0; x < n - 1; x++)
      if (at(x, y) === at(x + 1, y) && at(x, y) === at(x, y + 1) && at(x, y) === at(x + 1, y + 1)) score += 3;
  // rule 3 — the finder-like pattern
  const P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const match = (line, i, p) => p.every((v, k) => line[i + k] === v);
  for (let i = 0; i < n; i++) {
    const row = Array.from({ length: n }, (_, j) => at(j, i));
    const col = Array.from({ length: n }, (_, j) => at(i, j));
    for (let j = 0; j + 11 <= n; j++) {
      if (match(row, j, P1) || match(row, j, P2)) score += 40;
      if (match(col, j, P1) || match(col, j, P2)) score += 40;
    }
  }
  // rule 4 — dark/light balance
  let dark = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (at(x, y)) dark++;
  const pct = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/** The QR modules as a boolean matrix. `true` = dark. */
export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)];
  const version = pickVersion(bytes.length);
  const n = version * 4 + 17;
  const codewords = buildCodewords(bytes, version);

  const base = newMatrix(n);
  placeFunctionPatterns(base, version);
  const reserved = base.m.map((row) => row.map((v) => v !== null));

  let best = null;
  for (let maskId = 0; maskId < 8; maskId++) {
    const mx = newMatrix(n);
    mx.m = base.m.map((r) => r.slice());
    placeData(mx, codewords, reserved);
    // mask only the data region
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        if (!reserved[y][x] && MASKS[maskId](x, y)) mx.set(x, y, mx.get(x, y) ^ 1);
    // write the format bits for this mask
    const f = formatBits(maskId);
    for (let i = 0; i < 15; i++) {
      const b = (f >> i) & 1;
      if (i < 6) mx.set(8, i, b);
      else if (i === 6) mx.set(8, 7, b);
      else if (i === 7) mx.set(8, 8, b);
      else if (i === 8) mx.set(7, 8, b);
      else mx.set(14 - i, 8, b);
      if (i < 8) mx.set(n - 1 - i, 8, b);
      else mx.set(8, n - 15 + i, b);
    }
    mx.set(8, n - 8, 1); // the dark module survives everything
    const score = penalty(mx.m, n);
    if (!best || score < best.score) best = { score, m: mx.m };
  }
  return best.m.map((row) => row.map((v) => v === 1));
}

/**
 * Inline SVG for `text`. No external anything — the markup carries its own
 * geometry, so it renders under a strict CSP and prints.
 *
 * `quiet` is 4 modules by design: the spec's quiet zone is what lets a scanner
 * find the symbol at all, and trimming it to look tidier is the classic reason
 * a hand-rolled QR "sometimes" fails to read.
 */
export function qrSvg(text, { size = 200, quiet = 4, dark = "#0d1426", light = "#ffffff", title = "" } = {}) {
  const m = qrMatrix(text);
  const n = m.length;
  const total = n + quiet * 2;
  const path = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (m[y][x]) path.push(`M${x + quiet} ${y + quiet}h1v1h-1z`);
    }
  }
  const label = title ? `<title>${title.replace(/[<>&]/g, "")}</title>` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"`,
    ` viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img"`,
    ` aria-label="${(title || "QR code").replace(/[<>&"]/g, "")}">`,
    label,
    `<rect width="${total}" height="${total}" fill="${light}"/>`,
    `<path fill="${dark}" d="${path.join("")}"/>`,
    `</svg>`,
  ].join("");
}
