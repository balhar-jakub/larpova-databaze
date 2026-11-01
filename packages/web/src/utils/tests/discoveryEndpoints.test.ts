import { describe, test, expect } from '@jest/globals'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// jest runs with cwd = packages/web; resolve through process.cwd() like the
// other source-reading suites so the test does not depend on the tree depth.
const webRoot = process.cwd()
const nextConfigPath = join(webRoot, 'next.config.mjs')

describe('next.config.mjs crawler/discovery endpoints', () => {
    test('rewrites /favicon.ico straight to the static file (afterFiles rewrites are check:true — a chained /images/... target never re-enters the rewrite list)', () => {
        const config = readFileSync(nextConfigPath, 'utf-8')

        expect(config).toContain("{ source: '/favicon.ico', destination: '/static/images/favicon.png' }")
    })

    test('the /images rewrite that serves the favicon target still exists', () => {
        const config = readFileSync(nextConfigPath, 'utf-8')

        expect(config).toContain("{ source: '/images/:path*', destination: '/static/images/:path*' }")
        expect(existsSync(join(webRoot, 'public', 'static', 'images', 'favicon.png'))).toBe(true)
    })
})

describe('public/manifest.webmanifest', () => {
    const manifestPath = join(webRoot, 'public', 'manifest.webmanifest')

    test('exists and is valid JSON with the basic PWA fields', () => {
        expect(existsSync(manifestPath)).toBe(true)

        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

        expect(manifest.name).toBeTruthy()
        expect(manifest.short_name).toBeTruthy()
        expect(manifest.start_url).toBe('/')
        expect(manifest.display).toBe('standalone')
        expect(Array.isArray(manifest.icons)).toBe(true)
        expect(manifest.icons.length).toBeGreaterThan(0)
        expect(manifest.icons[0].src).toBe('/images/favicon.png')
    })
})
