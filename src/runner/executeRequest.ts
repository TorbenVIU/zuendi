import type {
  RunResult,
  SavedRequest,
  SentRequest,
  Variable,
} from "../types";
import {
  BODY_PLACEHOLDER,
  BODYLESS_METHODS,
  REQUEST_TIMEOUT_MS,
} from "../constants";
import { createResolver } from "./resolveTemplate";
import { hmac } from "./hmac";

const MASK = "••••••";

type PreparedRequest = SentRequest & { secrets: string[] };

const prepareRequest = async (
  request: SavedRequest,
  variables: Variable[],
): Promise<PreparedRequest> => {
  const resolve = createResolver(variables);

  const url = resolve(request.url).trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Die URL muss mit http:// oder https:// beginnen.");
  }

  const headers = request.headers
    .filter((header) => header.enabled && header.key.trim())
    .map((header): [string, string] => [
      resolve(header.key).trim(),
      resolve(header.value),
    ]);

  const body =
    BODYLESS_METHODS.has(request.method) || !request.body
      ? undefined
      : resolve(request.body);

  const secrets = variables
    .filter((variable) => variable.secret && variable.value)
    .map((variable) => variable.value);

  const { signature } = request;
  if (signature.enabled) {
    if (!signature.header.trim()) {
      throw new Error("Signatur: Der Header-Name fehlt.");
    }
    const secret = resolve(signature.secret);
    if (!secret) throw new Error("Signatur: Das Secret ist leer.");
    secrets.push(secret);

    const payload = resolve(signature.payload || BODY_PLACEHOLDER, {
      $body: body ?? "",
    });
    const value = await hmac(
      signature.algorithm,
      secret,
      payload,
      signature.encoding,
    );
    headers.push([signature.header.trim(), resolve(signature.prefix) + value]);
  }

  return { method: request.method, url, headers, body, secrets };
};

const createMasker = (secrets: string[]) => {
  // Very short values would mask random substrings all over the output.
  const sorted = secrets
    .filter((secret) => secret.length >= 4)
    .sort((a, b) => b.length - a.length);
  return (text: string) =>
    sorted.reduce((out, secret) => out.split(secret).join(MASK), text);
};

const describeFetchError = (error: unknown): string => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return `Timeout nach ${REQUEST_TIMEOUT_MS / 1000} s.`;
  }
  const message = error instanceof Error ? error.message : String(error);
  return message === "Failed to fetch"
    ? "Server nicht erreichbar (DNS, Zertifikat, Verbindung abgelehnt?)."
    : message;
};

export const executeRequest = async (
  request: SavedRequest,
  variables: Variable[],
): Promise<RunResult> => {
  const base: RunResult = {
    requestId: request.id,
    name: request.name,
    startedAt: Date.now(),
    durationMs: null,
    sent: null,
    error: null,
    status: null,
    statusText: "",
    headers: [],
    body: null,
  };

  let prepared: PreparedRequest;
  try {
    prepared = await prepareRequest(request, variables);
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const mask = createMasker(prepared.secrets);
  const sent: SentRequest = {
    method: prepared.method,
    url: mask(prepared.url),
    headers: prepared.headers.map(([key, value]) => [key, mask(value)]),
    body: prepared.body === undefined ? undefined : mask(prepared.body),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = performance.now();
  const elapsed = () => Math.round(performance.now() - startedAt);

  try {
    const response = await fetch(prepared.url, {
      method: prepared.method,
      headers: prepared.headers,
      body: prepared.body,
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.text();
    return {
      ...base,
      sent,
      durationMs: elapsed(),
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers],
      body,
    };
  } catch (error) {
    return {
      ...base,
      sent,
      durationMs: elapsed(),
      error: describeFetchError(error),
    };
  } finally {
    clearTimeout(timeout);
  }
};
