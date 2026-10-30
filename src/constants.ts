import type { HttpMethod, SignatureAlgorithm } from "./types";

export const STORAGE_KEY = "APP_STATE_V1";
export const SAVE_DEBOUNCE_MS = 300;
export const REQUEST_TIMEOUT_MS = 30_000;

export const HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

export const BODYLESS_METHODS: ReadonlySet<HttpMethod> = new Set([
  "GET",
  "HEAD",
]);

export const SIGNATURE_ALGORITHMS: SignatureAlgorithm[] = [
  "SHA-1",
  "SHA-256",
  "SHA-384",
  "SHA-512",
];

export const BODY_PLACEHOLDER = "{{$body}}";

export const SECRET_NAME_PATTERN = /secret|token|key|pass|pwd|auth/i;
