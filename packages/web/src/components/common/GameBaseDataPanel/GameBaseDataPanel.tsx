import React from 'react'
import { Game } from 'src/graphql/__generated__/typescript-operations'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { darkTheme } from '../../../theme/darkTheme'
import { GameRatingBox } from '../GameRatingBox/GameRatingBox'
import { IconRating, IconComment, IconUser } from '../Icons/Icons'
import { GameLink } from '../GameLink/GameLink'
import { useTranslation } from 'src/lib/i18n'

export type GameBaseData = Pick<
    Game,
    'id' | 'name' | 'players' | 'amountOfComments' | 'amountOfRatings' | 'averageRating'
>

interface Props {
    readonly game: GameBaseData
    readonly variant: 'dark' | 'light'
    readonly className?: string
    /**
     * Write the three numbers out ("25 hráčů · 0 komentářů · 77 hodnocení") instead
     * of stacking bare digits under the icons. The homepage — where a visitor
     * reads a card they have never seen before and has no way to tell what
     * "25 0 77 x" means — turns it on; the header's search dropdown, which has to
     * stay one line, keeps the compact form.
     */
    readonly showStatLabels?: boolean
}

const useStyles = createUseStyles({
    wrapperLight: {
        background: darkTheme.backgroundWhite,
        color: darkTheme.textOnLightLighter,
        '&:hover': {
            backgroundColor: darkTheme.backgroundAlmostNearWhite2,
            color: darkTheme.textOnLightLighter,
        },
    },
    wrapperDark: {
        background: darkTheme.backgroundLight,
        color: darkTheme.text,
        '&:hover': {
            backgroundColor: darkTheme.backgroundHover,
            color: darkTheme.text,
        },
    },
    wrapper: {
        display: 'flex',
        flexDirection: 'row',
        borderRadius: 4,
        padding: 15,
        boxSizing: 'border-box',
        overflow: 'hidden',
    },
    rightWrapper: {
        display: 'block',
        minWidth: 0,
    },
    rating: {
        width: 40,
        height: 40,
        flexShrink: 0,
        marginRight: 8,
    },
    name: {
        display: 'block',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontSize: '0.82rem',
        fontWeight: 700,
        marginBottom: 5,
    },
    icons: {
        display: 'block',
        color: darkTheme.textDark,
        fontSize: '0.6rem',
    },
    statValue: {
        margin: '0 8px 0 3px',
    },
})

export const GameBaseDataPanel = ({
    variant,
    game: { id, name, players, amountOfComments, amountOfRatings, averageRating },
    className,
    showStatLabels,
}: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <GameLink
            game={{ id, name }}
            className={classNames({
                [classes.wrapper]: true,
                [classes.wrapperDark]: variant === 'dark',
                [classes.wrapperLight]: variant === 'light',
                [className || 'x']: !!className,
            })}
        >
            <GameRatingBox amountOfRatings={amountOfRatings} rating={averageRating} className={classes.rating} />
            <span className={classes.rightWrapper}>
                <span className={classes.name}>{name}</span>
                <span className={classes.icons}>
                    <IconUser />
                    <span className={classes.statValue}>
                        {showStatLabels ? t('Game.players', { count: players ?? 0 }) : players}
                    </span>
                    <IconComment />
                    <span className={classes.statValue}>
                        {showStatLabels ? t('Catalog.card.comments', { count: amountOfComments }) : amountOfComments}
                    </span>
                    <IconRating />
                    <span className={classes.statValue}>
                        {showStatLabels ? t('Catalog.card.ratings', { count: amountOfRatings }) : `${amountOfRatings} x`}
                    </span>
                </span>
            </span>
        </GameLink>
    )
}
