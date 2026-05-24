import React, { useMemo } from 'react'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { darkTheme } from '../../../theme/darkTheme'
import { generatePageOffsets } from './pagerUtils'
import { useIsMdOrLarger } from '../../../hooks/useMediaQuery'

interface Props {
    readonly currentOffset: number
    readonly totalAmount: number
    readonly pageSize: number
    readonly onOffsetChanged: (newOffset: number) => void
}

const useStyles = createUseStyles({
    buttons: {
        textAlign: 'right',
        marginTop: 5,
    },
    button: {
        border: `1px solid ${darkTheme.text}`,
        margin: 5,
        outline: 0,
        padding: '4px 8px',
        borderRadius: 2,
        fontWeight: 1000,
        fontSize: '0.65rem',
        color: darkTheme.textGreen,
        backgroundColor: darkTheme.backgroundWhite,

        '&:hover': {
            color: darkTheme.textOnLightDark,
        },
    },
    active: {
        backgroundColor: darkTheme.textGreen,
        color: darkTheme.backgroundWhite,
    },
})

const Pager = ({ currentOffset, totalAmount, pageSize, onOffsetChanged }: Props) => {
    const classes = useStyles()
    const isMdOrLarger = useIsMdOrLarger()
    const maxPages = isMdOrLarger ? 10 : 4

    const lastPageOffset = totalAmount - 1 - ((totalAmount - 1) % pageSize)
    const prevPageOffset = Math.max(currentOffset - pageSize, 0)
    const nextPageOffset = Math.min(currentOffset + pageSize, lastPageOffset)
    const pageOffsets = useMemo(() => generatePageOffsets(currentOffset, lastPageOffset, pageSize, maxPages), [
        lastPageOffset,
        currentOffset,
        pageSize,
        maxPages,
    ])

    const firstPageNumber = pageOffsets[0] / pageSize + 1

    return (
        <div className={classes.buttons}>
            <button type="button" className={classes.button} onClick={() => onOffsetChanged(0)}>
                &lt;&lt;
            </button>
            <button type="button" className={classes.button} onClick={() => onOffsetChanged(prevPageOffset)}>
                &lt;
            </button>
            {pageOffsets.map((pageOffset, n) => (
                <button
                    key={pageOffset}
                    type="button"
                    className={classNames({ [classes.button]: true, [classes.active]: pageOffset === currentOffset })}
                    onClick={() => onOffsetChanged(pageOffset)}
                >
                    {n + firstPageNumber}
                </button>
            ))}
            <button type="button" className={classes.button} onClick={() => onOffsetChanged(nextPageOffset)}>
                &gt;
            </button>
            <button type="button" className={classes.button} onClick={() => onOffsetChanged(lastPageOffset)}>
                &gt;&gt;
            </button>
        </div>
    )
}

export default Pager
