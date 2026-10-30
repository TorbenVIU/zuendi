import { useState, type FormEvent } from "react";
import type { Variable } from "../types";

type Props = {
  variables: Variable[];
  onSave: (variables: Variable[]) => void;
};

export const VariablesView = ({ variables, onSave }: Props) => {
  const [draft, setDraft] = useState(variables);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const updateVariable = (index: number, patch: Partial<Variable>) =>
    setDraft((prev) =>
      prev.map((variable, i) => (i === index ? { ...variable, ...patch } : variable)),
    );

  const toggleReveal = (index: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  const keys = draft.map((variable) => variable.key.trim()).filter(Boolean);
  const duplicateKeys = keys.filter((key, i) => keys.indexOf(key) !== i);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSave(
      draft
        .map((variable) => ({ ...variable, key: variable.key.trim() }))
        .filter((variable) => variable.key),
    );
  };

  return (
    <form className="view" onSubmit={handleSubmit}>
      <h2 className="view__title">Variablen</h2>
      <p className="field__hint">
        In URL, Headern, Body und Signatur-Secret als{" "}
        <code>{"{{NAME}}"}</code> verwenden. Eingebaut:{" "}
        <code>{"{{$timestamp}}"}</code>, <code>{"{{$timestampMs}}"}</code>,{" "}
        <code>{"{{$isoDate}}"}</code>, <code>{"{{$uuid}}"}</code>. Werte liegen
        unverschlüsselt in <code>chrome.storage.local</code> (nur auf diesem
        Gerät, kein Sync).
      </p>

      {draft.length === 0 && <p className="empty">Noch keine Variablen.</p>}

      {draft.map((variable, index) => {
        const masked = variable.secret && !revealed.has(index);
        return (
          <div key={index} className="variable-row">
            <input
              className="mono"
              placeholder="NAME"
              pattern="[A-Za-z_][A-Za-z0-9_.\-]*"
              title="Buchstaben, Ziffern, _ . - (nicht mit Ziffer beginnend)"
              value={variable.key}
              onChange={(e) => updateVariable(index, { key: e.target.value })}
            />
            <input
              className="mono"
              type={masked ? "password" : "text"}
              autoComplete="off"
              placeholder="Wert"
              value={variable.value}
              onChange={(e) => updateVariable(index, { value: e.target.value })}
            />
            {variable.secret && (
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => toggleReveal(index)}
              >
                {masked ? "Zeigen" : "Verbergen"}
              </button>
            )}
            <label className="check" title="Wert maskieren">
              <input
                type="checkbox"
                checked={variable.secret}
                onChange={(e) => updateVariable(index, { secret: e.target.checked })}
              />
              Secret
            </label>
            <button
              type="button"
              className="button button--ghost button--small"
              title="Entfernen"
              onClick={() => {
                setDraft((prev) => prev.filter((_, i) => i !== index));
                setRevealed(new Set());
              }}
            >
              ×
            </button>
          </div>
        );
      })}

      <button
        type="button"
        className="button button--ghost button--small"
        onClick={() =>
          setDraft((prev) => [...prev, { key: "", value: "", secret: false }])
        }
      >
        + Variable
      </button>

      {duplicateKeys.length > 0 && (
        <div className="notice notice--error">
          Doppelte Namen: {[...new Set(duplicateKeys)].join(", ")}
        </div>
      )}

      <div className="view__actions view__actions--footer">
        <button
          type="submit"
          className="button button--primary"
          disabled={duplicateKeys.length > 0}
        >
          Speichern
        </button>
      </div>
    </form>
  );
};
