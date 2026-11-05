// UI strings (L-1). The language follows the server's configured language
// where a translation exists, else the browser's, else English (L-2).
import enJson from "../i18n/en.json";

export type Params = Readonly<Record<string, string | number>>;
export type Translate = (key: string, params?: Params) => string;

type Strings = Readonly<Record<string, string>>;

const en: Strings = enJson;

const LANGUAGES: Readonly<Record<string, Strings>> = { en };

export function pickLanguage(serverLang: string, browserLang: string): string {
  const candidates = [serverLang, browserLang, browserLang.split("-")[0] ?? ""];
  return candidates.find((l) => l in LANGUAGES) ?? "en";
}

const fill = (text: string, params: Params): string =>
  text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );

export function createTranslator(lang: string): Translate {
  const strings = LANGUAGES[lang] ?? en;
  return (key, params = {}) => fill(strings[key] ?? en[key] ?? key, params);
}
