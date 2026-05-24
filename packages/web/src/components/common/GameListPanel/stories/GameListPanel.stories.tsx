import React from 'react'
import { GameListPanel } from '../GameListPanel'

export default { title: 'GameListPanel' }

const games = [
    {
        id: '1',
        name: 'Stalker 2.3 - Odi et Ammo (2019)',
        totalRating: 80,
        averageRating: 80,
        amountOfRatings: 10,
    },
    {
        id: '2',
        name: 'Stalker 2.1 - Tribut (2017)',
        averageRating: 30,
        totalRating: 30,
        amountOfRatings: 10,
    },
    {
        id: '3',
        name: 'Stalker 2.2 - Black Jack (2018)',
        totalRating: 30,
        averageRating: 30,
        amountOfRatings: 3,
    },
]

export const Panel = () => (
    <div style={{ background: '#efefef', padding: 20, width: 220 }}>
        <GameListPanel titleKey="GameDetail.similarGames" games={games} />
    </div>
)
