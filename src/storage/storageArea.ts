export type StorageArea = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
};

const extensionArea: StorageArea = {
  get: (key) =>
    new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => resolve(result[key]));
    }),
  set: (key, value) =>
    new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    }),
};

// Outside the packaged extension (Vite dev server, `npm run preview`) there is no
// chrome.storage, so persistence falls back to localStorage. Same async contract,
// different backend — callers cannot tell the difference.
const localStorageArea: StorageArea = {
  get: (key) =>
    Promise.resolve().then(() => {
      const raw = localStorage.getItem(key);
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return undefined;
      }
    }),
  set: (key, value) =>
    Promise.resolve().then(() => {
      localStorage.setItem(key, JSON.stringify(value));
    }),
};

const hasExtensionStorage = (): boolean =>
  typeof chrome !== "undefined" && chrome.storage?.local !== undefined;

const resolveArea = (): StorageArea => {
  if (hasExtensionStorage()) return extensionArea;
  // Loud on purpose: in the packaged extension this means the `storage`
  // permission is gone, and requests would silently land in the wrong place.
  console.warn(
    "chrome.storage unavailable — persisting to localStorage instead.",
  );
  return localStorageArea;
};

export const storageArea: StorageArea = resolveArea();
