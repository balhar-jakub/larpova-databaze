import { jest, describe, test, expect } from '@jest/globals'

// ESM mock — must be called before dynamic import
jest.unstable_mockModule('next/router', () => ({ useRouter: () => undefined }))
jest.unstable_mockModule('react', () => {
    const actual = jest.requireActual('react') as any
    return { ...actual, useMemo: (fn: any) => fn() }
})

const { useRoutes } = await import('../useRoutes')

describe('routes.gameDetail', () => {
    const routes = useRoutes()

    test('Ve znamení zla', () => {
        expect(routes.gameDetail('534', 'Ve znamení zla').as).toBe('/larp/ve-znameni-zla/cs/534')
    })

    test('De la Bête\n', () => {
        expect(routes.gameDetail('388', 'De la Bête').as).toBe('/larp/de-la-bete/cs/388')
    })

    test('Křížová výprava chudiny 1096 - premium', () => {
        expect(routes.gameDetail('1196', 'Křížová výprava chudiny 1096 - premium').as).toBe(
            '/larp/krizova-vyprava-chudiny-1096-premium/cs/1196',
        )
    })

    test('Bitva pěti armád [B5A, 2015]', () => {
        expect(routes.gameDetail('770', 'Bitva pěti armád [B5A, 2015]').as).toBe(
            '/larp/bitva-peti-armad-b5a-2015/cs/770',
        )
    })
})

// The rest of the route table: every builder's href/as pair, including
// the encoded query parameters.
describe('the route table', () => {
    const routes = useRoutes()

    test('homepage', () => {
        expect(routes.homepage()).toEqual({ href: '/', as: '/' })
    })

    test('eventDetail', () => {
        expect(routes.eventDetail('e1', 'Festival larpů')).toEqual({
            href: '/eventDetail?id=e1',
            as: '/event/festival-larpu/e1',
        })
    })

    test('calendar', () => {
        expect(routes.calendar()).toEqual({ href: '/kalendar', as: '/kalendar' })
    })

    test('search encodes the query and the type', () => {
        expect(routes.search('dračí doupě', 'games')).toEqual({
            href: '/search?q=dra%C4%8D%C3%AD%20doup%C4%9B&typ=hry',
            as: '/search?q=dra%C4%8D%C3%AD%20doup%C4%9B&typ=hry',
        })
    })

    test('search without arguments', () => {
        expect(routes.search()).toEqual({ href: '/search', as: '/search' })
    })

    test('profile variants', () => {
        expect(routes.currentProfile()).toEqual({ href: '/profile?id=current', as: '/profile/current' })
        expect(routes.userProfile('u1')).toEqual({ href: '/profile?id=u1', as: '/profile/u1' })
        expect(routes.userSettings()).toEqual({ href: '/profile?id=settings', as: '/profile/settings' })
        expect(routes.changePassword()).toEqual({ href: '/profile?id=changePassword', as: '/profile/changePassword' })
    })

    test('game create and edit', () => {
        expect(routes.gameCreate()).toEqual({ href: '/gameEdit', as: '/gameEdit' })
        expect(routes.gameEdit('g1')).toEqual({ href: '/gameEdit?id=g1', as: '/gameEdit/g1' })
    })

    test('gamesOfAuthor carries the author id and name', () => {
        expect(routes.gamesOfAuthor('a1', 'Jakub Balhar')).toEqual({
            href: '/games?autor=a1&autorn=Jakub%20Balhar',
            as: '/games?autor=a1&autorn=Jakub%20Balhar',
        })
    })
})
