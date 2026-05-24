import React from 'react'
import { GameBaseData } from '../../common/GameBaseDataPanel/GameBaseDataPanel'
import { HomePageGamesPanel } from '../HomePageGamesPanel'

export default { title: 'HomePageGamesPanel' }

const mockBaseGame: GameBaseData = {
    id: '123',
    name: 'Florie',
    averageRating: 95,
    players: 150,
    amountOfComments: 12,
    amountOfRatings: 23,
}

const mockLastGames = [
    { ...mockBaseGame, name: 'Florie 2000', averageRating: 0 },
    { ...mockBaseGame, name: 'Florie 2001', averageRating: 0 },
    { ...mockBaseGame, name: 'Florie 2002', averageRating: 0 },
    { ...mockBaseGame, name: 'Florie 2003', averageRating: 0 },
    { ...mockBaseGame, name: 'Florie 2004', averageRating: 0 },
]

const mockTopGames = [
    { ...mockBaseGame, name: 'Florie 2000' },
    { ...mockBaseGame, name: 'Florie 2001' },
    { ...mockBaseGame, name: 'Florie 2002' },
    { ...mockBaseGame, name: 'Florie 2003' },
    { ...mockBaseGame, name: 'Florie 2004' },
    { ...mockBaseGame, name: 'Florie 2005' },
]

export const Panel = () => <HomePageGamesPanel lastGames={mockLastGames} topGames={mockTopGames} />
