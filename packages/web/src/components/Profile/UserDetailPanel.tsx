import React, { useEffect, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { Maybe } from 'graphql/jsutils/Maybe'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import { computeAge } from '../../utils/dateUtils'
import { breakPoints } from '../../theme/breakPoints'
import { DEFAULT_IMAGE_URL } from '../common/ProfileImage/ProfileImage'
import { sanitizeHtml } from '../../utils/sanitizeHtml'

interface UserData {
    readonly id: string
    readonly amountOfPlayed?: Maybe<number>
    readonly amountOfCreated?: Maybe<number>
    readonly image?: Maybe<{
        readonly id: string
    }>
    readonly name: string
    readonly nickname?: Maybe<string>
    readonly birthDate?: Maybe<string>
    /** Short public bio, stored as legacy HTML. */
    readonly description?: Maybe<string>
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
    description: {
        fontSize: '0.75rem',
        color: darkTheme.textLight,
        marginTop: 10,
        maxWidth: 700,
        '& p': {
            marginBottom: '0.4rem',
        },
        '& a': {
            color: darkTheme.textGreen,
        },
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
    const [sanitizedDescription, setSanitizedDescription] = useState('')

    useEffect(() => {
        // Sanitizing needs the browser, so it cannot run during SSR or in the
        // hydration render (that produced inconsistent markup for game details).
        setSanitizedDescription(sanitizeHtml(userData?.description))
    }, [userData?.description])

    return (
        <div className={classes.wrapper}>
            <WidthFixer className={classes.fixer}>
                {userData && (
                    <img
                        src={
                            userData?.image?.id
                                ? `/user-icon?id=${userData.id}&imageId=${userData.image.id}`
                                : DEFAULT_IMAGE_URL
                        }
                        className={classes.image}
                        alt=""
                    />
                )}
                {!userData && <div className={classes.image} />}
                {userData && (
                    <div className={classes.nameWrapper}>
                        <div className={classes.header}>
                            {userData.nickname} {userData.name}
                        </div>
                        <div className={classes.text}>
                            {t('UserDetail.player', { count: userData.amountOfPlayed ?? 0 })}
                            {t('UserDetail.author', { count: userData.amountOfCreated ?? 0 })}
                            {age > 0 ? t('UserDetail.age', { age }) : ''}
                        </div>
                        {sanitizedDescription && (
                            // eslint-disable-next-line react/no-danger
                            <div
                                className={classes.description}
                                dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
                            />
                        )}
                    </div>
                )}
            </WidthFixer>
        </div>
    )
}

export default UserDetailPanel
