import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { Button } from 'react-bootstrap'
import { darkTheme } from '../../theme/darkTheme'
import { useLoggedInUser } from '../../hooks/useLoggedInUser'
import { genderContext } from '../../utils/genderUtils'

interface Props {
    readonly onDismiss: () => void
}

const useStyles = createUseStyles({
    text: {
        fontSize: '0.75rem',
        color: darkTheme.text,
        width: 355,
        textAlign: 'left',
        marginBottom: 16,
    },
})

const AuthorWarningPanel = ({ onDismiss }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    // "Jste uveden/a jako autor" — the reader is the author of this game.
    const gender = genderContext(useLoggedInUser()?.gender)

    return (
        <div>
            <p className={classes.text}>{t('GameDetail.ownRatingWarning', { context: gender })}</p>
            <Button variant="light" size="sm" onClick={onDismiss}>
                {t('GameDetail.ownRatingWarningDismiss')}
            </Button>
        </div>
    )
}

export default AuthorWarningPanel
