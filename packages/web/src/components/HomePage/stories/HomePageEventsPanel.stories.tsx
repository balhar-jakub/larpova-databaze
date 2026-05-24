import React from 'react'
import { EventBaseData } from '../EventBaseDataPanel'
import { HomePageEventsPanel } from '../HomePageEventsPanel'

export default { title: 'HomePageEventsPanel' }

const mockBaseEvent: EventBaseData = {
    id: '123',
    name: 'Kladiva pomsty',
    from: '2020-11-12 23:00:00',
    to: '2020-11-13 23:00:00',
    amountOfPlayers: 80,
    loc: 'Hl. m. Praha, Praha',
}

const events = [
    { ...mockBaseEvent, name: 'Florie 2000' },
    { ...mockBaseEvent, name: 'Florie 2001' },
    { ...mockBaseEvent, name: 'Florie 2002' },
    { ...mockBaseEvent, name: 'Florie 2003' },
    { ...mockBaseEvent, name: 'Florie 2004' },
    { ...mockBaseEvent, name: 'Florie 2005' },
]

export const Panel = () => <HomePageEventsPanel nextEvents={events} />
