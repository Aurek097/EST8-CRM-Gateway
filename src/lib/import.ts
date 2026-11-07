import { ageFrom, digits, money, parseDate, stateCode, yesNo, type LeadType } from "./leads";

export const TARGET_FIELDS = [
  "firstName",
  "lastName",
  "fullName",
  "phone",
  "email",
  "address",
  "city",
  "state",
  "zip",
  "dob",
  "age",
  "gender",
  "loanAmount",
  "lender",
  "spouseName",
  "spouseDob",
  "spouseAge",
  "amountRequested",
  "beneficiary",
  "benRel",
  "hasLife",
  "heartStrokeCancer",
  "hobby",
  "platform",
  "ad",
  "interestedIn",
  "trustedForm",
  "leadSource",
  "leadDate",
] as const;
export type Target = (typeof TARGET_FIELDS)[number] | "extra" | "ignore";

export const TARGET_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name (split)",
  phone: "Phone",
  email: "Email",
  address: "Street address",
  city: "City",
  state: "State",
  zip: "ZIP",
  dob: "Date of birth",
  age: "Age",
  gender: "Gender",
  loanAmount: "Loan amount",
  lender: "Lender",
  spouseName: "Spouse name",
  spouseDob: "Spouse DOB",
  spouseAge: "Spouse age",
  amountRequested: "Amount requested",
  beneficiary: "Beneficiary name",
  benRel: "Beneficiary relationship",
  hasLife: "Has life insurance",
  heartStrokeCancer: "Heart/stroke/cancer",
  hobby: "Hobby",
  platform: "Platform",
  ad: "Ad",
  interestedIn: "Interested in",
  trustedForm: "TrustedForm URL",
  leadSource: "Lead source",
  leadDate: "Lead date/time",
  extra: "Keep as other column",
  ignore: "Ignore",
};

const SYN: Record<string, string[]> = {
  firstName: ["firstname", "first", "fname", "givenname"],
  lastName: ["lastname", "last", "lname", "surname"],
  fullName: ["name", "fullname", "clientname", "leadname"],
  phone: ["phone", "phonenumber", "cell", "mobile", "cellphone", "primaryphone", "telephone"],
  email: ["email", "emailaddress", "mail"],
  address: ["address", "street", "streetaddress", "address1", "propertyaddress"],
  city: ["city", "town"],
  state: ["state", "st", "province"],
  zip: ["zip", "zipcode", "postalcode", "postal"],
  dob: ["dob", "dateofbirth", "birthdate", "birthday"],
  age: ["age"],
  gender: ["gender", "sex"],
  loanAmount: ["loanamount", "mortgageamount", "loan", "mortgage", "mortgagebalance"],
  lender: ["lender", "mortgagelender", "bank"],
  spouseName: ["spouse", "spousename", "cobrrower", "coborrower", "coborrowername"],
  spouseDob: ["spousedob", "spousedateofbirth"],
  spouseAge: ["spouseage"],
  amountRequested: ["amtrequested", "amountrequested", "coverageamount", "coverage", "faceamount"],
  beneficiary: ["beneficiaryname"],
  benRel: ["beneficiary", "beneficiaryrelationship", "relationship"],
  hasLife: ["havelifeinsurance", "haslifeinsurance", "haslife", "currentlifeinsurance"],
  hobby: ["favoritehobby", "hobby"],
  platform: ["platform", "source_platform"],
  ad: ["ad", "adname", "creative"],
  interestedIn: ["interestedin", "interest", "product"],
  trustedForm: ["trustedformurl", "trustedform", "trustedformcerturl", "certurl"],
  leadSource: ["leadsource", "source", "vendor"],
  leadDate: ["datetime", "date", "leaddate", "created", "createdat", "timestamp", "submitted"],
};

export const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

export function guessTarget(header: string): Target {
  const n = norm(header);
  if (!n) return "ignore";
  if (/heart|stroke|cancer/.test(n)) return "heartStrokeCancer";
  for (const [k, list] of Object.entries(SYN)) if (list.includes(n)) return k as Target;
  return "extra";
}

/** Rows are arrays; the first row is the header. */
export type Grid = string[][];

export function parsePasted(text: string): Grid {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim());
  const sep = lines[0]?.includes("\t") ? "\t" : ",";
  return lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")));
}

export type ImportedLead = {
  lead_type: LeadType;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  phone_digits: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lead_source: string | null;
  lead_date: string | null;
  data: Record<string, unknown>;
};

type D = Partial<Record<(typeof TARGET_FIELDS)[number] | "married", unknown>> &
  Record<string, unknown>;

export function detectType(d: D): LeadType {
  const i = String(d.interestedIn ?? "").toLowerCase();
  if (/final expense|burial|funeral/.test(i)) return "fe";
  if (d.amountRequested && !d.loanAmount) return "fe";
  return "mp";
}

export function mapRow(
  headers: string[],
  row: string[],
  targets: Target[],
  typeChoice: "detect" | LeadType,
): ImportedLead {
  const d: D = {};
  const extra: Record<string, string> = {};
  headers.forEach((h, i) => {
    const t = targets[i];
    const v = (row[i] ?? "").toString().trim();
    if (!t || t === "ignore" || v === "") return;
    if (t === "extra") extra[h] = v;
    else d[t] = v;
  });
  if (d.fullName && !d.firstName && !d.lastName) {
    const parts = String(d.fullName).split(/\s+/);
    d.firstName = parts.shift();
    d.lastName = parts.join(" ") || null;
  }
  delete d.fullName;
  if (d.dob) d.dob = parseDate(d.dob);
  if (d.spouseDob) d.spouseDob = parseDate(d.spouseDob);
  const computed = ageFrom(d.dob as string | null);
  if (computed != null) d.age = computed;
  else if (d.age != null) d.age = /^\d+$/.test(String(d.age)) ? Number(d.age) : null;
  if (d.loanAmount) d.loanAmount = money(d.loanAmount);
  for (const k of ["hasLife", "heartStrokeCancer"]) if (d[k] != null) d[k] = yesNo(d[k]) ?? d[k];
  if (d.gender) {
    const g = String(d.gender).toLowerCase();
    d.gender = g.startsWith("f") ? "Female" : g.startsWith("m") ? "Male" : d.gender;
  }
  if (d.platform) {
    const p = String(d.platform).toLowerCase();
    d.platform = /fb|facebook|meta/.test(p)
      ? "Facebook"
      : /ig|insta/.test(p)
        ? "Instagram"
        : /google|gads/.test(p)
          ? "Google"
          : d.platform;
  }
  if (d.spouseName && d.married == null) d.married = "Yes";
  let leadDate: string | null = null;
  if (d.leadDate) {
    const t = new Date(String(d.leadDate));
    leadDate = isNaN(+t) ? null : t.toISOString();
  }
  const type = typeChoice === "detect" ? detectType(d) : typeChoice;
  const s = (k: string) => (d[k] == null ? null : String(d[k]));
  const {
    firstName,
    lastName,
    phone,
    email,
    address,
    city,
    state,
    zip,
    leadSource,
    leadDate: _ld,
    ...rest
  } = d;
  void firstName;
  void lastName;
  void phone;
  void email;
  void address;
  void city;
  void state;
  void zip;
  void leadSource;
  void _ld;
  return {
    lead_type: type,
    first_name: s("firstName"),
    last_name: s("lastName"),
    phone: s("phone"),
    phone_digits: digits(s("phone")) || null,
    email: s("email"),
    address: s("address"),
    city: s("city"),
    state: s("state"),
    zip: s("zip"),
    lead_source: s("leadSource"),
    lead_date: leadDate,
    data: { ...rest, ...(Object.keys(extra).length ? { extra } : {}) },
  };
}

export function isSkippable(l: ImportedLead) {
  return !l.first_name && !l.last_name && !l.phone_digits;
}

export const dupKey = {
  phone: (l: { phone_digits: string | null }) => l.phone_digits || null,
  nameAddr: (l: { first_name: string | null; last_name: string | null; address: string | null }) =>
    l.address
      ? `${(l.first_name ?? "").toLowerCase()}|${(l.last_name ?? "").toLowerCase()}|${l.address.toLowerCase().replace(/\s+/g, " ")}`
      : null,
};

export { stateCode };
