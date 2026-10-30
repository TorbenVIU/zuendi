import type { SignatureAlgorithm, SignatureEncoding } from "../types";

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const toBase64 = (bytes: Uint8Array): string =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));

// Matches `printf '%s' "$BODY" | openssl dgst -<alg> -hmac "$SECRET"`: the
// secret is used as raw UTF-8 bytes, not decoded from hex/base64.
export const hmac = async (
  algorithm: SignatureAlgorithm,
  secret: string,
  payload: string,
  encoding: SignatureEncoding,
): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
  );
  return encoding === "base64" ? toBase64(signature) : toHex(signature);
};
