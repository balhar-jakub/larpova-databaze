import { ComponentType, createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { translate } from './translationLookup';

type NestedRecord = Record<string, unknown>;

/**
 * The app's translation function (the i18next TFunction shape is legacy —
 * the shim answers this signature). Shared so panels and validators that
 * take `t` as a parameter type it as what the hook actually returns.
 */
export type Translator = (key: string, options?: Record<string, unknown>) => string;

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

const cachedTranslations: Record<string, NestedRecord> = {};

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

export function appWithTranslation(App: ComponentType<Record<string, unknown>>) {
  const AppWithI18n = (props: Record<string, unknown>) => {
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
  // The wrapped component may expect its own `t` prop; the wrapper injects
  // the context one, so the caller passes everything EXCEPT `t`.
  return <P extends { t?: (key: string, options?: Record<string, unknown>) => string }>(
    Component: ComponentType<P> & {
      displayName?: string;
      name?: string;
      // Next.js static: whatever shape the page used, copied verbatim.
      getInitialProps?: unknown;
    },
  ) => {
    const Wrapped = (props: Omit<P, 't'>) => {
      const { t } = useTranslation();
      return <Component {...(props as P)} t={t as P['t']} />;
    };
    Wrapped.displayName = `withTranslation(${Component.displayName || Component.name})`;
    // Preserve Next.js static properties (getInitialProps, etc.)
    const staticProps = Component as { getInitialProps?: unknown };
    if (staticProps.getInitialProps) Wrapped.getInitialProps = staticProps.getInitialProps;
    return Wrapped;
  };
}
