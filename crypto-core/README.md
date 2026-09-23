# crypto-core - canonical crypto contract

Single source of truth for the cryptographic primitives CloudCast's server, web
client, and Android client must all implement **identically**. If one platform
produces a wrapped key the others can't open, the parameters here have drifted.

## What's here

- **`sodiumcrypto.ts`** - primitive layer over libsodium: X25519 keypairs, Argon2id
  vault-key derivation, BLAKE2b recovery-key derivation, secretbox, anonymous sealed box.
- **`userkeys.ts`** - per-user key material: `createUserKeys` (client-side), unlock from
  password or recovery code, change-password re-wrap, and DEK wrap/unwrap for sharing.
  No server-held key; file DEKs are sealed directly to the user's public key.
- **`cryptocore.test.ts`** - round-trip + negative tests, and regenerates the interop vectors.
- **`test-vectors.json`** - fixed inputs → expected hex. The gate the web + Android ports
  must reproduce byte-for-byte.
- **`srpvectors.mjs` / `srp-vectors.json`** - the same gate for SRP-6a, generated from the
  server's own library so a client that disagrees fails before it ships.

## Fixed parameters (do not change without re-wrapping all users)

- Argon2id: `opslimit=3`, `memlimit=67108864` (64 MiB), `ALG_ARGON2ID13`, 16-byte salt, 32-byte key.
- Identity keypair: X25519 (`crypto_box`).
- DEK wrapping / sharing: anonymous sealed box (`crypto_box_seal`), 80 bytes for a 32-byte DEK.
- Metadata/vault symmetric: `crypto_secretbox` (XSalsa20-Poly1305), 24-byte nonce, layout `nonce||ct`.
- Recovery vault key: `crypto_generichash` (BLAKE2b, 32 bytes) of the full-entropy recovery key.

## Run

```
npm install
npm test
```

Expected: all checks PASS and `test-vectors.json` regenerated unchanged.

## Interop discipline

Libraries: Node/web use `libsodium-wrappers-sumo`; Android uses `lazysodium-android`.
When porting to web or Android, load `test-vectors.json`, feed the `inputs`, and assert the
outputs equal `expected`. Only after that gate passes are wrapped keys guaranteed portable.
