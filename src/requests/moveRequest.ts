import type { AppState } from "../types";

export const moveRequestInState = (
  prev: AppState,
  id: string,
  offset: -1 | 1,
): AppState => {
  const from = prev.requests.findIndex((request) => request.id === id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= prev.requests.length) return prev;
  const requests = [...prev.requests];
  [requests[from], requests[to]] = [requests[to], requests[from]];
  return { ...prev, requests };
};
