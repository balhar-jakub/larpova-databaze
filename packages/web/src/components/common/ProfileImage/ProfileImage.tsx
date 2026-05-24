import React from 'react'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { darkTheme } from '../../../theme/darkTheme'

interface Props {
    readonly userId?: string
    readonly imageId?: string
    readonly className?: string
}

const useStyles = createUseStyles({
    profileImage: {
        width: 50,
        height: 50,
        padding: 2,
        marginRight: 15,
        border: `solid 1px ${darkTheme.text}`,
        borderRadius: '50%',
        boxSizing: 'border-box',
    },
})

const DEFAULT_IMAGE_URL = '/images/user-icon.png'

export const ProfileImage = ({ userId, imageId, className }: Props) => {
    const classes = useStyles()

    const imageUrl = userId && imageId ? `/user-icon?id=${userId}&imageId=${imageId}` : DEFAULT_IMAGE_URL

    return <img src={imageUrl} className={classNames(classes.profileImage, className)} alt="" />
}
