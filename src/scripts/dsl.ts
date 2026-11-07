import type { Block, Field, FieldKind } from "./types";

export const say = (text: string, showWhen?: string): Block => ({
  t: "say",
  text,
  ...(showWhen ? { showWhen } : {}),
});
export const cue = (text: string, label = "Cue", showWhen?: string): Block => ({
  t: "cue",
  text,
  label,
  ...(showWhen ? { showWhen } : {}),
});
export const rule = (text: string, showWhen?: string): Block => ({
  t: "rule",
  text,
  ...(showWhen ? { showWhen } : {}),
});
export const note = (text: string, showWhen?: string): Block => ({
  t: "note",
  text,
  ...(showWhen ? { showWhen } : {}),
});
export const sub = (text: string, showWhen?: string): Block => ({
  t: "sub",
  text,
  ...(showWhen ? { showWhen } : {}),
});
export const ask = (
  n: number | string | undefined,
  q: string,
  fields: Field[] = [],
  why?: string,
  showWhen?: string,
): Block => ({
  t: "ask",
  ...(n != null ? { n } : {}),
  q,
  fields,
  ...(why ? { why } : {}),
  ...(showWhen ? { showWhen } : {}),
});
export const fields = (fs: Field[], showWhen?: string): Block => ({
  t: "fields",
  fields: fs,
  ...(showWhen ? { showWhen } : {}),
});
export const verify = (text: string, showWhen?: string): Block => ({
  t: "verifyLine",
  text,
  ...(showWhen ? { showWhen } : {}),
});
export const list = (id: string, items: string[], label?: string, showWhen?: string): Block => ({
  t: "list",
  id,
  items,
  ...(label ? { label } : {}),
  ...(showWhen ? { showWhen } : {}),
});
export const calc = (id: string, showWhen?: string): Block => ({
  t: "calc",
  id,
  ...(showWhen ? { showWhen } : {}),
});
export const action = (label: string, act: string, primary = false, showWhen?: string): Block => ({
  t: "action",
  label,
  action: act,
  primary,
  ...(showWhen ? { showWhen } : {}),
});
export const dialRow = (): Block => ({ t: "dialRow" });
export const healthGrid = (): Block => ({ t: "healthGrid" });
export const optionRows = (): Block => ({ t: "optionRows" });

export const f = (
  key: string,
  label: string,
  kind: FieldKind = "text",
  extra: Partial<Field> = {},
): Field => ({ key, label, kind, ...extra });
export const seg = (
  key: string,
  label: string,
  options: string[],
  extra: Partial<Field> = {},
): Field => ({ key, label, kind: "seg", options, ...extra });
export const yn = (key: string, label: string, extra: Partial<Field> = {}): Field => ({
  key,
  label,
  kind: "seg",
  options: ["Yes", "No"],
  yesNo: true,
  ...extra,
});
export const M = "married";
