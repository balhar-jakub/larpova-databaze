import { isAbsoluteHttpUrl } from '../urlUtils'

describe('isAbsoluteHttpUrl', () => {
    it.each([
        'http://example.test',
        'https://example.test/signup',
        '  HTTPS://example.test/form  ',
    ])('accepts an absolute HTTP(S) URL: %s', value => {
        expect(isAbsoluteHttpUrl(value)).toBe(true)
    })

    it.each([
        undefined,
        '',
        'example.test/signup',
        '/signup',
        'https:example.test',
        'https://',
        'javascript:alert(1)',
        'data:text/html,hello',
        'ftp://example.test/file',
    ])('rejects a missing, malformed, or non-HTTP URL: %s', value => {
        expect(isAbsoluteHttpUrl(value)).toBe(false)
    })
})
