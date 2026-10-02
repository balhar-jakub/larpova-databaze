import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { breakPoints } from '../../theme/breakPoints'

export interface SeasonMonth {
    readonly key: string
    readonly label: string
    readonly count: number
}

interface Props {
    readonly months: SeasonMonth[]
    readonly selectedMonth?: string
    readonly onSelect: (key: string) => void
    readonly hintKey?: string
}

const useStyles = createUseStyles({
    strip: {
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: 6,
        marginBottom: 18,
    },
    cell: {
        backgroundColor: darkTheme.backgroundRealWhite,
        border: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        borderRadius: 5,
        padding: '7px 4px 8px',
        textAlign: 'center',
        cursor: 'pointer',
        font: 'inherit',

        '&:hover': {
            borderColor: darkTheme.textGreenDark,
        },
    },
    selected: {
        borderColor: darkTheme.textGreenDark,
        backgroundColor: '#e8f6f4',
    },
    empty: {
        opacity: 0.55,
    },
    label: {
        fontSize: '0.7rem',
        color: darkTheme.textOnLight,
        whiteSpace: 'nowrap',
    },
    count: {
        fontSize: '1rem',
        fontWeight: 700,
        lineHeight: 1.15,
        color: darkTheme.textGreenDark,
    },
    countEmpty: {
        color: darkTheme.textDark,
    },
    pips: {
        display: 'flex',
        gap: 2,
        justifyContent: 'center',
        marginTop: 3,
        height: 4,
    },
    pip: {
        width: 4,
        height: 4,
        borderRadius: '50%',
        backgroundColor: darkTheme.textGreenDark,
        display: 'block',
    },
    hint: {
        margin: '-10px 0 16px',
        fontSize: '0.7rem',
        color: darkTheme.textOnLightLighter,
    },
    [`@media(max-width: ${breakPoints.md - 1}px)`]: {
        strip: {
            gridTemplateColumns: 'repeat(6, 1fr)',
        },
    },
})

/**
 * The season in one line: twelve months with their number of events. It is the
 * answer to "when is something on?", which the old flat list could not give —
 * and it makes the empty stretches (December, the whole 2024/2025 in history)
 * visible instead of hiding them behind more rows.
 */
const SeasonStrip = ({ months, selectedMonth, onSelect, hintKey }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <>
            <div className={classes.strip} data-testid="calendar.seasonStrip">
                {months.map((month) => (
                    <button
                        type="button"
                        key={month.key}
                        className={`${classes.cell} ${month.count === 0 ? classes.empty : ''} ${
                            month.key === selectedMonth ? classes.selected : ''
                        }`}
                        onClick={() => onSelect(month.key)}
                        title={`${month.label}: ${month.count}`}
                    >
                        <div className={classes.label}>{month.label}</div>
                        <div className={`${classes.count} ${month.count === 0 ? classes.countEmpty : ''}`}>
                            {month.count}
                        </div>
                        <div className={classes.pips}>
                            {Array.from({ length: Math.min(month.count, 6) }, (_, index) => (
                                <i key={index} className={classes.pip} />
                            ))}
                        </div>
                    </button>
                ))}
            </div>
            {hintKey && <div className={classes.hint}>{t(hintKey)}</div>}
        </>
    )
}

export default SeasonStrip
