import type { Variable } from "../types";

const PLACEHOLDER = /\{\{\s*(\$?[A-Za-z_][\w.-]*)\s*\}\}/g;

export type Resolver = (
  template: string,
  scope?: Record<string, string>,
) => string;

const createBuiltins = (): Record<string, string> => {
  const now = Date.now();
  return {
    $timestamp: String(Math.floor(now / 1000)),
    $timestampMs: String(now),
    $isoDate: new Date(now).toISOString(),
    $uuid: crypto.randomUUID(),
  };
};

// Builtins are created once per resolver, so {{$timestamp}} is identical in
// headers, body and signature payload of a single run.
export const createResolver = (variables: Variable[]): Resolver => {
  const values = new Map(
    variables.filter((v) => v.key).map((v) => [v.key, v.value]),
  );
  const builtins = createBuiltins();

  return (template, scope = {}) =>
    template.replace(PLACEHOLDER, (_, name: string) => {
      if (Object.hasOwn(scope, name)) return scope[name];
      if (Object.hasOwn(builtins, name)) return builtins[name];
      const value = values.get(name);
      if (value === undefined) {
        throw new Error(`Variable «${name}» ist nicht definiert.`);
      }
      return value;
    });
};
