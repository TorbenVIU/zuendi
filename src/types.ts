export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type HeaderEntry = {
  key: string;
  value: string;
  enabled: boolean;
};

export type SignatureAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

export type SignatureEncoding = "hex" | "base64";

export type SignatureConfig = {
  enabled: boolean;
  algorithm: SignatureAlgorithm;
  encoding: SignatureEncoding;
  secret: string;
  header: string;
  prefix: string;
  payload: string;
};

export type SavedRequest = {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: HeaderEntry[];
  body: string;
  signature: SignatureConfig;
  confirm: boolean;
};

export type Variable = {
  key: string;
  value: string;
  secret: boolean;
};

export type AppState = {
  version: 1;
  requests: SavedRequest[];
  variables: Variable[];
};

export type SentRequest = {
  method: HttpMethod;
  url: string;
  headers: [string, string][];
  body: string | undefined;
};

export type RunResult = {
  requestId: string;
  name: string;
  startedAt: number;
  durationMs: number | null;
  sent: SentRequest | null;
  error: string | null;
  status: number | null;
  statusText: string;
  headers: [string, string][];
  body: string | null;
};

export type BackupFile = {
  exportedAt: number;
  appState: AppState;
};
