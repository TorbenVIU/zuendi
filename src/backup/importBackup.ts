import type { AppState } from "../types";
import { isAppState } from "../storage/loadState";
import { createRequest } from "../storage/defaults";

export const parseBackupFile = async (file: File): Promise<AppState | null> => {
  try {
    const parsed: unknown = JSON.parse(await file.text());
    const candidate =
      parsed && typeof parsed === "object" && "appState" in parsed
        ? parsed.appState
        : parsed;
    return isAppState(candidate) ? candidate : null;
  } catch {
    return null;
  }
};

// Requests are upserted by id; existing variable values are only overwritten
// by non-empty imports, so a backup without secrets keeps the local ones.
export const mergeBackup = (prev: AppState, imported: AppState): AppState => {
  const requests = [...prev.requests];
  for (const request of imported.requests) {
    const normalized = createRequest(request);
    const index = requests.findIndex((r) => r.id === normalized.id);
    if (index >= 0) requests[index] = normalized;
    else requests.push(normalized);
  }

  const variables = [...prev.variables];
  for (const variable of imported.variables) {
    const index = variables.findIndex((v) => v.key === variable.key);
    if (index < 0) variables.push(variable);
    else if (variable.value) variables[index] = variable;
  }

  return { ...prev, requests, variables };
};
