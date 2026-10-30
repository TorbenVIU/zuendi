import { useState, type FormEvent } from "react";
import type {
  HeaderEntry,
  HttpMethod,
  SavedRequest,
  SignatureAlgorithm,
  SignatureConfig,
  SignatureEncoding,
} from "../types";
import {
  BODYLESS_METHODS,
  HTTP_METHODS,
  SIGNATURE_ALGORITHMS,
} from "../constants";

type Props = {
  initial: SavedRequest;
  isNew: boolean;
  warnings: string[];
  onSave: (request: SavedRequest) => void;
  onCancel: () => void;
  onDelete: (request: SavedRequest) => void;
  onDuplicate: (request: SavedRequest) => void;
};

export const RequestEditor = ({
  initial,
  isNew,
  warnings,
  onSave,
  onCancel,
  onDelete,
  onDuplicate,
}: Props) => {
  const [draft, setDraft] = useState(initial);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const { signature } = draft;

  const update = (patch: Partial<SavedRequest>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const updateSignature = (patch: Partial<SignatureConfig>) =>
    setDraft((prev) => ({ ...prev, signature: { ...prev.signature, ...patch } }));

  const updateHeader = (index: number, patch: Partial<HeaderEntry>) =>
    setDraft((prev) => ({
      ...prev,
      headers: prev.headers.map((header, i) =>
        i === index ? { ...header, ...patch } : header,
      ),
    }));

  const formatBody = () => {
    try {
      update({ body: JSON.stringify(JSON.parse(draft.body), null, 2) });
      setBodyError(null);
    } catch {
      setBodyError("Der Body ist kein gültiges JSON.");
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      ...draft,
      name: draft.name.trim() || "Ohne Namen",
      url: draft.url.trim(),
      headers: draft.headers.filter(
        (header) => header.key.trim() || header.value.trim(),
      ),
    });
  };

  const signatureHeaderDuplicate =
    signature.enabled &&
    signature.header.trim() !== "" &&
    draft.headers.some(
      (header) =>
        header.key.trim().toLowerCase() ===
        signature.header.trim().toLowerCase(),
    );

  return (
    <form className="view editor" onSubmit={handleSubmit}>
      <h2 className="view__title">
        {isNew ? "Neuer Request" : "Request bearbeiten"}
      </h2>

      {warnings.length > 0 && (
        <div className="notice notice--warn">
          <strong>Hinweise zum Import</strong>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <label className="field">
        <span className="field__label">Name</span>
        <input
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </label>

      <div className="field-row field-row--method">
        <label className="field">
          <span className="field__label">Methode</span>
          <select
            value={draft.method}
            onChange={(e) => update({ method: e.target.value as HttpMethod })}
          >
            {HTTP_METHODS.map((method) => (
              <option key={method}>{method}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">URL</span>
          <input
            className="mono"
            required
            placeholder="https://example.com/api/webhook"
            value={draft.url}
            onChange={(e) => update({ url: e.target.value })}
          />
        </label>
      </div>

      <fieldset className="fieldset">
        <legend className="field__label">Header</legend>
        {draft.headers.map((header, index) => (
          <div key={index} className="header-row">
            <input
              type="checkbox"
              title="Aktiv"
              checked={header.enabled}
              onChange={(e) => updateHeader(index, { enabled: e.target.checked })}
            />
            <input
              className="mono"
              placeholder="Name"
              value={header.key}
              onChange={(e) => updateHeader(index, { key: e.target.value })}
            />
            <input
              className="mono"
              placeholder="Wert"
              value={header.value}
              onChange={(e) => updateHeader(index, { value: e.target.value })}
            />
            <button
              type="button"
              className="button button--ghost button--small"
              title="Entfernen"
              onClick={() =>
                update({ headers: draft.headers.filter((_, i) => i !== index) })
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() =>
            update({
              headers: [...draft.headers, { key: "", value: "", enabled: true }],
            })
          }
        >
          + Header
        </button>
      </fieldset>

      <label className="field">
        <span className="field__label field__label--split">
          Body
          <button
            type="button"
            className="button--link"
            onClick={formatBody}
          >
            JSON formatieren
          </button>
        </span>
        <textarea
          className="mono"
          rows={8}
          spellCheck={false}
          value={draft.body}
          onChange={(e) => update({ body: e.target.value })}
        />
        {bodyError && <small className="field__error">{bodyError}</small>}
        {BODYLESS_METHODS.has(draft.method) && draft.body && (
          <small className="field__hint">
            {draft.method} sendet keinen Body – er wird ignoriert.
          </small>
        )}
      </label>

      <fieldset className="fieldset">
        <legend>
          <label className="check">
            <input
              type="checkbox"
              checked={signature.enabled}
              onChange={(e) => updateSignature({ enabled: e.target.checked })}
            />
            HMAC-Signatur mitsenden
          </label>
        </legend>
        {signature.enabled && (
          <>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Algorithmus</span>
                <select
                  value={signature.algorithm}
                  onChange={(e) =>
                    updateSignature({
                      algorithm: e.target.value as SignatureAlgorithm,
                    })
                  }
                >
                  {SIGNATURE_ALGORITHMS.map((algorithm) => (
                    <option key={algorithm} value={algorithm}>
                      HMAC-{algorithm}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Encoding</span>
                <select
                  value={signature.encoding}
                  onChange={(e) =>
                    updateSignature({
                      encoding: e.target.value as SignatureEncoding,
                    })
                  }
                >
                  <option value="hex">Hex</option>
                  <option value="base64">Base64</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span className="field__label">Secret</span>
              <input
                className="mono"
                placeholder="{{SECRET}}"
                value={signature.secret}
                onChange={(e) => updateSignature({ secret: e.target.value })}
              />
              <small className="field__hint">
                Am besten als Variable referenzieren, z.B. {"{{SECRET}}"}.
              </small>
            </label>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Header</span>
                <input
                  className="mono"
                  required
                  placeholder="webhook-signature"
                  value={signature.header}
                  onChange={(e) => updateSignature({ header: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Präfix</span>
                <input
                  className="mono"
                  placeholder="z.B. sha256="
                  value={signature.prefix}
                  onChange={(e) => updateSignature({ prefix: e.target.value })}
                />
              </label>
            </div>
            {signatureHeaderDuplicate && (
              <small className="field__error">
                Dieser Header ist oben bereits gesetzt und würde doppelt
                gesendet.
              </small>
            )}
            <label className="field">
              <span className="field__label">Signierter Inhalt</span>
              <textarea
                className="mono"
                rows={2}
                spellCheck={false}
                value={signature.payload}
                onChange={(e) => updateSignature({ payload: e.target.value })}
              />
              <small className="field__hint">
                {"{{$body}}"} = gesendeter Body. Auch {"{{$timestamp}}"} und
                Variablen sind möglich, z.B. {"{{$timestamp}}.{{$body}}"}.
              </small>
            </label>
          </>
        )}
      </fieldset>

      <label className="check">
        <input
          type="checkbox"
          checked={draft.confirm}
          onChange={(e) => update({ confirm: e.target.checked })}
        />
        Vor dem Ausführen nachfragen
      </label>

      <div className="view__actions view__actions--footer">
        <button type="submit" className="button button--primary">
          Speichern
        </button>
        <button type="button" className="button" onClick={onCancel}>
          Abbrechen
        </button>
        {!isNew && (
          <>
            <span className="view__spacer" />
            <button
              type="button"
              className="button button--ghost"
              onClick={() => onDuplicate(draft)}
            >
              Duplizieren
            </button>
            <button
              type="button"
              className="button button--ghost button--danger-text"
              onClick={() => onDelete(draft)}
            >
              Löschen
            </button>
          </>
        )}
      </div>
    </form>
  );
};
