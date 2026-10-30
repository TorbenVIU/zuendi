import { useState } from "react";
import type { RunResult, SentRequest } from "../types";
import { StatusPill } from "./StatusPill";

type Props = {
  result: RunResult;
  onBack: () => void;
  onRerun?: () => void;
};

const prettyBody = (body: string): string => {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
};

const formatBytes = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

const formatSent = (sent: SentRequest): string =>
  [
    `${sent.method} ${sent.url}`,
    ...sent.headers.map(([key, value]) => `${key}: ${value}`),
    ...(sent.body === undefined ? [] : ["", sent.body]),
  ].join("\n");

export const ResponseView = ({ result, onBack, onRerun }: Props) => {
  const [copied, setCopied] = useState(false);
  const body = result.body ?? "";

  const copyBody = async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="view">
      <div className="view__actions">
        <button className="button button--ghost" onClick={onBack}>
          ← Zurück
        </button>
        <span className="view__spacer" />
        {onRerun && (
          <button className="button button--run" onClick={onRerun}>
            ▶ Nochmals
          </button>
        )}
      </div>

      <h2 className="view__title">{result.name}</h2>

      <div className="status-line">
        <StatusPill result={result} />
        {result.durationMs !== null && <span>{result.durationMs} ms</span>}
        {result.body !== null && (
          <span>{formatBytes(new Blob([result.body]).size)}</span>
        )}
        <span>{new Date(result.startedAt).toLocaleTimeString("de-CH")}</span>
      </div>

      {result.error && <div className="notice notice--error">{result.error}</div>}

      {result.body !== null && (
        <>
          <div className="section-head">
            <h3>Body</h3>
            {body && (
              <button className="button--link" onClick={copyBody}>
                {copied ? "Kopiert ✓" : "Kopieren"}
              </button>
            )}
          </div>
          {body ? (
            <pre className="code">{prettyBody(body)}</pre>
          ) : (
            <p className="empty">(leer)</p>
          )}
        </>
      )}

      {result.headers.length > 0 && (
        <details className="details">
          <summary>Response-Header ({result.headers.length})</summary>
          <table className="header-table">
            <tbody>
              {result.headers.map(([key, value], index) => (
                <tr key={`${key}-${index}`}>
                  <th>{key}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {result.sent && (
        <details className="details">
          <summary>Gesendeter Request</summary>
          <pre className="code code--small">{formatSent(result.sent)}</pre>
        </details>
      )}
    </section>
  );
};
