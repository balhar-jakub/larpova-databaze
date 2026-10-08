import React, { useEffect, useState } from 'react'
import { useTranslation } from 'src/lib/i18n'
import { useApolloClient } from '@apollo/client'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import {
    UpdateGameStateMutation,
    UpdateGameStateMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import { darkTheme } from '../../theme/darkTheme'
import { useLoggedInUser } from '../../hooks/useLoggedInUser'
import { GenderContext, genderContext } from '../../utils/genderUtils'

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
    readonly context?: GenderContext
}

const RatingButton = ({ value, textKey, activeValue, onChange, context }: ButtonProps) => {
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
            {t(textKey, { context })}
        </button>
    )
}

const RatingStateButtons = ({ gameId, state }: Props) => {
    const client = useApolloClient()
    // `Hrál jsem` / `Hrála jsem` — the wording is about the signed-in user.
    const gender = genderContext(useLoggedInUser()?.gender)
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
            <RatingButton
                value={0}
                activeValue={activeValue}
                textKey="GameDetail.notPlayed"
                context={gender}
                onChange={handleChange}
            />
            <RatingButton
                value={2}
                activeValue={activeValue}
                textKey="GameDetail.iPlayed"
                context={gender}
                onChange={handleChange}
            />
            <RatingButton
                value={1}
                activeValue={activeValue}
                textKey="GameDetail.wantToPlay"
                context={gender}
                onChange={handleChange}
            />
        </>
    )
}

export default RatingStateButtons
