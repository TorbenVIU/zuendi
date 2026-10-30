import { useState, type FormEvent } from "react";
import { parseCurl, type CurlImport as ParsedCurl } from "../curl/parseCurl";

type Props = {
  onParsed: (parsed: ParsedCurl) => void;
  onCancel: () => void;
};

const PLACEHOLDER = `curl -X POST "https://example.com/api/webhook" \\
  -H "content-type: application/json" \\
  --data '{"hello":"world"}'

Auch Scripts mit Variablen und openssl-Signatur:
BODY='{…}'; SIG=$(printf '%s' "$BODY" | openssl dgst -sha1 -hmac "$SECRET" | awk '{print $NF}'); curl …`;

export const CurlImport = ({ onParsed, onCancel }: Props) => {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    try {
      onParsed(parseCurl(input));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <form className="view" onSubmit={handleSubmit}>
      <h2 className="view__title">cURL importieren</h2>
      <textarea
        className="mono"
        rows={14}
        spellCheck={false}
        autoFocus
        placeholder={PLACEHOLDER}
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <p className="field__hint">
        Shell-Variablen wie <code>$SECRET</code> werden zu Zündi-Variablen{" "}
        <code>{"{{SECRET}}"}</code>. Nichts wird ausgeführt – du kannst alles
        vor dem Speichern prüfen.
      </p>
      {error && <div className="notice notice--error">{error}</div>}
      <div className="view__actions view__actions--footer">
        <button
          type="submit"
          className="button button--primary"
          disabled={!input.trim()}
        >
          Übernehmen
        </button>
        <button type="button" className="button" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  );
};
