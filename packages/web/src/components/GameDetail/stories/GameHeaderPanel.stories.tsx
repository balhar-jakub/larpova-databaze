import React from 'react'
import { GameHeaderPanel } from '../GameHeaderPanel'

export default { title: 'GameHeaderPanel' }

const baseGame = {
    id: '123',
    name: 'Ve znamení Zla',
    players: 24,
    menRole: 20,
    womenRole: 14,
    days: 3,
    year: 2018,
    web: 'https://vzz3.webnode.cz/',
    galleryURL: 'https://www.facebook.com/veznamenizla/',
    photoAuthor: 'Photography by Bára dělá fotky/Matěj Slaviboj Bášti/Denzil',
    description: `Jedná se o obsahový/dramatický larp. 

Hra je pro 24 hráčů alias studentů, kteří si prožijí fyzicky a hlavně psychicky náročný rok v Bradavicích.`,
    authors: [
        {
            id: '1',
            name: 'Robin Hudcovič',
            nickname: 'Kammi',
        },
        {
            id: '2',
            name: 'Michaela Hájková',
            nickname: 'Sandriel',
        },
    ],
    groupAuthor: [
        {
            id: '1',
            name: 'HP larp Brno',
        },
    ],
    labels: [
        {
            id: '1',
            name: 'fantasy',
            description: 'Fantasy larpy',
        },
        {
            id: '2',
            name: 'horor',
            description: 'Horor larpy',
        },
        {
            id: '3',
            name: 'simulace',
            description: 'Simulace',
        },
    ],
}

export const Base = () => (
    <div style={{ padding: 20, backgroundColor: '#272727', width: 735 }}>
        <GameHeaderPanel game={baseGame} />
    </div>
)

export const Second = () => (
    <div style={{ padding: 20, backgroundColor: '#272727', width: 735 }}>
        <GameHeaderPanel
            game={{
                ...baseGame,
                players: 0,
                menRole: 1,
                womenRole: 2,
                bothRole: 99,
                hours: 3,
                days: undefined,
                web: 'https://verylongurl.wordpress.subdmain.something.com',
                photoAuthor: undefined,
                groupAuthor: [],
                labels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(n => ({
                    id: `${n}`,
                    name: `Kategorie ${n}`,
                    description: `Nějaký popisek pro kategorii larpů číslo ${n}`,
                })),
            }}
        />
    </div>
)
