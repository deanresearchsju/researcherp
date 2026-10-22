import type { ChangeEvent, InputHTMLAttributes } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

/**
 * How each kind of application field is typed: what characters it takes, how long it may be,
 * and which keyboard a phone shows. The mask also cleans pasted text.
 */
export type InputRule = {
  mask: (value: string) => string;
  attrs: InputHTMLAttributes<HTMLInputElement>;
};

const digits = (max: number) => (value: string) => value.replace(/\D/g, "").slice(0, max);

/** A pasted "+91 …" or "0…" number keeps its 10 digits. */
function mobileDigits(value: string) {
  let text = value.replace(/\D/g, "");
  if (text.length > 10 && text.startsWith("91")) text = text.slice(2);
  else if (text.length > 10 && text.startsWith("0")) text = text.slice(1);
  return text.slice(0, 10);
}

export const inputRules = {
  /** 10-digit Indian mobile number. */
  mobile: {
    mask: mobileDigits,
    attrs: {
      type: "tel",
      inputMode: "numeric",
      maxLength: 10,
      autoComplete: "tel-national",
      placeholder: "10-digit mobile number",
    },
  },
  email: {
    mask: (value: string) => value.replace(/\s/g, "").toLowerCase(),
    attrs: {
      type: "email",
      inputMode: "email",
      autoComplete: "email",
      autoCapitalize: "none",
      spellCheck: false,
      maxLength: 120,
      placeholder: "name@example.com",
    },
  },
  year: {
    mask: digits(4),
    attrs: { inputMode: "numeric", maxLength: 4, placeholder: "YYYY" },
  },
  /** Years or months of service, 0 to 99. */
  count: {
    mask: digits(2),
    attrs: { inputMode: "numeric", maxLength: 2 },
  },
  /** Indian pin code. */
  pin: {
    mask: digits(6),
    attrs: { inputMode: "numeric", maxLength: 6, autoComplete: "postal-code" },
  },
  /** Free pin or postal code for addresses outside India. */
  postal: {
    mask: (value: string) => value.replace(/[^A-Za-z0-9 -]/g, "").slice(0, 10),
    attrs: { maxLength: 10, autoComplete: "postal-code" },
  },
  /** Percentage or CGPA: digits with one decimal point. */
  score: {
    mask: (value: string) => {
      const cleaned = value.replace(/[^\d.]/g, "");
      const [whole = "", ...rest] = cleaned.split(".");
      const decimals = rest.join("").slice(0, 2);
      return (
        rest.length > 0 ? `${whole.slice(0, 3)}.${decimals}` : whole.slice(0, 3)
      ).slice(0, 6);
    },
    attrs: { inputMode: "decimal", maxLength: 6, placeholder: "e.g. 72.5" },
  },
  /** A person's name: letters, spaces and . ' - only. */
  personName: {
    mask: (value: string) =>
      value
        .replace(/[^\p{L} .'-]/gu, "")
        .replace(/ {2,}/g, " ")
        .slice(0, 120),
    attrs: { autoComplete: "name", maxLength: 120 },
  },
  /** The same, in capitals (supervisor application). */
  personNameCaps: {
    mask: (value: string) =>
      value
        .toUpperCase()
        .replace(/[^A-Z .'-]/g, "")
        .replace(/ {2,}/g, " ")
        .slice(0, 120),
    attrs: { autoComplete: "name", maxLength: 120, className: "uppercase" },
  },
  /** Certificate, roll or transaction numbers: letters, digits, - and /. */
  reference: {
    mask: (value: string) =>
      value
        .replace(/[^A-Za-z0-9/-]/g, "")
        .toUpperCase()
        .slice(0, 40),
    attrs: { maxLength: 40, autoCapitalize: "characters", spellCheck: false },
  },
  doi: {
    mask: (value: string) => value.replace(/\s/g, "").slice(0, 120),
    attrs: {
      maxLength: 120,
      autoCapitalize: "none",
      spellCheck: false,
      placeholder: "10.xxxx/xxxxx",
    },
  },
  url: {
    mask: (value: string) => value.replace(/\s/g, "").slice(0, 300),
    attrs: {
      type: "url",
      inputMode: "url",
      maxLength: 300,
      autoCapitalize: "none",
      spellCheck: false,
      placeholder: "https://",
    },
  },
  pages: {
    mask: (value: string) => value.replace(/[^\dA-Za-z–—-]/g, "").slice(0, 20),
    attrs: { maxLength: 20, placeholder: "e.g. 101-110" },
  },
} satisfies Record<string, InputRule>;

/** Adds a rule to a react-hook-form field: its keyboard hints and the typed-text mask. */
export function masked(field: UseFormRegisterReturn, rule: InputRule) {
  return {
    ...field,
    ...rule.attrs,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      event.target.value = rule.mask(event.target.value);
      return field.onChange(event);
    },
  };
}

/** The pin-code rule that fits the country typed for the address. */
export function pinRuleFor(country: string) {
  return country.trim().toLowerCase() === "india" ? inputRules.pin : inputRules.postal;
}
