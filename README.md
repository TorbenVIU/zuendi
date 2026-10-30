# Zündi

Persönliche Chrome-Extension (Side Panel), um gespeicherte HTTP-Requests per Klick auszulösen – z.B. Webhooks wie den Revalidate-Endpoint im Website-Backend.

## Installation

```bash
npm install
npm run build
```

Dann in Chrome `chrome://extensions` → Entwicklermodus → «Entpackte Erweiterung laden» → `dist/` wählen. Nach jedem Build dort auf «Neu laden» klicken.

Ein Klick aufs Extension-Icon öffnet das Side Panel. Über ↗ lässt sich Zündi auch in einem eigenen Tab öffnen (praktisch für grosse Antworten).

## Bedienung

- **Requests**: anlegen, bearbeiten, sortieren, duplizieren. «▶ Ausführen» fragt standardmässig nach (pro Request abschaltbar) und zeigt danach Status, Dauer, Body (JSON formatiert), Response-Header und den gesendeten Request (Secrets maskiert).
- **cURL importieren**: einzelner `curl`-Befehl oder ganzes Shell-Snippet. Erkannt werden u.a. `-X`, `-H`, `-d/--data*`, `--json`, `-u`, `-G`, `--data-urlencode`, Variablen-Zuweisungen (`BODY='…'`) und HMAC-Signaturen via `openssl dgst -sha1|-sha256|… -hmac "$SECRET"` (Hex oder `| base64`). Unbekannte Shell-Variablen wie `$SECRET` werden zu Zündi-Variablen.
- **Variablen**: `{{NAME}}` in URL, Headern, Body, Signatur-Secret und -Präfix. Eingebaut: `{{$timestamp}}`, `{{$timestampMs}}`, `{{$isoDate}}`, `{{$uuid}}` (pro Ausführung konstant).
- **Signatur**: HMAC-SHA1/256/384/512 über «Signierter Inhalt» (Default `{{$body}}`), als Hex oder Base64, mit optionalem Präfix (z.B. `sha256=`), in einem frei wählbaren Header.
- **Backup**: Export/Import als JSON, wahlweise ohne Secret-Werte.

## Grenzen

- Daten liegen unverschlüsselt in `chrome.storage.local` (nur dieses Gerät, kein Sync).
- Chrome lässt einige Header bei `fetch` nicht zu (z.B. `Cookie`, `Host`). Es werden keine Browser-Cookies mitgesendet.
- Kein Multipart (`-F`) und keine Datei-Uploads (`-d @file`). Timeout: 30 s.
