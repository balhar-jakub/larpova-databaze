import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import { Row, Col } from 'react-bootstrap'
import { BaseCommentData, BaseCommentPanel } from './BaseCommentPanel'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import { toChunks } from '../../utils/chunkUtils'
import { useIsLgOrLarger } from '../../hooks/useMediaQuery'

interface Props {
    readonly comments: (BaseCommentData | undefined)[]
    readonly expanded: boolean
    readonly onToggleExpanded: () => void
}

export const HPC_COLUMNS = 3
export const HPC_ROWS_NORMAL = 2
export const HPC_ROWS_EXPANDED = 5

const useStyles = createUseStyles({
    outerWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pading: '20px 0',
    },
    commentsTitle: {
        fontWeight: 700,
        color: darkTheme.textOnLightDark,
        fontSize: '0.9rem',
        textTransform: 'uppercase',
        margin: '20px 0 30px',
    },
    buttonWrapper: {
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
    },
    commentsMoreLess: {
        background: darkTheme.backgroundAlmostNearWhite2,
        color: darkTheme.textOnLight,
        fontSize: '0.7rem',
        borderRadius: 4,
        outline: 0,
        border: 0,
        textAlign: 'center',
        maxWidth: 380,
        flexGrow: 1,
        padding: 5,
        margin: '-5px 12px 0',

        '&:hover': {
            background: darkTheme.backgroundAlmostNearWhite,
        },
    },
    commentsWrapper: {
        width: '100%',
        justifyContent: 'space-between',
        transition: 'height 0.3s ease-in',
        overflow: 'hidden',
    },
    commentsColumn: {
        display: 'flex',
        flexDirection: 'column',
    },
})

export const HomePageCommentsPanel = ({ comments, expanded, onToggleExpanded }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const isLgOrLarger = useIsLgOrLarger()

    const numInColumn = expanded ? HPC_ROWS_EXPANDED : HPC_ROWS_NORMAL
    const commentsInColumns = toChunks(comments, numInColumn)

    const height = 190 * (isLgOrLarger ? numInColumn : comments.length)

    return (
        <WidthFixer className={classes.outerWrapper}>
            <div className={classes.commentsTitle}>{t('HomePage.recentComments')}</div>
            <Row className={classes.commentsWrapper} style={{ height }}>
                {commentsInColumns.map((column, n) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <Col lg={4} className={classes.commentsColumn} key={`col_${n}`}>
                        {column.map((comment, i) => (
                            <BaseCommentPanel key={comment ? comment.id : `c_${n}_${i}`} comment={comment} />
                        ))}
                    </Col>
                ))}
            </Row>
            <div className={classes.buttonWrapper}>
                <button type="button" className={classes.commentsMoreLess} onClick={onToggleExpanded}>
                    {t(expanded ? 'HomePage.commentsShrink' : 'HomePage.commentsExpand')}
                </button>
            </div>
        </WidthFixer>
    )
}
