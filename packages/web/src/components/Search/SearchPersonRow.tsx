import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { computeAge } from '../../utils/dateUtils'
import { ProfileImage } from '../common/ProfileImage/ProfileImage'
import { TextLink } from '../common/TextLink/TextLink'
import UserLink from '../common/UserLink/UserLink'
import { useRoutes } from '../../hooks/useRoutes'
import { componentTestIds } from '../componentTestIds'
import HighlightedText from './HighlightedText'
import { PersonRowData, personMatchReason } from './searchHelpers'

interface Props {
    readonly person: PersonRowData
    readonly query?: string | null
}

const useStyles = createUseStyles({
    row: {
        display: 'grid',
        gridTemplateColumns: '56px 1fr 150px',
        gap: 12,
        alignItems: 'center',
        background: darkTheme.backgroundRealWhite,
        borderRadius: 6,
        padding: '9px 14px',
        marginBottom: 7,
        color: darkTheme.textOnLightDark,
    },
    avatar: {
        width: 48,
        height: 48,
        marginRight: 0,
        padding: 2,
    },
    name: {
        fontSize: '1rem',
        fontWeight: 600,
    },
    meta: {
        fontSize: '0.74rem',
        color: darkTheme.textOnLightLighter,
        marginTop: 2,
    },
    missing: {
        fontStyle: 'italic',
    },
    why: {
        display: 'inline-block',
        marginTop: 4,
        fontSize: '0.7rem',
        fontWeight: 700,
        color: '#0f4f4a',
        background: '#d9f2ec',
        borderRadius: 9,
        padding: '1px 8px',
    },
    link: {
        fontSize: '0.72rem',
        textAlign: 'right',
    },
})

/**
 * One person in the search results. The people tab already highlighted the
 * match and offered the games of the person (`Hry od X`); the row keeps both
 * and adds the one thing that was missing next to the games and the events —
 * *why* this person is in the list (the engine also matches nicknames and
 * cities, which the row never mentioned).
 */
export const SearchPersonRow = ({ person, query }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const routes = useRoutes()

    const reason = personMatchReason(person, query)
    const meta = [person.city, person.birthDate ? t('Search.userAge', { age: computeAge(person.birthDate) }) : '']
        .filter(Boolean)
        .join(' · ')

    return (
        <div className={classes.row} data-testid={componentTestIds.search.personRow(person.id)}>
            <ProfileImage className={classes.avatar} userId={person.id} imageId={person.image?.id} />
            <div>
                <div className={classes.name}>
                    {person.nickname ? (
                        <>
                            <HighlightedText text={`${person.nickname} `} query={query} />
                        </>
                    ) : null}
                    <UserLink userId={person.id}>
                        <HighlightedText text={person.name} query={query} />
                    </UserLink>
                </div>
                <div className={classes.meta}>
                    {meta || <span className={classes.missing}>{t('Search.personNoCity')}</span>}
                </div>
                {reason && (
                    <div className={classes.why} data-testid={componentTestIds.search.matchReason(person.id)}>
                        {t(reason.kind === 'nickname' ? 'Search.matchNickname' : 'Search.matchCity', { name: reason.name })}
                    </div>
                )}
            </div>
            <div className={classes.link}>
                <TextLink
                    href={routes.gamesOfAuthor(person.id, person.name).href}
                    as={routes.gamesOfAuthor(person.id, person.name).as}
                >
                    {t('Search.userGames', { name: person.name })}
                </TextLink>
            </div>
        </div>
    )
}

export default SearchPersonRow
