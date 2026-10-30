import type { AppState } from "../types";
import { STORAGE_KEY } from "../constants";
import { storageArea } from "./storageArea";

export const saveState = (state: AppState): Promise<void> =>
  storageArea.set(STORAGE_KEY, state);
