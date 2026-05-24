import React, { useState } from 'react'
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

const mockComments = [
    { ...mockComment, id: '1', comment: 'Comment 1' },
    { ...mockComment, id: '2', comment: 'Comment 2' },
    { ...mockComment, id: '3', comment: 'Comment 3' },
    { ...mockComment, id: '4', comment: 'Comment 4' },
    { ...mockComment, id: '5', comment: 'Comment 5' },
    { ...mockComment, id: '6', comment: 'Comment 6' },
    { ...mockComment, id: '7', comment: 'Comment 7' },
    { ...mockComment, id: '8', comment: 'Comment 8' },
    { ...mockComment, id: '9', comment: 'Comment 9' },
    { ...mockComment, id: '10', comment: 'Comment 10' },
    { ...mockComment, id: '11', comment: 'Comment 11' },
    { ...mockComment, id: '12', comment: 'Comment 12' },
    undefined,
    undefined,
    undefined,
]

export const Panel = () => {
    const classes = useStyles()
    const [expanded, setExpanded] = useState(false)

    const handleToggleExpanded = () => setExpanded(old => !old)

    return (
        <div className={classes.storyWrapper}>
            <HomePageCommentsPanel
                comments={mockComments.slice(0, expanded ? 15 : 6)}
                expanded={expanded}
                onToggleExpanded={handleToggleExpanded}
            />
        </div>
    )
}
