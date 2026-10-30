import type { RunResult } from "../types";

type Props = {
  result: RunResult;
};

const variantOf = (result: RunResult) => {
  if (result.error || result.status === null) return "error";
  if (result.status < 300) return "ok";
  if (result.status < 400) return "warn";
  return "error";
};

export const StatusPill = ({ result }: Props) => (
  <span className={`pill pill--${variantOf(result)}`}>
    {result.error ? "Fehler" : `${result.status} ${result.statusText}`.trim()}
  </span>
);
