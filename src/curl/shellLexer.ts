export type WordPart =
  | { type: "literal"; value: string }
  | { type: "variable"; name: string }
  | { type: "command"; source: string };

export type Word = WordPart[];

export type Statement = Word[];

const NAME = /[A-Za-z_]\w*/y;

const ANSI_ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  "\\": "\\",
  "'": "'",
  '"': '"',
};

const findClosingParen = (src: string, open: number): number => {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") {
      i++;
    } else if (c === "'") {
      i = src.indexOf("'", i + 1);
      if (i < 0) break;
    } else if (c === '"') {
      i++;
      while (i < src.length && src[i] !== '"') i += src[i] === "\\" ? 2 : 1;
    } else if (c === "(") {
      depth++;
    } else if (c === ")" && --depth === 0) {
      return i;
    }
  }
  throw new Error("Nicht geschlossenes $( … ) im Befehl.");
};

/**
 * Splits a bash snippet into statements (on `;`, newlines, `&&`, `||`, `|`)
 * of words. Quoting is resolved; `$VAR` and `$( … )` are kept as parts so the
 * caller can expand them against its own environment.
 */
export const lexShell = (input: string): Statement[] => {
  const src = input.replace(/\r\n?/g, "\n");
  const statements: Statement[] = [];
  let words: Word[] = [];
  let word: Word | null = null;
  let i = 0;

  const literal = (text: string) => {
    word ??= [];
    const last = word[word.length - 1];
    if (last?.type === "literal") last.value += text;
    else word.push({ type: "literal", value: text });
  };
  const part = (value: WordPart) => {
    word ??= [];
    word.push(value);
  };
  const endWord = () => {
    if (word) words.push(word);
    word = null;
  };
  const endStatement = () => {
    endWord();
    if (words.length) statements.push(words);
    words = [];
  };

  const readDollar = () => {
    const next = src[i + 1];
    if (next === "(") {
      const end = findClosingParen(src, i + 1);
      part({ type: "command", source: src.slice(i + 2, end) });
      i = end + 1;
      return;
    }
    if (next === "{") {
      const end = src.indexOf("}", i + 2);
      if (end < 0) throw new Error("Nicht geschlossenes ${ … } im Befehl.");
      const name = /^[A-Za-z_]\w*/.exec(src.slice(i + 2, end))?.[0];
      if (name) part({ type: "variable", name });
      i = end + 1;
      return;
    }
    NAME.lastIndex = i + 1;
    const match = NAME.exec(src);
    if (match) {
      part({ type: "variable", name: match[0] });
      i += 1 + match[0].length;
      return;
    }
    literal("$");
    i++;
  };

  const readAnsiQuoted = () => {
    i += 2;
    let out = "";
    while (i < src.length && src[i] !== "'") {
      if (src[i] === "\\") {
        const n = src[i + 1];
        out += ANSI_ESCAPES[n] ?? `\\${n}`;
        i += 2;
      } else {
        out += src[i++];
      }
    }
    if (i >= src.length) throw new Error("Nicht geschlossenes $'…' im Befehl.");
    i++;
    literal(out);
  };

  const readDoubleQuoted = () => {
    i++;
    literal("");
    while (i < src.length && src[i] !== '"') {
      const c = src[i];
      if (c === "\\" && i + 1 < src.length) {
        const n = src[i + 1];
        if ('$`"\\'.includes(n)) literal(n);
        else if (n !== "\n") literal(c + n);
        i += 2;
      } else if (c === "$") {
        readDollar();
      } else {
        literal(c);
        i++;
      }
    }
    if (i >= src.length) {
      throw new Error("Nicht geschlossenes doppeltes Anführungszeichen.");
    }
    i++;
  };

  while (i < src.length) {
    const c = src[i];
    if (c === "'") {
      const end = src.indexOf("'", i + 1);
      if (end < 0) {
        throw new Error("Nicht geschlossenes einfaches Anführungszeichen.");
      }
      literal(src.slice(i + 1, end));
      i = end + 1;
    } else if (c === '"') {
      readDoubleQuoted();
    } else if (c === "\\") {
      if (src[i + 1] !== "\n") literal(src[i + 1] ?? "");
      i += 2;
    } else if (c === "$") {
      if (src[i + 1] === "'") readAnsiQuoted();
      else readDollar();
    } else if (c === " " || c === "\t") {
      endWord();
      i++;
    } else if (c === "\n" || c === ";") {
      endStatement();
      i++;
    } else if (c === "&" || c === "|") {
      endStatement();
      i += src[i + 1] === c ? 2 : 1;
    } else if (c === "#" && !word) {
      while (i < src.length && src[i] !== "\n") i++;
    } else {
      literal(c);
      i++;
    }
  }
  endStatement();
  return statements;
};
