import React from 'react'
import { createUseStyles } from 'react-jss'
import { Col } from 'react-bootstrap'
import Link from 'next/link'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { GameBaseData } from '../common/GameBaseDataPanel/GameBaseDataPanel'
import { GameEventGrid } from './GameEventGrid'
import { GridHeader } from './GridHeader'
import { breakPoints } from '../../theme/breakPoints'

interface LabelCount {
    readonly id: string
    readonly name?: string | null
    readonly count: number
}

interface Props {
    readonly labels?: LabelCount[]
    readonly games?: (GameBaseData | undefined)[]
}

const useStyles = createUseStyles({
    note: {
        color: darkTheme.textDark,
        fontSize: '0.65rem',
        fontWeight: 400,
        textTransform: 'none',
        marginLeft: 6,
        // On a narrow screen the long note wraps under the title instead of
        // squeezing it; then it needs its own line of room above the chips.
        [`@media(max-width: ${breakPoints.md - 1}px)`]: {
            flexBasis: '100%',
            marginLeft: 0,
            marginTop: 4,
            textAlign: 'center',
        },
    },
    chips: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: 8,
    },
    chip: {
        borderRadius: 14,
        margin: '0 4px 6px',
        padding: '5px 12px',
        fontSize: '0.72rem',
        color: darkTheme.text,
        backgroundColor: darkTheme.backgroundControl,
        '&:hover': {
            backgroundColor: darkTheme.backgroundHover,
            color: darkTheme.text,
        },
    },
    chipCount: {
        color: darkTheme.textDark,
        marginLeft: 4,
    },
    more: {
        textAlign: 'center',
        marginTop: 5,
    },
    moreLink: {
        color: darkTheme.textGreen,
        fontSize: '0.72rem',
    },
})

/**
 * The recommendation is built from the visitor's own taste — the labels of the
 * games they rated 8 or more — and not from the `similar_games` table, which
 * recommends the same games to everybody who liked a given title. The chips say
 * what the block is standing on, so a surprising card can be explained.
 */
export const HomeRecommendedPanel = ({ labels = [], games = [] }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const catalogHref = labels.length
        ? `/games?labels=${labels.map((label) => label.id).sort().join(',')}&mode=any&rating=80`
        : '/games'

    return (
        <Col xl={12}>
            <GridHeader>
                {t('HomePage.recommended')}
                <span className={classes.note}>
                    {t('HomePage.recommendedNote', { labels: labels.map((label) => label.name).join(', ') })}
                </span>
            </GridHeader>
            <div className={classes.chips}>
                {labels.map((label) => (
                    <Link key={label.id} href={`/games?labels=${label.id}`} legacyBehavior>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a className={classes.chip} href={`/games?labels=${label.id}`}>
                            {label.name}
                            <span className={classes.chipCount}>{label.count}</span>
                        </a>
                    </Link>
                ))}
            </div>
            <GameEventGrid elements={games} />
            {games.length > 0 && (
                <div className={classes.more}>
                    <Link href={catalogHref} legacyBehavior>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a className={classes.moreLink} href={catalogHref}>{t('HomePage.seeAll')}</a>
                    </Link>
                </div>
            )}
        </Col>
    )
}
