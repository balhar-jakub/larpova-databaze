import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import { Maybe } from 'graphql/jsutils/Maybe'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import { computeAge } from '../../utils/dateUtils'
import { breakPoints } from '../../theme/breakPoints'

interface UserData {
    readonly id: string
    readonly amountOfPlayed?: Maybe<number>
    readonly amountOfCreated?: Maybe<number>
    readonly image?: Maybe<{
        readonly id: string
    }>
    readonly name: string
    readonly email: string
    readonly nickname?: Maybe<string>
    readonly birthDate?: Maybe<string>
}

interface Props {
    readonly userData?: UserData
}

const useStyles = createUseStyles({
    wrapper: {
        backgroundColor: darkTheme.background,
        padding: '20px 0',
    },
    fixer: {
        display: 'flex',
    },
    nameWrapper: {
        overflow: 'hidden',
    },
    image: {
        width: 80,
        height: 80,
        padding: 2,
        border: `solid 1px ${darkTheme.textOnLight}`,
        marginRight: 20,
        flexGrow: 0,
        flexShrink: 0,
    },
    header: {
        fontSize: '1rem',
        fontWeight: 'bold',
        marginBottom: '0.3rem',
        color: darkTheme.textGreen,
        lineHeight: '125%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    text: {
        fontSize: '0.75rem',
        color: darkTheme.textLighter,
    },
    [`@media(min-width: ${breakPoints.md}px)`]: {
        header: {
            fontSize: '1.33rem',
        },
    },
    [`@media(min-width: ${breakPoints.lg}px)`]: {
        header: {
            fontSize: '1.75rem',
        },
    },
})

const UserDetailPanel = ({ userData }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const age = computeAge(userData?.birthDate)

    return (
        <div className={classes.wrapper}>
            <WidthFixer className={classes.fixer}>
                {userData && (
                    <img
                        src={`/user-icon?id=${userData.id}&imageId=${userData?.image?.id}`}
                        className={classes.image}
                        alt=""
                    />
                )}
                {!userData && <div className={classes.image} />}
                {userData && (
                    <div className={classes.nameWrapper}>
                        <div className={classes.header}>
                            {userData.nickname} {userData.name} {userData.email}
                        </div>
                        <div className={classes.text}>
                            {t('UserDetail.player', { count: userData.amountOfPlayed ?? 0 })}
                            {t('UserDetail.author', { count: userData.amountOfCreated ?? 0 })}
                            {age > 0 ? t('UserDetail.age', { age }) : ''}
                        </div>
                    </div>
                )}
            </WidthFixer>
        </div>
    )
}

export default UserDetailPanel
