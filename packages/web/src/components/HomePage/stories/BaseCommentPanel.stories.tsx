import React from 'react'
import { createUseStyles } from 'react-jss'
import { BaseCommentData, BaseCommentPanel } from '../BaseCommentPanel'
import { darkTheme } from '../../../theme/darkTheme'

export default { title: 'BaseCommentPanel' }

const mockComment: BaseCommentData = {
    id: '123',
    added: '2020-10-26',
    commentAsText:
        '10/10 Antonia Kauri, vězeň č. 1777... a nebo taky ne. :-) Shrnutí: Výborná akce se skvělými organizátory, kteří do hry vkládají opravdu maximum. Určitě to nebyl můj poslední ročník. Velmi ráda pojedu znovu. Mé hodnocení: Je to skvělé!',
    game: {
        id: '123',
        averageRating: 67,
        amountOfRatings: 10,
        name: 'Havraní ostrov - Návrat ztraceného poutníka',
    },
    user: {
        id: '123',
        nickname: 'Triss',
        name: 'Zdenka',
    },
}

const useStyles = createUseStyles({
    storyWrapper: {
        backgroundColor: darkTheme.backgroundNearWhite,
        padding: 20,
    },
})

export const Filled = () => {
    const classes = useStyles()
    return (
        <div className={classes.storyWrapper}>
            <BaseCommentPanel comment={mockComment} />
        </div>
    )
}

export const Loading = () => {
    const classes = useStyles()
    return (
        <div className={classes.storyWrapper}>
            <BaseCommentPanel />
        </div>
    )
}
