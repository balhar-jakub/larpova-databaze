import React from 'react'
import { createUseStyles } from 'react-jss'
import { darkTheme } from '../../theme/darkTheme'
import { highlightSegments } from '../../utils/textUtils'

interface Props {
    readonly text?: string | null
    /** What the visitor typed — the same words that selected this row. */
    readonly query?: string | null
    readonly className?: string
}

const useStyles = createUseStyles({
    mark: {
        background: 'transparent',
        color: darkTheme.textGreenDark,
        fontWeight: 700,
        padding: 0,
    },
})

/**
 * Renders a name with the words the query matched emphasized, so a list of
 * results shows why each row is there (`novak` lights up `Novák`). The rule is
 * the one the API engine used to select the row — see `highlightSegments`.
 */
export const HighlightedText = ({ text, query, className }: Props) => {
    const classes = useStyles()
    const segments = highlightSegments(text, query)

    return (
        <span className={className}>
            {segments.map((segment, index) =>
                segment.matched ? (
                    // eslint-disable-next-line react/no-array-index-key
                    <mark key={index} className={classes.mark}>
                        {segment.value}
                    </mark>
                ) : (
                    // eslint-disable-next-line react/no-array-index-key
                    <React.Fragment key={index}>{segment.value}</React.Fragment>
                ),
            )}
        </span>
    )
}

export default HighlightedText
