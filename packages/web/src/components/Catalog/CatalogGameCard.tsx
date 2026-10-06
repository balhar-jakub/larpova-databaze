import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { CatalogGameDataFragment } from '../../graphql/__generated__/typescript-operations'
import { GameRatingBox } from '../common/GameRatingBox/GameRatingBox'
import { GameLink } from '../common/GameLink/GameLink'
import { IconNumComments, IconNumRatings, IconUser } from '../common/Icons/Icons'
import { componentTestIds } from '../componentTestIds'

interface Props {
    readonly game: CatalogGameDataFragment
}

const useStyles = createUseStyles({
    card: {
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: darkTheme.backgroundRealWhite,
        borderRadius: 5,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
    },
    cover: {
        position: 'relative',
        // Keeps every card the same height even when a game has no image.
        paddingTop: '56.25%',
        backgroundColor: darkTheme.backgroundNearWhite,
    },
    coverImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    initials: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.7rem',
        fontWeight: 700,
        color: darkTheme.backgroundRealWhite,
        background: `linear-gradient(135deg, ${darkTheme.textGreen}, ${darkTheme.textGreenDark})`,
    },
    rating: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    body: {
        flex: 1,
        padding: '10px 12px 6px',
    },
    name: {
        margin: '0 0 4px',
        fontSize: '1rem',
        lineHeight: 1.25,
        fontWeight: 400,

        '& a': {
            color: darkTheme.textGreenDark,
        },

        '& a:hover': {
            color: darkTheme.textOnLightDark,
        },
    },
    meta: {
        marginBottom: 7,
        fontSize: '0.7rem',
        color: darkTheme.textOnLightLighter,
    },
    chip: {
        display: 'inline-block',
        margin: '0 4px 4px 0',
        padding: '1px 7px',
        borderRadius: 9,
        backgroundColor: darkTheme.backgroundNearWhite,
        color: darkTheme.textOnLight,
        fontSize: '0.65rem',
    },
    footer: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 12px',
        borderTop: `1px solid ${darkTheme.backgroundNearWhite}`,
        color: darkTheme.textOnLightLighter,
        fontSize: '0.7rem',
    },
    icon: {
        marginLeft: 3,
        color: darkTheme.textGreen,
    },
    played: {
        marginLeft: 'auto',
    },
})

// No \p{L} here: the Babel pipeline used by next build cannot parse Unicode
// property escapes, and splitting on separators is enough for initials.
const initialsOf = (name?: string | null) =>
    (name ?? '')
        .split(/[\s:.\-–—/]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('')

/**
 * One game in the catalog grid: cover (38 % of games have one, the rest get
 * their initials), the recommendation square, the facts the database actually
 * has, and the labels.
 */
const CatalogGameCard = ({ game }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const imageUrl = game.coverImage
        ? `/game-image/?id=${game.id}&imageId=${game.coverImage.id}`
        : undefined

    const duration = game.days
        ? t('Game.days', { count: game.days })
        : game.hours
        ? t('Game.hours', { count: game.hours })
        : t('Catalog.card.durationUnknown')

    const meta = [
        game.year ? t('Game.year', { count: game.year }) : t('Catalog.card.noYear'),
        duration,
        game.players ? t('Game.players', { count: game.players }) : undefined,
    ].filter(Boolean)

    // Half the database has no comments and many games nobody played — a row of
    // zeroes would only add noise, so only the counts that mean something show up.
    const stats = [
        { key: 'ratings', count: game.amountOfRatings, Icon: IconNumRatings, played: false },
        { key: 'comments', count: game.amountOfComments, Icon: IconNumComments, played: false },
        { key: 'played', count: game.amountOfPlayed, Icon: IconUser, played: true },
    ].filter((stat) => stat.count > 0)

    return (
        <article className={classes.card} data-testid={componentTestIds.catalog.card(game.id)}>
            <div className={classes.cover}>
                {imageUrl && <img className={classes.coverImage} src={imageUrl} alt="" loading="lazy" />}
                {!imageUrl && <div className={classes.initials}>{initialsOf(game.name)}</div>}
                <GameRatingBox
                    className={classes.rating}
                    amountOfRatings={game.amountOfRatings}
                    averageRating={game.averageRating}
                    onPhoto
                    size="small"
                />
            </div>
            <div className={classes.body}>
                <h3 className={classes.name}>
                    <GameLink game={game}>{game.name}</GameLink>
                </h3>
                <div className={classes.meta}>{meta.join(' · ')}</div>
                <div>
                    {game.labels.map((label) => (
                        <span className={classes.chip} key={label.id}>
                            {label.name}
                        </span>
                    ))}
                </div>
            </div>
            {stats.length > 0 && (
                <div className={classes.footer}>
                    {stats.map(({ key, count, Icon, played }) => (
                        <span
                            key={key}
                            className={played ? classes.played : undefined}
                            title={t(`Catalog.card.${key}`, { count })}
                        >
                            {count}x
                            <Icon className={classes.icon} />
                        </span>
                    ))}
                </div>
            )}
        </article>
    )
}

export default CatalogGameCard
