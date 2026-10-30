import { useRef } from "react";
import type { RunResult, SavedRequest } from "../types";
import { MethodBadge } from "./MethodBadge";
import { StatusPill } from "./StatusPill";

type Props = {
  requests: SavedRequest[];
  results: Record<string, RunResult>;
  onNew: () => void;
  onImportCurl: () => void;
  onRun: (request: SavedRequest) => void;
  onEdit: (request: SavedRequest) => void;
  onMove: (id: string, offset: -1 | 1) => void;
  onShowResult: (result: RunResult) => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
};

export const RequestList = ({
  requests,
  results,
  onNew,
  onImportCurl,
  onRun,
  onEdit,
  onMove,
  onShowResult,
  onExport,
  onImportFile,
}: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="view">
      <div className="view__actions">
        <button className="button button--primary" onClick={onNew}>
          + Neuer Request
        </button>
        <button className="button" onClick={onImportCurl}>
          cURL importieren
        </button>
      </div>

      {requests.length === 0 ? (
        <p className="empty">
          Noch keine Requests. Leg einen an oder importiere einen
          cURL-Befehl.
        </p>
      ) : (
        <ul className="request-list">
          {requests.map((request, index) => {
            const result = results[request.id];
            return (
              <li key={request.id} className="request-card">
                <div className="request-card__main">
                  <div className="request-card__name">{request.name}</div>
                  <div className="request-card__url">
                    <MethodBadge method={request.method} />
                    <span className="mono">{request.url}</span>
                  </div>
                </div>
                <div className="request-card__actions">
                  {result && (
                    <button
                      className="button button--ghost button--small"
                      title="Letzte Antwort anzeigen"
                      onClick={() => onShowResult(result)}
                    >
                      <StatusPill result={result} />
                    </button>
                  )}
                  <span className="request-card__spacer" />
                  <button
                    className="button button--ghost button--small"
                    title="Nach oben"
                    disabled={index === 0}
                    onClick={() => onMove(request.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="button button--ghost button--small"
                    title="Nach unten"
                    disabled={index === requests.length - 1}
                    onClick={() => onMove(request.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="button button--small"
                    onClick={() => onEdit(request)}
                  >
                    Bearbeiten
                  </button>
                  <button
                    className="button button--run button--small"
                    onClick={() => onRun(request)}
                  >
                    ▶ Ausführen
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="data-tools">
        <button className="button--link" onClick={onExport}>
          Backup exportieren
        </button>
        <span aria-hidden="true">·</span>
        <button
          className="button--link"
          onClick={() => fileInputRef.current?.click()}
        >
          Backup importieren
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportFile(file);
            event.target.value = "";
          }}
        />
      </footer>
    </section>
  );
};
