import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { translate } from './translationLookup';

type NestedRecord = Record<string, unknown>;
type Translations = Record<string, unknown>;

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

  const t = (key: string, options?: Record<string, unknown>) => translate(translations, key, options);

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

    const t = (key: string, options?: Record<string, unknown>) => translate(translations, key, options);

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
