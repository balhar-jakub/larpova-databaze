import React from 'react'
import { GameBaseData } from '../../common/GameBaseDataPanel/GameBaseDataPanel'
import { GameEventGrid } from '../GameEventGrid'
import { EventBaseData } from '../EventBaseDataPanel'

export default { title: 'GameEventGrid' }

const mockBaseGame: GameBaseData = {
    id: '123',
    name: 'Florie',
    averageRating: 95,
    players: 150,
    amountOfComments: 12,
    amountOfRatings: 23,
}

const mockBaseEvent: EventBaseData = {
    id: '123',
    name: 'Kladiva pomsty',
    from: '2020-11-12 23:00:00',
    to: '2020-11-13 23:00:00',
    amountOfPlayers: 80,
    loc: 'Hl. m. Praha, Praha',
}

const mockGames = [
    { ...mockBaseGame, name: 'Florie 2000' },
    { ...mockBaseGame, name: 'Florie 2001' },
    { ...mockBaseGame, name: 'Florie 2002' },
    { ...mockBaseGame, name: 'Florie 2003' },
    { ...mockBaseGame, name: 'Florie 2004' },
    { ...mockBaseGame, name: 'Florie 2005' },
]

const mockEvents = [
    { ...mockBaseEvent, name: 'Kladiva pomsty I' },
    { ...mockBaseEvent, name: 'Kladiva pomsty II' },
    { ...mockBaseEvent, name: 'Kladiva pomsty III' },
    { ...mockBaseEvent, name: 'Kladiva pomsty IV' },
    { ...mockBaseEvent, name: 'Kladiva pomsty V' },
    { ...mockBaseEvent, name: 'Kladiva pomsty VI' },
]

const mockLoadingData = [undefined, undefined, undefined, undefined, undefined, undefined]

export const GameGrid = () => <GameEventGrid elements={mockGames} />

export const EventGrid = () => <GameEventGrid elements={mockEvents} />

export const Loading = () => <GameEventGrid elements={mockLoadingData} />
