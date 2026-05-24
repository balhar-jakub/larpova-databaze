import React from 'react'
import { Game, Label } from '../../../graphql/__generated__/typescript-operations'
import LadderGamePanel from '../LadderGamePanel'

export default { title: 'LadderGamePanel' }

type LadderGame = Pick<
    Game,
    'id' | 'name' | 'year' | 'averageRating' | 'totalRating' | 'amountOfRatings' | 'amountOfComments'
> & {
    labels: Array<Pick<Label, 'id' | 'name'>>
}

const mockGame: LadderGame = {
    id: '1',
    name: 'Osada 12',
    labels: [
        { id: '1', name: 'dramatický' },
        { id: '2', name: 'detektivní' },
        { id: '3', name: 'postapo' },
        { id: '4', name: 'střelné zbraně (airsoft)' },
        { id: '5', name: 'večírek' },
        { id: '6', name: 'opakovatelný' },
        { id: '7', name: 'sociální drama' },
    ],
    year: 2011,
    amountOfRatings: 74,
    amountOfComments: 42,
    totalRating: 61,
    averageRating: 77,
}

export const Osada12 = () => <LadderGamePanel game={mockGame} />
