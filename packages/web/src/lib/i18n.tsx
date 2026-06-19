import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';

type NestedRecord = Record<string, unknown>;
type Translations = Record<string, unknown>;

// Czech plural rules (i18next format):
//   _0: count = 1 (singular)
//   _1: count = 2, 3, 4 (few)
//   _2: count = 0, 5+ (many)
function csPluralSuffix(count: number): string {
  if (count === 1) return '_0';
  if (count >= 2 && count <= 4) return '_1';
  return '_2';
}

// Nested key lookup: "PageHeader.csld" → data.PageHeader.csld
// If the exact key is not found and options.count is provided,
// tries plural suffixes (_0, _1, _2 for Czech).
function getNested(obj: NestedRecord, path: string, options?: Record<string, unknown>): string {
  const parts = path.split('.');
  let current: any = obj;
  let parent: any = null;
  const lastKey = parts[parts.length - 1];
  for (const p of parts) {
    if (current == null || typeof current !== 'object') return path;
    parent = current;
    current = current[p];
  }
  // Exact key found and is a string
  if (typeof current === 'string') return current;
  // Try plural suffix if count is provided — look on the parent object
  if (options?.count != null) {
    const count = Number(options.count);
    if (!isNaN(count)) {
      const suffix = csPluralSuffix(count);
      const pluralVal = parent?.[`${lastKey}${suffix}`];
      if (typeof pluralVal === 'string') return pluralVal;
    }
  }
  return path;
}

// Deep merge two nested objects
function deepMerge(target: NestedRecord, source: NestedRecord): NestedRecord {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        (target[key] as NestedRecord) || {},
        source[key] as NestedRecord,
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ── Context ─────────────────────────────────────────────

interface I18nContextType {
  t: (key: string, options?: Record<string, unknown>) => string;
  locale: string;
  ready: boolean;
}

const I18nContext = createContext<I18nContextType>({
  t: (key: string) => key,
  locale: 'cs',
  ready: false,
});

export function useTranslation(_ns?: string) {
  return useContext(I18nContext);
}

// ── Provider ────────────────────────────────────────────

let cachedTranslations: Record<string, NestedRecord> = {};

async function loadLocale(locale: string): Promise<NestedRecord> {
  if (cachedTranslations[locale]) return cachedTranslations[locale];
  try {
    const resp = await fetch(`/static/locales/${locale}/common.json`);
    const data = await resp.json();
    cachedTranslations[locale] = data;
    return data;
  } catch {
    console.warn(`Failed to load translations for locale: ${locale}`);
    return {};
  }
}

export function I18nProvider({
  children,
  initialLocale,
  initialTranslations,
}: {
  children: React.ReactNode;
  initialLocale?: string;
  initialTranslations?: NestedRecord;
}) {
  const router = useRouter();
  const locale = initialLocale || router.locale || 'cs';
  const [translations, setTranslations] = useState<NestedRecord>(initialTranslations || {});

  useEffect(() => {
    if (initialTranslations && Object.keys(initialTranslations).length > 0) return;
    loadLocale(locale).then(setTranslations);
  }, [locale, initialTranslations]);

  const t = (key: string, options?: Record<string, unknown>) => {
    let result = getNested(translations, key, options);
    if (options) {
      for (const [k, v] of Object.entries(options)) {
        result = result.replace(`{{${k}}}`, String(v));
      }
    }
    return result;
  };

  return (
    <I18nContext.Provider value={{ t, locale, ready: Object.keys(translations).length > 0 }}>
      {children}
    </I18nContext.Provider>
  );
}

// ── App wrapper (replaces appWithTranslation) ────────────

export function appWithTranslation(App: any) {
  const AppWithI18n = (props: any) => {
    const router = useRouter();
    const locale = router.locale || 'cs';

    const [translations, setTranslations] = useState<NestedRecord>({});

    useEffect(() => {
      loadLocale(locale).then(setTranslations);
    }, [locale]);

    const t = (key: string, options?: Record<string, unknown>) => {
      let result = getNested(translations, key, options);
      if (options) {
        for (const [k, v] of Object.entries(options)) {
          result = result.replace(`{{${k}}}`, String(v));
        }
      }
      return result;
    };

    return (
      <I18nContext.Provider value={{ t, locale, ready: Object.keys(translations).length > 0 }}>
        <App {...props} />
      </I18nContext.Provider>
    );
  };

  AppWithI18n.displayName = 'AppWithI18n';
  return AppWithI18n;
}

// Re-export withTranslation for compatibility
export function withTranslation(_ns?: string) {
  return (Component: any) => {
    const Wrapped = (props: any) => {
      const { t } = useTranslation();
      return <Component {...props} t={t} />;
    };
    Wrapped.displayName = `withTranslation(${Component.displayName || Component.name})`;
    // Preserve Next.js static properties (getInitialProps, etc.)
    if (Component.getInitialProps) Wrapped.getInitialProps = Component.getInitialProps;
    return Wrapped;
  };
}
