import React from 'react'
import { createUseStyles } from 'react-jss'
import { darkTheme } from '../../../theme/darkTheme'
import { BaseCommentData } from '../BaseCommentPanel'
import { HomePageCommentsPanel } from '../HomePageCommentsPanel'

export default { title: 'HomePageCommentsPanel' }

const useStyles = createUseStyles({
    storyWrapper: {
        backgroundColor: darkTheme.backgroundNearWhite,
        padding: 20,
    },
})

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

/** Three comments — the block is one row now, the rest lives in the catalog. */
const mockComments = [
    { ...mockComment, id: '1' },
    { ...mockComment, id: '2' },
    { ...mockComment, id: '3' },
]

export const Panel = () => {
    const classes = useStyles()

    return (
        <div className={classes.storyWrapper}>
            <HomePageCommentsPanel comments={mockComments} href="/games?order=MostCommented" />
        </div>
    )
}
