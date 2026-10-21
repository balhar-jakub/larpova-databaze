/**
 * @jest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * i18n.tsx coverage (32% at the Phase 1 baseline — the key-resolution rules
 * in translationLookup.ts are tested, but the React layer (I18nProvider,
 * appWithTranslation, withTranslation, useTranslation's default context)
 * had never rendered under test).
 *
 * Pinned contracts:
 * - I18nProvider with initialTranslations serves them to useTranslation
 *   immediately, without fetching (ready: true from the first render)
 * - I18nProvider without initialTranslations fetches /static/locales/…,
 *   becomes ready, and falls back to {} (ready: false, t = key) on failure
 * - the default context answers identity translations (t(key) = key)
 * - appWithTranslation renders the wrapped App and provides translations
 *   once the locale loads
 * - withTranslation injects `t` as a prop and preserves getInitialProps
 *
 * next/router is mocked (repo pattern: jest.unstable_mockModule in the
 * Search tests) because both wrappers call useRouter() and a real Next
 * router is not mounted in jsdom.
 */

// The real Czech catalog, so `t` resolves real keys like the app does.
const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
) as Record<string, unknown>;

const mockRouter = { pathname: '/', query: {}, locale: 'cs', replace: () => {} };
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => mockRouter,
}));

const { I18nProvider, appWithTranslation, withTranslation, useTranslation } =
    await import('src/lib/i18n');

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

/** A probe component exposing the hook result. */
function Probe({ label }: { label: string }) {
    const { t, locale, ready } = useTranslation();
    return <div data-testid="probe">{`${label}|${locale}|${ready}|${t('PageHeader.csld')}`}</div>;
}

describe('I18nProvider', () => {
    it('serves initialTranslations without fetching and is ready immediately', () => {
        const fetched: unknown[] = [];
        globalThis.fetch = (async (...args: unknown[]) => { fetched.push(args); return { json: async () => ({}) }; }) as never;

        render(
            <I18nProvider initialLocale="cs" initialTranslations={cs}>
                <Probe label="p" />
            </I18nProvider>,
        );

        const probe = screen.getByTestId('probe').textContent;
        expect(probe).toMatch(/^p\|cs\|true\|/);
        expect(probe).not.toContain('PageHeader.csld'); // resolved to real text
        expect(fetched).toHaveLength(0); // no fetch for provided translations
    });

    it('fetches the locale when no initialTranslations are given', async () => {
        globalThis.fetch = (async (url: unknown) => {
            expect(String(url)).toBe('/static/locales/cs/common.json');
            return { json: async () => cs };
        }) as never;

        render(
            <I18nProvider initialLocale="cs">
                <Probe label="p" />
            </I18nProvider>,
        );

        // not ready before the fetch resolves
        expect(screen.getByTestId('probe').textContent).toContain('false');
        await waitFor(() => {
            expect(screen.getByTestId('probe').textContent).toMatch(/true/);
        });
        expect(screen.getByTestId('probe').textContent).not.toContain('PageHeader.csld');
    });

    it('a failed locale load leaves the identity translation and not-ready', async () => {
        const warn = console.warn;
        console.warn = () => {};
        globalThis.fetch = (async () => { throw new Error('offline'); }) as never;

        try {
            render(
                <I18nProvider initialLocale="cs">
                    <Probe label="p" />
                </I18nProvider>,
            );
            await waitFor(() => {
                // the warn path has run; still not ready, key falls back to itself
                expect(screen.getByTestId('probe').textContent).toContain('|false|PageHeader.csld');
            });
        } finally {
            console.warn = warn;
        }
    });

    it('the default context (no provider) answers identity translations', () => {
        render(<Probe label="anon" />);
        const probe = screen.getByTestId('probe').textContent;
        expect(probe).toBe('anon|cs|false|PageHeader.csld');
    });
});

describe('appWithTranslation', () => {
    it('wraps the App and provides loaded translations', async () => {
        globalThis.fetch = (async () => ({ json: async () => cs })) as never;

        const Wrapped = appWithTranslation(() => <Probe label="wrapped" />);
        render(<Wrapped />);

        await waitFor(() => {
            expect(screen.getByTestId('probe').textContent).toMatch(/^wrapped\|cs\|true\|/);
        });
    });
});

describe('withTranslation', () => {
    it('injects t as a prop and preserves getInitialProps', () => {
        const Inner = (props: { t: (k: string) => string }) => (
            <div data-testid="inner">{props.t('PageHeader.csld')}</div>
        );
        Inner.displayName = 'Inner';
        Inner.getInitialProps = () => ({ fromInner: true });

        const Wrapped = withTranslation()(Inner);
        expect(Wrapped.displayName).toBe('withTranslation(Inner)');
        expect(typeof (Wrapped as { getInitialProps?: () => unknown }).getInitialProps).toBe('function');

        render(
            <I18nProvider initialLocale="cs" initialTranslations={cs}>
                <Wrapped />
            </I18nProvider>,
        );
        expect(screen.getByTestId('inner').textContent).not.toBe('PageHeader.csld');
    });
});
