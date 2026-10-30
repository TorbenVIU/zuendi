import type { AppState, Variable } from "../types";

export const addMissingVariablesInState = (
  prev: AppState,
  variables: Variable[],
): AppState => {
  const missing = variables.filter(
    (variable) => !prev.variables.some((v) => v.key === variable.key),
  );
  return missing.length
    ? { ...prev, variables: [...prev.variables, ...missing] }
    : prev;
};
