// Same encoding as the Roblox side: 2 chars per coordinate, value = (hi*64+lo)/4095.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const INDEX = new Map([...B64].map((c, i) => [c, i]));

function decode(encoded) {
  const out = [];
  for (let i = 0; i + 1 < encoded.length; i += 2) {
    const hi = INDEX.get(encoded[i]) ?? 0;
    const lo = INDEX.get(encoded[i + 1]) ?? 0;
    out.push((hi * 64 + lo) / 4095);
  }
  return out;
}

function encode(values) {
  return values
    .map((v) => {
      const n = Math.round(Math.min(Math.max(v, 0), 1) * 4095);
      return B64[Math.floor(n / 64)] + B64[n % 64];
    })
    .join("");
}

module.exports = { decode, encode };
