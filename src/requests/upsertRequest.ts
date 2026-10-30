import type { AppState, SavedRequest } from "../types";

export const upsertRequestInState = (
  prev: AppState,
  request: SavedRequest,
): AppState => {
  const exists = prev.requests.some((r) => r.id === request.id);
  return {
    ...prev,
    requests: exists
      ? prev.requests.map((r) => (r.id === request.id ? request : r))
      : [...prev.requests, request],
  };
};
