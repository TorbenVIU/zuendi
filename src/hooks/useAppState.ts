import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState } from "../types";
import { SAVE_DEBOUNCE_MS, STORAGE_KEY } from "../constants";
import { isAppState, loadState } from "../storage/loadState";
import { saveState } from "../storage/saveState";

export const useAppState = () => {
  const [state, setState] = useState<AppState | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<AppState | null>(null);

  useEffect(() => {
    loadState().then((loaded) => {
      setState(loaded);
      stateRef.current = loaded;
    });
  }, []);

  // Side panel and tab can be open at the same time; adopt the other page's
  // writes. The equality check stops our own save from echoing back.
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    const handleChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      const next: unknown = changes[STORAGE_KEY]?.newValue;
      if (area !== "local" || !isAppState(next)) return;
      if (JSON.stringify(next) === JSON.stringify(stateRef.current)) return;
      stateRef.current = next;
      setState(next);
    };
    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!state) return;
    stateRef.current = state;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveState(state);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state]);

  const updateState = useCallback(
    (updater: (prev: AppState) => AppState) => {
      setState((prev) => {
        if (!prev) return prev;
        return updater(prev);
      });
    },
    [],
  );

  return { state, updateState, isLoading: state === null };
};
