import { useEffect, useState } from "react";
import type { RunResult, SavedRequest } from "./types";
import { BODYLESS_METHODS } from "./constants";
import { useAppState } from "./hooks/useAppState";
import { createId, createRequest } from "./storage/defaults";
import { executeRequest } from "./runner/executeRequest";
import type { CurlImport as ParsedCurl } from "./curl/parseCurl";
import { moveRequestInState } from "./requests/moveRequest";
import { upsertRequestInState } from "./requests/upsertRequest";
import { addMissingVariablesInState } from "./variables/addMissingVariables";
import { exportBackup } from "./backup/exportBackup";
import { mergeBackup, parseBackupFile } from "./backup/importBackup";
import { Toolbar, type Section } from "./components/Toolbar";
import { RequestList } from "./components/RequestList";
import { RequestEditor } from "./components/RequestEditor";
import { CurlImport } from "./components/CurlImport";
import { VariablesView } from "./components/VariablesView";
import { ResponseView } from "./components/ResponseView";
import { MethodBadge } from "./components/MethodBadge";
import {
  ConfirmDialog,
  type ConfirmOptions,
} from "./components/ConfirmDialog";
import "./styles/app.scss";

type View =
  | { name: "list" }
  | {
      name: "edit";
      request: SavedRequest;
      isNew: boolean;
      warnings: string[];
    }
  | { name: "import" }
  | { name: "variables" }
  | { name: "running"; requestName: string }
  | { name: "response"; result: RunResult };

type Toast = { kind: "ok" | "error"; text: string };

const TOAST_MS = 3500;
const CONFIRM_BODY_PREVIEW = 600;

const App = () => {
  const { state, updateState, isLoading } = useAppState();
  const [view, setView] = useState<View>({ name: "list" });
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timeout);
  }, [toast]);

  if (isLoading || !state) {
    return <div className="app app--loading">Lädt …</div>;
  }

  const section: Section | null =
    view.name === "variables" ? "variables" : view.name === "running" ? null : "requests";

  const showList = () => setView({ name: "list" });

  const runNow = async (request: SavedRequest) => {
    setView({ name: "running", requestName: request.name });
    const result = await executeRequest(request, state.variables);
    setResults((prev) => ({ ...prev, [request.id]: result }));
    setView({ name: "response", result });
  };

  const handleRun = (request: SavedRequest) => {
    if (!request.confirm) {
      runNow(request);
      return;
    }
    const sendsBody = request.body && !BODYLESS_METHODS.has(request.method);
    setConfirm({
      title: "Request ausführen?",
      confirmLabel: "▶ Ausführen",
      onConfirm: () => runNow(request),
      body: (
        <>
          <p className="dialog__name">{request.name}</p>
          <p className="dialog__url">
            <MethodBadge method={request.method} />
            <span className="mono">{request.url}</span>
          </p>
          {request.signature.enabled && (
            <p className="field__hint">
              Signiert mit HMAC-{request.signature.algorithm} im Header «
              {request.signature.header}»
            </p>
          )}
          {sendsBody && (
            <pre className="code code--small">
              {request.body.length > CONFIRM_BODY_PREVIEW
                ? `${request.body.slice(0, CONFIRM_BODY_PREVIEW)} …`
                : request.body}
            </pre>
          )}
        </>
      ),
    });
  };

  const handleSave = (request: SavedRequest) => {
    updateState((prev) => upsertRequestInState(prev, request));
    setToast({ kind: "ok", text: "Gespeichert" });
    showList();
  };

  const handleDelete = (request: SavedRequest) =>
    setConfirm({
      title: "Request löschen?",
      body: <p>«{request.name}» wird endgültig gelöscht.</p>,
      confirmLabel: "Löschen",
      danger: true,
      onConfirm: () => {
        updateState((prev) => ({
          ...prev,
          requests: prev.requests.filter((r) => r.id !== request.id),
        }));
        showList();
      },
    });

  const handleCurlParsed = ({ request, variables, warnings }: ParsedCurl) => {
    const added = variables.filter(
      (variable) => !state.variables.some((v) => v.key === variable.key),
    );
    updateState((prev) => addMissingVariablesInState(prev, variables));
    const needsValue = added.filter((variable) => !variable.value);
    setView({
      name: "edit",
      request: createRequest(request),
      isNew: true,
      warnings: needsValue.length
        ? [
            ...warnings,
            `Neue Variable(n) ${needsValue.map((v) => v.key).join(", ")} angelegt – Wert unter «Variablen» eintragen.`,
          ]
        : warnings,
    });
  };

  const handleExport = () =>
    setConfirm({
      title: "Backup exportieren",
      body: (
        <p>
          Sollen die Werte von Secret-Variablen mit exportiert werden? Die
          Datei liegt danach unverschlüsselt in deinen Downloads.
        </p>
      ),
      confirmLabel: "Ohne Secrets",
      secondaryLabel: "Mit Secrets",
      onConfirm: () => exportBackup(state, false),
      onSecondary: () => exportBackup(state, true),
    });

  const handleImportFile = async (file: File) => {
    const imported = await parseBackupFile(file);
    if (!imported) {
      setToast({ kind: "error", text: "Das ist keine gültige Zündi-Backup-Datei." });
      return;
    }
    updateState((prev) => mergeBackup(prev, imported));
    setToast({
      kind: "ok",
      text: `${imported.requests.length} Request(s) importiert`,
    });
  };

  const renderView = () => {
    switch (view.name) {
      case "list":
        return (
          <RequestList
            requests={state.requests}
            results={results}
            onNew={() =>
              setView({ name: "edit", request: createRequest(), isNew: true, warnings: [] })
            }
            onImportCurl={() => setView({ name: "import" })}
            onRun={handleRun}
            onEdit={(request) =>
              setView({ name: "edit", request, isNew: false, warnings: [] })
            }
            onMove={(id, offset) =>
              updateState((prev) => moveRequestInState(prev, id, offset))
            }
            onShowResult={(result) => setView({ name: "response", result })}
            onExport={handleExport}
            onImportFile={handleImportFile}
          />
        );
      case "edit":
        return (
          <RequestEditor
            key={view.request.id}
            initial={view.request}
            isNew={view.isNew}
            warnings={view.warnings}
            onSave={handleSave}
            onCancel={showList}
            onDelete={handleDelete}
            onDuplicate={(request) =>
              setView({
                name: "edit",
                request: { ...request, id: createId(), name: `${request.name} (Kopie)` },
                isNew: true,
                warnings: [],
              })
            }
          />
        );
      case "import":
        return <CurlImport onParsed={handleCurlParsed} onCancel={showList} />;
      case "variables":
        return (
          <VariablesView
            variables={state.variables}
            onSave={(variables) => {
              updateState((prev) => ({ ...prev, variables }));
              setToast({ kind: "ok", text: "Variablen gespeichert" });
            }}
          />
        );
      case "running":
        return (
          <div className="running">
            <span className="running__spinner" />
            {view.requestName} läuft …
          </div>
        );
      case "response": {
        const request = state.requests.find((r) => r.id === view.result.requestId);
        return (
          <ResponseView
            result={view.result}
            onBack={showList}
            onRerun={request && (() => handleRun(request))}
          />
        );
      }
    }
  };

  return (
    <div className="app">
      <Toolbar
        section={section}
        onNavigate={(next) =>
          setView(next === "variables" ? { name: "variables" } : { name: "list" })
        }
      />
      <main className="app__main">{renderView()}</main>
      {toast && <div className={`toast toast--${toast.kind}`}>{toast.text}</div>}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
};

export default App;
