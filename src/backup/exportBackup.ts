import type { AppState, BackupFile } from "../types";

export const exportBackup = (appState: AppState, includeSecrets: boolean) => {
  const backup: BackupFile = {
    exportedAt: Date.now(),
    appState: includeSecrets
      ? appState
      : {
          ...appState,
          variables: appState.variables.map((variable) =>
            variable.secret ? { ...variable, value: "" } : variable,
          ),
        },
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `zuendi-backup-${date}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};
