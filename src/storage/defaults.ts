import type { AppState, SavedRequest, SignatureConfig } from "../types";
import { BODY_PLACEHOLDER } from "../constants";

export const createId = (): string => crypto.randomUUID();

export const createDefaultSignature = (): SignatureConfig => ({
  enabled: false,
  algorithm: "SHA-256",
  encoding: "hex",
  secret: "",
  header: "",
  prefix: "",
  payload: BODY_PLACEHOLDER,
});

export const createRequest = (
  overrides: Partial<SavedRequest> = {},
): SavedRequest => ({
  id: createId(),
  name: "Neuer Request",
  method: "GET",
  url: "",
  headers: [],
  body: "",
  confirm: true,
  ...overrides,
  signature: { ...createDefaultSignature(), ...overrides.signature },
});

export const createDefaultState = (): AppState => ({
  version: 1,
  requests: [],
  variables: [],
});
