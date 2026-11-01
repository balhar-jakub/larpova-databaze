import { jest, describe, test, expect } from '@jest/globals'

const {
  decodeRequestPath,
  isScannerProbePath,
  classifyRequestPath,
  scannerGuardMiddleware,
} = await import('../scannerGuard')

describe('decodeRequestPath', () => {
  test('decodes ordinary and valid percent-encoded paths', () => {
    expect(decodeRequestPath('/larp/x/cs/534')).toEqual({ ok: true, path: '/larp/x/cs/534' })
    expect(decodeRequestPath('/rocenka/2026')).toEqual({ ok: true, path: '/rocenka/2026' })
    expect(decodeRequestPath('/%C4%9B%C5%A1')).toEqual({ ok: true, path: '/ěš' })
  })

  test('undecodable sequences yield ok:false instead of throwing URIError', () => {
    // The exact shape from the production app log: "URIError: Failed to decode param '/%c0'"
    expect(decodeRequestPath('/%c0')).toEqual({ ok: false, raw: '/%c0' })
    expect(decodeRequestPath('/foo/%ff%fe')).toEqual({ ok: false, raw: '/foo/%ff%fe' })
    expect(decodeRequestPath('/%')).toEqual({ ok: false, raw: '/%' })
    expect(decodeRequestPath('/%zz')).toEqual({ ok: false, raw: '/%zz' })
  })
})

describe('isScannerProbePath', () => {
  test.each([
    '/.env',
    '/.env.local',
    '/.env.production',
    '/.git/config',
    '/.git/HEAD',
    '/wp-admin/setup-config.php',
    '/wp-login.php',
    '/wp-content/uploads/x.php',
    '/wp-includes/js/jquery.js',
    '/phpmyadmin/index.php',
    '/xmlrpc.php',
    '/phpinfo.php',
    '/x/phpinfo.php',
    '/administrator/index.php',
    '/admin/.env',
    '/admin/login',
    '/admin/login.php',
    '/admin/phpinfo.php',
    '/cgi-bin/php',
  ])('blocks scanner probe %s', (path) => {
    expect(isScannerProbePath(path)).toBe(true)
  })

  test.each([
    '/',
    '/admin',
    '/admin/labels',
    '/admin/stats',
    '/admin/users',
    '/admin/selfRated',
    '/larp/ve-znameni-zla/cs/534',
    '/rocenka/2026',
    '/profile/123',
    '/kalendar',
    '/graphql',
    '/robots.txt',
  ])('does not block real app route %s', (path) => {
    expect(isScannerProbePath(path)).toBe(false)
  })

  test('matches case-insensitively and after decoding', () => {
    expect(isScannerProbePath('/.ENV')).toBe(true)
    expect(isScannerProbePath('/WP-ADMIN/')).toBe(true)
    expect(isScannerProbePath('/%2e%2e/%2egit/config'.toLowerCase())).toBe(false) // decoded by caller
    expect(isScannerProbePath(decodeURIComponent('/%2e%67it/config'))).toBe(true) // '/.git/config'
  })
})

describe('classifyRequestPath', () => {
  test('undecodable / overlong percent-encoding → 400 (the /%c0 URIError fix)', () => {
    expect(classifyRequestPath('/%c0')).toEqual({ action: 'reject', status: 400, reason: 'invalid percent-encoding' })
    expect(classifyRequestPath('/%c1%af')).toEqual({ action: 'reject', status: 400, reason: 'invalid percent-encoding' })
    expect(classifyRequestPath('/foo/%80bar')).toEqual({ action: 'reject', status: 400, reason: 'invalid percent-encoding' })
    expect(classifyRequestPath('/%ff')).toEqual({ action: 'reject', status: 400, reason: 'invalid percent-encoding' })
    expect(classifyRequestPath('/%zz')).toEqual({ action: 'reject', status: 400, reason: 'undecodable path' })
  })

  test('scanner probe shapes → 444 at the edge', () => {
    expect(classifyRequestPath('/.env').action).toBe('reject')
    expect(classifyRequestPath('/.env')).toMatchObject({ status: 444 })
    expect(classifyRequestPath('/.git/config')).toMatchObject({ action: 'reject', status: 444 })
    expect(classifyRequestPath('/wp-login.php')).toMatchObject({ action: 'reject', status: 444 })
    expect(classifyRequestPath('/phpinfo.php')).toMatchObject({ action: 'reject', status: 444 })
    expect(classifyRequestPath('/admin/.env')).toMatchObject({ action: 'reject', status: 444 })
    // encoded variant decodes to a probe shape
    expect(classifyRequestPath('/%2egit/config')).toMatchObject({ action: 'reject', status: 444 })
  })

  test('real routes pass, including the real /admin section', () => {
    expect(classifyRequestPath('/')).toEqual({ action: 'pass' })
    expect(classifyRequestPath('/admin')).toEqual({ action: 'pass' })
    expect(classifyRequestPath('/admin/users')).toEqual({ action: 'pass' })
    expect(classifyRequestPath('/larp/ve-znameni-zla/cs/534')).toEqual({ action: 'pass' })
    expect(classifyRequestPath('/rocenka/2026')).toEqual({ action: 'pass' })
    expect(classifyRequestPath('/robots.txt')).toEqual({ action: 'pass' })
    expect(classifyRequestPath('/graphql')).toEqual({ action: 'pass' })
    expect(classifyRequestPath('/health')).toEqual({ action: 'pass' })
  })
})

describe('scannerGuardMiddleware', () => {
  const run = (url: string) => {
    const next = jest.fn()
    const res = {
      status: jest.fn(function (this: any, code: number) { return this }),
      end: jest.fn(),
    }
    scannerGuardMiddleware()({ url, method: 'GET' }, res as any, next)
    return { next, res }
  }

  test('passes real routes to next()', () => {
    const { next, res } = run('/larp/x/cs/1?foo=bar')
    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
  })

  test('answers 400 for undecodable paths instead of letting URIError escape', () => {
    const { next, res } = run('/%c0')
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.end).toHaveBeenCalled()
  })

  test('answers 400 for scanner probes (Node cannot send 444; nginx does at the edge)', () => {
    for (const url of ['/.env', '/.git/config', '/wp-login.php', '/admin/.env', '/phpinfo.php']) {
      const { next, res } = run(url)
      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(400)
    }
  })

  test('ignores the query string when classifying', () => {
    const { next } = run('/kalendar?path=/.env')
    expect(next).toHaveBeenCalledTimes(1)
  })
})
