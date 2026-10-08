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

const mockGames = [
    { ...mockBaseGame, name: 'Florie 2000' },
    { ...mockBaseGame, name: 'Florie 2001' },
    { ...mockBaseGame, name: 'Florie 2002' },
    { ...mockBaseGame, name: 'Florie 2003' },
    { ...mockBaseGame, name: 'Florie 2004' },
    { ...mockBaseGame, name: 'Florie 2005' },
]

export const BestRated = () => (
    <HomePageGamesPanel titleKey="HomePage.bestGames" noteKey="HomePage.bestGamesNote" games={mockGames} href="/games?order=Best&minr=5" />
)

export const LastAdded = () => (
    <HomePageGamesPanel titleKey="HomePage.lastAddedGames" games={mockGames} href="/games?order=Newest" />
)
