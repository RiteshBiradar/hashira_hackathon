const fs = require('fs');

// Utility functions
function gcdBigInt(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

// Rational number class
class Rational {
  constructor(num, den = 1n) {
    if (den === 0n) throw new Error('Denominator zero');
    if (den < 0n) { num = -num; den = -den; }
    const g = gcdBigInt(num, den);
    this.num = num / g;
    this.den = den / g;
  }

  static zero() { return new Rational(0n, 1n); }
  static fromBigInt(b) { return new Rational(BigInt(b), 1n); }

  isZero() { return this.num === 0n; }

  add(other) {
    const n = this.num * other.den + other.num * this.den;
    const d = this.den * other.den;
    return new Rational(n, d);
  }
  sub(other) {
    const n = this.num * other.den - other.num * this.den;
    const d = this.den * other.den;
    return new Rational(n, d);
  }
  mul(other) {
    return new Rational(this.num * other.num, this.den * other.den);
  }
  div(other) {
    if (other.num === 0n) throw new Error('Divide by zero');
    return new Rational(this.num * other.den, this.den * other.num);
  }

  neg() { return new Rational(-this.num, this.den); }

  toString() {
    if (this.den === 1n) return this.num.toString();
    return `${this.num.toString()}/${this.den.toString()}`;
  }

  toIntegerIfExact() {
    if (this.den === 1n) return this.num;
    if (this.num % this.den === 0n) return this.num / this.den;
    return null;
  }
}

// Helpers for parsing
function charToDigit(ch) {
  if ('0' <= ch && ch <= '9') return ch.charCodeAt(0) - 48;
  ch = ch.toLowerCase();
  if ('a' <= ch && ch <= 'z') return ch.charCodeAt(0) - 97 + 10;
  throw new Error('Invalid digit char: ' + ch);
}

function parseBigIntFromBase(str, base) {
  const b = BigInt(Number(base));
  let val = 0n;
  for (let ch of str.trim()) {
    if (ch === '_') continue;
    const d = BigInt(charToDigit(ch));
    if (d >= b) throw new Error(`Digit ${ch} >= base ${base}`);
    val = val * b + d;
  }
  return val;
}


function reconstructAtOrigin(dataSubset) {
  let total = Rational.zero();
  for (let i = 0; i < dataSubset.length; i++) {
    const xPos = dataSubset[i].x;
    const yVal = Rational.fromBigInt(dataSubset[i].y);

    let basisPoly = Rational.fromBigInt(1n);
    for (let j = 0; j < dataSubset.length; j++) {
      if (j === i) continue;
      const xOther = dataSubset[j].x;
      const numerator = new Rational(-xOther, 1n);
      const denominator = new Rational(xPos - xOther, 1n);
      basisPoly = basisPoly.mul(numerator.div(denominator));
    }
    total = total.add(yVal.mul(basisPoly));
  }
  return total;
}

 
function chooseCombos(arr, k) {
  const result = [];
  const n = arr.length;
  function backtrack(start, chosen) {
    if (chosen.length === k) {
      result.push(chosen.slice());
      return;
    }
    for (let i = start; i <= n - (k - chosen.length); i++) {
      chosen.push(arr[i]);
      backtrack(i + 1, chosen);
      chosen.pop();
    }
  }
  backtrack(0, []);
  return result;
}

// Main function to recover y
function recoverSecretFromJSON(testcase) {
  const { n, k } = testcase.keys;
  let shares = [];
  for (const key of Object.keys(testcase)) {
    if (key === 'keys') continue;
    if (!/^\d+$/.test(key)) continue;
    const xNum = Number(key);
    const base = testcase[key].base;
    const valueStr = testcase[key].value;
    const yBig = parseBigIntFromBase(valueStr, base);
    shares.push({ x: BigInt(xNum), y: yBig });
  }

  shares.sort((a, b) => (a.x < b.x ? -1 : a.x > b.x ? 1 : 0));

  if (shares.length < k) throw new Error('Not enough shares in input');

  const indices = shares.map((_, i) => i);
  const allCombos = chooseCombos(indices, k);

  const frequency = new Map();
  const comboTrace = new Map();

  for (const c of allCombos) {
    const subset = c.map(i => shares[i]);
    const candidate = reconstructAtOrigin(subset);
    const key = `${candidate.num.toString()}/${candidate.den.toString()}`;
    frequency.set(key, (frequency.get(key) || 0) + 1);
    if (!comboTrace.has(key)) comboTrace.set(key, subset);
  }

  let topKey = null;
  let topCount = -1;
  for (const [kstr, v] of frequency.entries()) {
    if (v > topCount) {
      topCount = v;
      topKey = kstr;
    }
  }

  if (!topKey) throw new Error('Could not determine consensus secret');

  const [numStr, denStr] = topKey.split('/');
  const secretFrac = new Rational(BigInt(numStr), BigInt(denStr));
  const intValue = secretFrac.toIntegerIfExact();
  if (intValue === null) {
    return { secretFraction: secretFrac, subset: comboTrace.get(topKey) };
  }
  return { secret: intValue, subset: comboTrace.get(topKey) };
}

// CLI runner
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node secret.js <testcase.json>');
    process.exit(1);
  }
  const filename = args[0];
  const raw = fs.readFileSync(filename, 'utf8');
  const testcase = JSON.parse(raw);

  try {
    const res = recoverSecretFromJSON(testcase);
    if (res.secret !== undefined) {
      console.log('Constant C value:', res.secret.toString());
    } else {
      console.log('Constant (rational):', res.secretFraction.toString());
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
