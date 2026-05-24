import { useRoutes } from '../useRoutes'

// Mock hooks. We could also use React Testing Library...
jest.mock('next/router', () => ({ useRouter: () => undefined }))
jest.mock('react', () => ({
    useMemo: (fn: any) => fn(),
}))

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
