import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { Row, Col } from 'react-bootstrap'
import Link from 'next/link'
import { BaseCommentData, BaseCommentPanel } from './BaseCommentPanel'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import { toChunks } from '../../utils/chunkUtils'
import { useIsLgOrLarger } from '../../hooks/useMediaQuery'

interface Props {
    readonly comments: (BaseCommentData | undefined)[]
    /** "All comments" — the catalog ordered by how much is written about a game. */
    readonly href?: string
}

export const HPC_COLUMNS = 3
/**
 * One row of three. The block used to show six comments and grow to fifteen on
 * a click, which made it claim half of the page for the least visited content
 * on it (one comment a week); three are enough next to the link.
 */
export const HPC_ROWS = 1

const useStyles = createUseStyles({
    outerWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 0',
    },
    commentsTitle: {
        fontWeight: 700,
        color: darkTheme.textOnLightDark,
        fontSize: '0.9rem',
        textTransform: 'uppercase',
        margin: '20px 0 30px',
    },
    more: {
        marginTop: 15,
    },
    moreLink: {
        color: darkTheme.textGreenDark,
        fontSize: '0.75rem',
        cursor: 'pointer',
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

export const HomePageCommentsPanel = ({ comments, href }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const isLgOrLarger = useIsLgOrLarger()

    const commentsInColumns = toChunks(comments, HPC_ROWS)
    const height = 190 * (isLgOrLarger ? HPC_ROWS : comments.length)

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
            {href && (
                <div className={classes.more}>
                    <Link href={href} legacyBehavior>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a className={classes.moreLink} href={href}>{t('HomePage.allComments')}</a>
                    </Link>
                </div>
            )}
        </WidthFixer>
    )
}
