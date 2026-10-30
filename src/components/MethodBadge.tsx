import type { HttpMethod } from "../types";

type Props = {
  method: HttpMethod;
};

export const MethodBadge = ({ method }: Props) => (
  <span className={`method method--${method.toLowerCase()}`}>{method}</span>
);
