import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApolloClient } from '@apollo/client'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import {
    UpdateGameStateMutation,
    UpdateGameStateMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import { darkTheme } from '../../theme/darkTheme'

const updateGameStateGql = require('./graphql/updateGameState.graphql')

interface Props {
    readonly gameId: string
    readonly state: number
}

const useStyles = createUseStyles({
    button: {
        backgroundColor: darkTheme.backgroundControl,
        color: darkTheme.textOnLightLighter,
        marginBottom: 2,
        borderRadius: 4,
        padding: 2,
        fontSize: '0.75rem',
        border: '1px solid #000',

        '&:hover': {
            backgroundColor: darkTheme.backgroundWhite,
            color: darkTheme.textOnLightDark,
        },
    },
    selected: {
        backgroundColor: darkTheme.textGreen,
        color: darkTheme.backgroundWhite,
    },
})

interface ButtonProps {
    readonly value: number
    readonly activeValue: number
    readonly textKey: string
    readonly onChange: (newState: number) => void
}

const RatingButton = ({ value, textKey, activeValue, onChange }: ButtonProps) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const isSelected = value === activeValue

    return (
        <button
            type="button"
            className={classNames({
                [classes.button]: true,
                [classes.selected]: isSelected,
            })}
            onClick={() => onChange(value)}
        >
            {t(textKey)}
        </button>
    )
}

const RatingStateButtons = ({ gameId, state }: Props) => {
    const client = useApolloClient()
    const [tmpValue, setTmpValue] = useState<number | undefined>(undefined)

    // Clear tmpValue on state change
    useEffect(() => {
        setTmpValue(undefined)
    }, [state, setTmpValue])

    const handleChange = (newState: number) => {
        if (newState !== state) {
            setTmpValue(newState)
            client.mutate<UpdateGameStateMutation, UpdateGameStateMutationVariables>({
                mutation: updateGameStateGql,
                variables: { gameId, state: newState },
            })
        }
    }

    const activeValue = tmpValue !== undefined ? tmpValue : state

    return (
        <>
            <RatingButton value={0} activeValue={activeValue} textKey="GameDetail.notPlayed" onChange={handleChange} />
            <RatingButton value={2} activeValue={activeValue} textKey="GameDetail.iPlayed" onChange={handleChange} />
            <RatingButton value={1} activeValue={activeValue} textKey="GameDetail.wantToPlay" onChange={handleChange} />
        </>
    )
}

export default RatingStateButtons
