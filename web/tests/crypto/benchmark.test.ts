import { describe, it, expect, beforeAll } from "vitest";
import * as cc from "../../src/features/crypto/sodium";
import { encryptFile, decryptFile, decryptRange } from "../../src/features/crypto/filecrypto";

const rows: string[] = [];
const record = (what: string, value: string) => rows.push(`  ${what.padEnd(46)} ${value}`);

function ms(): number { return Number(process.hrtime.bigint() / 1000n) / 1000; }
const fmt = (n: number, d = 1) => n.toFixed(d);

function fixture(bytes: number): Uint8Array {
  const b = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) b[i] = i & 0xff;
  return b;
}

beforeAll(async () => { await cc.ready(); });

describe("cost of the key derivation", () => {
  it("Argon2id at the shipped parameters", () => {
    const salt = cc.generateSalt();
    const runs = 3;
    const t0 = ms();
    for (let i = 0; i < runs; i++) cc.deriveVaultKey("example-vector-password", salt);
    const each = (ms() - t0) / runs;
    record("Argon2id (ops 3, mem 64 MiB)", `${fmt(each)} ms per derivation`);
    expect(each).toBeGreaterThan(1);
    expect(each).toBeLessThan(10000);
  });

  it("sealing and opening a file key", () => {
    const kp = cc.generateKeypair();
    const dek = cc.generateDek();
    const runs = 200;
    let t0 = ms();
    for (let i = 0; i < runs; i++) cc.sealTo(dek, kp.publicKey);
    const seal = (ms() - t0) / runs;
    const wrapped = cc.sealTo(dek, kp.publicKey);
    t0 = ms();
    for (let i = 0; i < runs; i++) cc.sealOpen(wrapped, kp.publicKey, kp.privateKey);
    const open = (ms() - t0) / runs;
    record("crypto_box_seal (seal / open)", `${fmt(seal, 2)} / ${fmt(open, 2)} ms`);
    expect(seal).toBeLessThan(100);
  });
});

describe("throughput of the container", () => {
  it.each([[1], [4]])("encrypts and decrypts a %i MiB file", async (mib) => {
    const plain = fixture(mib * 1024 * 1024);
    const dek = cc.generateDek();

    let t0 = ms();
    const ct = await encryptFile(plain, dek);
    const enc = ms() - t0;

    t0 = ms();
    const back = await decryptFile(ct, dek);
    const dec = ms() - t0;

    expect(back).toEqual(plain);
    record(`CCE3 ${mib} MiB - encrypt`, `${fmt(enc)} ms (${fmt((mib * 1000) / enc)} MiB/s)`);
    record(`CCE3 ${mib} MiB - decrypt`, `${fmt(dec)} ms (${fmt((mib * 1000) / dec)} MiB/s)`);
  }, 120_000);

  it("costs 16 bytes of tag per 256 KiB chunk", async () => {
    const mib = 4;
    const plain = fixture(mib * 1024 * 1024);
    const ct = await encryptFile(plain, cc.generateDek());
    const overhead = ct.length - plain.length;
    const chunks = Math.ceil(plain.length / (256 * 1024));
    expect(overhead).toBe(23 + chunks * 16);
    record(`Overhead on ${mib} MiB (${chunks} chunks)`,
      `${overhead} B (${fmt((overhead / plain.length) * 100, 4)} %)`);
  }, 120_000);

  it("reads a range far more cheaply than the whole file", async () => {
    const plain = fixture(8 * 1024 * 1024);
    const dek = cc.generateDek();
    const ct = await encryptFile(plain, dek);

    let t0 = ms();
    await decryptFile(ct, dek);
    const whole = ms() - t0;

    const start = 4 * 1024 * 1024;
    t0 = ms();
    const part = await decryptRange(ct, dek, start, start + 1023);
    const range = ms() - t0;

    expect(part).toEqual(plain.subarray(start, start + 1024));
    record("Decrypt: whole 8 MiB file / 1 KiB range",
      `${fmt(whole)} ms / ${fmt(range, 2)} ms`);
    expect(range).toBeLessThan(whole);
  }, 120_000);
});

describe("summary", () => {
  it("prints the measured table", () => {
    console.log(`\n  ── Measured values (CloudCast crypto, web client) ──\n${rows.join("\n")}\n`);
    expect(rows.length).toBeGreaterThan(0);
  });
});
