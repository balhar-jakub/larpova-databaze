import React from 'react'
import { createUseStyles } from 'react-jss'
import { EventBaseData, EventBaseDataPanel } from '../EventBaseDataPanel'
import { darkTheme } from '../../../theme/darkTheme'

export default { title: 'EventBaseDataPanel' }

const mockBaseEvent1: EventBaseData = {
    id: '123',
    name: 'Kladiva pomsty',
    from: '2020-11-12 23:00:00',
    to: '2020-11-13 23:00:00',
    amountOfPlayers: 80,
    loc: 'Hl. m. Praha, Praha',
}

const mockBaseEvent2: EventBaseData = {
    id: '123',
    name: 'Křížová výprava chudiny 1096 extra speciál',
    from: '2020-11-15 00:00:00',
    to: '2020-11-17 00:00:00',
    amountOfPlayers: 80,
}

const useStyles = createUseStyles({
    wrapper: {
        width: 275,
        padding: 20,
        backgroundColor: darkTheme.background,
    },
})

export const Event1 = () => {
    const classes = useStyles()

    return (
        <div className={classes.wrapper}>
            <EventBaseDataPanel event={mockBaseEvent1} />
        </div>
    )
}

export const Event2 = () => {
    const classes = useStyles()

    return (
        <div className={classes.wrapper}>
            <EventBaseDataPanel event={mockBaseEvent2} />
        </div>
    )
}

export const SameDate = () => {
    const classes = useStyles()

    return (
        <div className={classes.wrapper}>
            <EventBaseDataPanel event={{ ...mockBaseEvent2, to: mockBaseEvent2.from }} />
        </div>
    )
}

export const Loading = () => {
    const classes = useStyles()

    return (
        <div className={classes.wrapper}>
            <EventBaseDataPanel />
        </div>
    )
}
