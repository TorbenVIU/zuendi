import type {
  HeaderEntry,
  HttpMethod,
  SavedRequest,
  SignatureAlgorithm,
  SignatureConfig,
  SignatureEncoding,
  Variable,
} from "../types";
import { BODY_PLACEHOLDER, HTTP_METHODS, SECRET_NAME_PATTERN } from "../constants";
import { createDefaultSignature } from "../storage/defaults";
import { lexShell, type Statement, type Word } from "./shellLexer";

export type CurlImport = {
  request: Omit<SavedRequest, "id">;
  variables: Variable[];
  warnings: string[];
};

type SignatureSpec = {
  algorithm: SignatureAlgorithm;
  encoding: SignatureEncoding;
  secret: string;
  payloadVariable: string | null;
};

type EnvEntry =
  | { kind: "value"; value: string }
  | { kind: "signature"; spec: SignatureSpec }
  | { kind: "unknown" };

// Stand-in for `$SIG` while parsing; replaced by the signature config.
const SIGNATURE_MARK = "\u0000signature\u0000";

const OPENSSL_ALGORITHMS: Record<string, SignatureAlgorithm> = {
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha384: "SHA-384",
  sha512: "SHA-512",
};

// curl options that consume the next argument but are irrelevant here.
const IGNORED_VALUE_OPTIONS = new Set([
  "-o", "--output", "-w", "--write-out", "-m", "--max-time",
  "--connect-timeout", "--retry", "--retry-delay", "--retry-max-time",
  "-x", "--proxy", "-U", "--proxy-user", "-r", "--range", "-c",
  "--cookie-jar", "-K", "--config", "--cacert", "--cert", "--key", "-E",
  "--limit-rate", "--resolve", "--max-redirs", "-z", "--time-cond",
  "-Y", "--speed-limit", "-y", "--speed-time", "-T", "--upload-file",
]);

const SHORT_OPTIONS_WITH_VALUE = /^-[XHduAbeF]./;

const literalOf = (word: Word | undefined): string | null =>
  word?.length === 1 && word[0].type === "literal" ? word[0].value : null;

const isCurl = (word: Word | undefined) =>
  /(^|\/)curl(\.exe)?$/.test(literalOf(word) ?? "");

const toBase64 = (text: string) =>
  btoa(
    Array.from(new TextEncoder().encode(text), (b) =>
      String.fromCharCode(b),
    ).join(""),
  );

const urlencodeArgument = (value: string): string => {
  const eq = value.indexOf("=");
  if (eq < 0) return encodeURIComponent(value);
  const name = value.slice(0, eq);
  const content = encodeURIComponent(value.slice(eq + 1));
  return name ? `${name}=${content}` : content;
};

const nameFromUrl = (method: string, url: string): string => {
  try {
    const { host, pathname } = new URL(url);
    return `${method} ${host}${pathname === "/" ? "" : pathname}`;
  } catch {
    return `${method} ${url}`;
  }
};

export const parseCurl = (input: string): CurlImport => {
  const statements = lexShell(input);
  const env = new Map<string, EnvEntry>();
  const referenced = new Set<string>();
  const signatureSecrets = new Map<string, string>();
  const warnings: string[] = [];
  let usedSignature: SignatureSpec | null = null;
  let curlArgs: string[] | null = null;

  const expand = (word: Word): string =>
    word
      .map((part) => {
        if (part.type === "literal") return part.value;
        if (part.type === "command") {
          warnings.push(`$(${part.source.trim()}) wird nicht ausgeführt.`);
          return "";
        }
        const entry = env.get(part.name);
        if (entry?.kind === "value") return entry.value;
        if (entry?.kind === "signature") {
          usedSignature = entry.spec;
          return SIGNATURE_MARK;
        }
        referenced.add(part.name);
        return `{{${part.name}}}`;
      })
      .join("");

  // Keeps a secret defined in the script out of the request itself.
  const expandSecret = (word: Word): string => {
    const variable = word.find((part) => part.type === "variable");
    const onlyVariable = word.every(
      (part) => part === variable || (part.type === "literal" && !part.value),
    );
    if (variable && onlyVariable) {
      const entry = env.get(variable.name);
      if (entry?.kind === "value") {
        signatureSecrets.set(variable.name, entry.value);
        return `{{${variable.name}}}`;
      }
    }
    const secret = expand(word);
    if (secret && !secret.includes("{{")) {
      warnings.push(
        "Das Signatur-Secret steht im Klartext – besser als Variable ablegen, z.B. {{SECRET}}.",
      );
    }
    return secret;
  };

  const parseSignatureCommand = (source: string): SignatureSpec | null => {
    const pipeline = lexShell(source);
    const opensslIndex = pipeline.findIndex(
      (words) => literalOf(words[0]) === "openssl",
    );
    if (opensslIndex < 0) return null;

    const openssl = pipeline[opensslIndex];
    const flags = openssl.map(literalOf);
    const hmacIndex = flags.indexOf("-hmac");
    if (hmacIndex < 0 || !openssl[hmacIndex + 1]) return null;

    const algorithmFlag = flags
      .map((flag) => /^-?(sha\d+)$/.exec(flag ?? "")?.[1])
      .find(Boolean);
    const algorithm = algorithmFlag && OPENSSL_ALGORITHMS[algorithmFlag];
    if (!algorithm) {
      warnings.push(
        "Signatur-Algorithmus nicht erkannt – bitte im Formular prüfen.",
      );
    }

    const encoding: SignatureEncoding = pipeline.some((words) =>
      words.some((word) => literalOf(word) === "base64"),
    )
      ? "base64"
      : "hex";

    const payloadVariable =
      pipeline
        .flatMap((words, index) =>
          index === opensslIndex
            ? words.filter((_, wordIndex) => wordIndex !== hmacIndex + 1)
            : words,
        )
        .flat()
        .find((part) => part.type === "variable")?.name ?? null;

    return {
      algorithm: algorithm || "SHA-256",
      encoding,
      secret: expandSecret(openssl[hmacIndex + 1]),
      payloadVariable,
    };
  };

  const evaluateAssignment = (name: string, word: Word): EnvEntry => {
    const command = word.find((part) => part.type === "command");
    if (!command) return { kind: "value", value: expand(word) };
    const spec = parseSignatureCommand(command.source);
    if (spec) return { kind: "signature", spec };
    warnings.push(
      `${name}=$( … ) wird nicht ausgeführt – als Variable {{${name}}} übernommen.`,
    );
    return { kind: "unknown" };
  };

  const runStatement = (words: Statement) => {
    let index = literalOf(words[0]) === "export" ? 1 : 0;
    for (; index < words.length; index++) {
      const [first, ...rest] = words[index];
      const match =
        first?.type === "literal" && /^([A-Za-z_]\w*)=/.exec(first.value);
      if (!match) break;
      const value: Word = [
        { type: "literal", value: first.value.slice(match[0].length) },
        ...rest,
      ];
      env.set(match[1], evaluateAssignment(match[1], value));
    }
    if (!isCurl(words[index])) return;
    if (curlArgs) {
      warnings.push(
        "Mehrere curl-Befehle gefunden – nur der erste wird übernommen.",
      );
      return;
    }
    curlArgs = words.slice(index + 1).map(expand);
  };

  statements.forEach(runStatement);
  // Assigned inside closures, which TypeScript's narrowing does not track.
  const args = curlArgs as string[] | null;
  const spec = usedSignature as SignatureSpec | null;
  if (!args) throw new Error("Kein curl-Befehl gefunden.");

  const headers: HeaderEntry[] = [];
  const data: string[] = [];
  let method: string | null = null;
  let url = "";
  let isJson = false;
  let asQuery = false;

  const addHeader = (key: string, value: string) =>
    headers.push({ key, value, enabled: true });
  const hasHeader = (name: string) =>
    headers.some((header) => header.key.toLowerCase() === name);

  for (let i = 0; i < args.length; i++) {
    let option = args[i];
    let inlineValue: string | null = null;
    if (option.startsWith("--") && option.includes("=")) {
      const eq = option.indexOf("=");
      inlineValue = option.slice(eq + 1);
      option = option.slice(0, eq);
    } else if (SHORT_OPTIONS_WITH_VALUE.test(option)) {
      inlineValue = option.slice(2);
      option = option.slice(0, 2);
    }
    const value = () => {
      if (inlineValue !== null) return inlineValue;
      if (++i >= args.length) throw new Error(`Wert für ${option} fehlt.`);
      return args[i];
    };

    switch (option) {
      case "-X":
      case "--request":
        method = value().toUpperCase();
        break;
      case "-H":
      case "--header": {
        const header = value();
        const colon = header.indexOf(":");
        if (colon > 0) {
          addHeader(header.slice(0, colon).trim(), header.slice(colon + 1).trim());
        } else {
          warnings.push(`Header ohne Wert ignoriert: ${header}`);
        }
        break;
      }
      case "-d":
      case "--data":
      case "--data-ascii":
      case "--data-binary":
      case "--data-raw": {
        const payload = value();
        if (payload.startsWith("@") && option !== "--data-raw") {
          warnings.push(`Daten aus Datei (${payload}) werden nicht unterstützt.`);
        } else {
          data.push(payload);
        }
        break;
      }
      case "--data-urlencode":
        data.push(urlencodeArgument(value()));
        break;
      case "--json":
        data.push(value());
        isJson = true;
        break;
      case "-u":
      case "--user": {
        const credentials = value();
        if (credentials.includes("{{")) {
          addHeader("Authorization", "Basic ");
          warnings.push(
            "Basic-Auth mit Variablen: Authorization-Header bitte manuell ergänzen (Base64 von user:passwort).",
          );
        } else {
          addHeader("Authorization", `Basic ${toBase64(credentials)}`);
        }
        break;
      }
      case "-A":
      case "--user-agent":
        addHeader("User-Agent", value());
        break;
      case "-e":
      case "--referer":
        addHeader("Referer", value());
        break;
      case "-b":
      case "--cookie":
        addHeader("Cookie", value());
        warnings.push("Chrome lässt den Cookie-Header bei fetch nicht zu – er wird nicht gesendet.");
        break;
      case "-F":
      case "--form":
        value();
        warnings.push("Multipart-Formulare (-F) werden nicht unterstützt.");
        break;
      case "-G":
      case "--get":
        asQuery = true;
        break;
      case "-I":
      case "--head":
        method ??= "HEAD";
        break;
      case "--url":
        url = value();
        break;
      default:
        if (IGNORED_VALUE_OPTIONS.has(option)) value();
        else if (option.startsWith("-") && option.length > 1) break;
        else if (!url) url = option;
        else warnings.push(`Unbekanntes Argument ignoriert: ${option}`);
    }
  }

  if (!url) throw new Error("Keine URL im curl-Befehl gefunden.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url) && !url.startsWith("{{")) {
    url = `http://${url}`;
  }

  let body = data.join("&");
  if (asQuery && body) {
    url += (url.includes("?") ? "&" : "?") + body;
    body = "";
  }

  const resolvedMethod = method ?? (body ? "POST" : "GET");
  if (!HTTP_METHODS.includes(resolvedMethod as HttpMethod)) {
    throw new Error(`Methode ${resolvedMethod} wird nicht unterstützt.`);
  }

  if (isJson) {
    if (!hasHeader("content-type")) addHeader("Content-Type", "application/json");
    if (!hasHeader("accept")) addHeader("Accept", "application/json");
  } else if (body && !hasHeader("content-type")) {
    addHeader("Content-Type", "application/x-www-form-urlencoded");
  }

  let signature: SignatureConfig = createDefaultSignature();
  if (spec) {
    const index = headers.findIndex((header) =>
      header.value.includes(SIGNATURE_MARK),
    );
    if (index < 0) {
      warnings.push(
        "Die Signatur wird nicht in einem Header verwendet – bitte manuell konfigurieren.",
      );
    } else {
      const [header] = headers.splice(index, 1);
      const payloadEntry = spec.payloadVariable
        ? env.get(spec.payloadVariable)
        : undefined;
      let payload = BODY_PLACEHOLDER;
      if (payloadEntry?.kind !== "value") {
        warnings.push(
          "Signierter Inhalt nicht erkannt – es wird der Body signiert.",
        );
      } else if (payloadEntry.value !== body) {
        payload = payloadEntry.value;
        warnings.push(
          "Der signierte Inhalt weicht vom Body ab – bitte «Signierter Inhalt» prüfen.",
        );
      }
      signature = {
        enabled: true,
        algorithm: spec.algorithm,
        encoding: spec.encoding,
        secret: spec.secret,
        header: header.key,
        prefix: header.value.split(SIGNATURE_MARK)[0],
        payload,
      };
    }
  }

  const stripMark = (text: string) => {
    if (!text.includes(SIGNATURE_MARK)) return text;
    warnings.push("Signatur in URL/Body wird nicht unterstützt und wurde entfernt.");
    return text.split(SIGNATURE_MARK).join("");
  };

  const variables: Variable[] = [
    ...[...referenced]
      .filter((key) => !signatureSecrets.has(key))
      .map((key) => ({
        key,
        value: "",
        secret: SECRET_NAME_PATTERN.test(key) || signature.secret === `{{${key}}}`,
      })),
    ...[...signatureSecrets].map(([key, value]) => ({ key, value, secret: true })),
  ];

  return {
    request: {
      name: nameFromUrl(resolvedMethod, url),
      method: resolvedMethod as HttpMethod,
      url: stripMark(url),
      headers: headers.map((header) => ({
        ...header,
        value: stripMark(header.value),
      })),
      body: stripMark(body),
      signature,
      confirm: true,
    },
    variables,
    warnings: [...new Set(warnings)],
  };
};
