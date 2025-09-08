// index.js
const fs = require("fs");

// map digit char -> numeric value
function charToDigit(ch) {
  if (ch >= '0' && ch <= '9') return BigInt(ch.charCodeAt(0) - 48);
  const lower = ch.toLowerCase();
  if (lower >= 'a' && lower <= 'z') return BigInt(lower.charCodeAt(0) - 97 + 10);
  throw new Error("Invalid digit char: " + ch);
}

// parse a string representation in arbitrary base (base <= 36) to BigInt
function parseBigIntInBase(str, base) {
  const b = BigInt(base);
  let acc = 0n;
  for (let i = 0; i < str.length; i++) {
    const d = charToDigit(str[i]);
    if (d >= b) throw new Error(`Digit ${str[i]} >= base ${base}`);
    acc = acc * b + d;
  }
  return acc;
}

// gcd for BigInt
function bigGcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

// Fraction class using BigInt
class Fraction {
  constructor(numer, denom = 1n) {
    if (denom === 0n) throw new Error("Denominator cannot be 0");
    if (denom < 0n) { numer = -numer; denom = -denom; }
    const g = bigGcd(numer, denom);
    this.n = numer / g;
    this.d = denom / g;
  }

  static fromBigInt(n) { return new Fraction(n, 1n); }

  add(other) {
    return new Fraction(this.n * other.d + other.n * this.d, this.d * other.d);
  }

  mul(other) {
    return new Fraction(this.n * other.n, this.d * other.d);
  }

  asIntegerIfWhole() {
    if (this.d === 1n) return { whole: true, value: this.n };
    if (this.n % this.d === 0n) return { whole: true, value: this.n / this.d };
    return { whole: false, frac: this };
  }

  toString() {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }
}

// Lagrange interpolation at x=0
function lagrangeAtZeroFraction(pointsSubset) {
  let res = new Fraction(0n, 1n);
  const n = pointsSubset.length;
  for (let i = 0; i < n; i++) {
    const xi = BigInt(pointsSubset[i][0]);
    const yi = Fraction.fromBigInt(pointsSubset[i][1]);

    let Li = new Fraction(1n, 1n);
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const xj = BigInt(pointsSubset[j][0]);
      Li = Li.mul(new Fraction(-xj, xi - xj));
    }

    res = res.add(yi.mul(Li));
  }
  return res;
}

// Main function: process a file and return c
function processFile(filename) {
  const raw = fs.readFileSync(filename, "utf8");
  const data = JSON.parse(raw);

  let points = [];
  for (const key of Object.keys(data)) {
    if (key === "keys") continue;
    const x = Number(key);
    const base = Number(data[key].base);
    const valStr = data[key].value;
    const yBig = parseBigIntInBase(valStr, base);
    points.push([x, yBig]);
  }

  points.sort((a, b) => a[0] - b[0]);

  const k = data.keys.k;
  if (points.length < k) {
    throw new Error(`Not enough points in ${filename}: have ${points.length}, need k=${k}`);
  }

  const subset = points.slice(0, k);
  const cFrac = lagrangeAtZeroFraction(subset);
  const cCheck = cFrac.asIntegerIfWhole();

  if (cCheck.whole) {
    return cCheck.value.toString();
  } else {
    return cFrac.toString();
  }
}

// Entry point
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node index.js file1.json file2.json ...");
  process.exit(1);
}

for (const f of files) {
  try {
    const c = processFile(f);
    console.log(`${f}: ${c}`);
  } catch (err) {
    console.error(`${f}: ERROR - ${err.message}`);
  }
}
