/**
 * Scripts are plain JSON-serializable data (sections of blocks). Conditions,
 * calculations and actions are referenced by id and resolved by the engine,
 * so a script could be stored in the database and edited without code.
 */
export type Cond = string; // id from engine CONDITIONS; prefix "!" to negate

export type FieldKind =
  "text" | "area" | "money" | "date" | "datetime" | "select" | "carrier" | "seg" | "line";
export type Field = {
  key: string;
  label: string;
  kind?: FieldKind;
  options?: string[];
  placeholder?: string;
  showWhen?: Cond;
  yesNo?: boolean; // seg where Yes shows red, No green
};

export type Block =
  | { t: "say"; text: string; showWhen?: Cond }
  | { t: "cue"; text: string; label?: string; showWhen?: Cond }
  | { t: "rule"; text: string; showWhen?: Cond }
  | { t: "note"; text: string; showWhen?: Cond }
  | { t: "sub"; text: string; showWhen?: Cond }
  | { t: "ask"; n?: number | string; q: string; fields?: Field[]; why?: string; showWhen?: Cond }
  | { t: "fields"; fields: Field[]; showWhen?: Cond }
  | { t: "verifyLine"; text: string; showWhen?: Cond }
  | { t: "list"; id: string; label?: string; items: string[]; showWhen?: Cond }
  | { t: "calc"; id: string; showWhen?: Cond }
  | { t: "action"; label: string; action: string; primary?: boolean; showWhen?: Cond }
  | { t: "dialRow"; showWhen?: Cond }
  | { t: "healthGrid"; showWhen?: Cond }
  | { t: "optionRows"; showWhen?: Cond }
  | { t: "table"; head: string[]; rows: string[][]; showWhen?: Cond };

export type Section = {
  id: string;
  letter: string;
  title: string;
  showWhen?: Cond;
  blocks: Block[];
};
export type Script = { id: string; eyebrow: string; letters: string; sections: Section[] };
