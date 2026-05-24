import React from 'react'
import {
    faUser,
    faComment,
    faStar,
    faSearch,
    faLocationArrow,
    faChevronCircleLeft,
    faChevronCircleRight,
    faCaretUp,
    faSpinner,
    faPlus,
    faEdit,
    faEye,
    faTrash,
    faExternalLinkSquareAlt,
    faCaretLeft,
    faStarHalfAlt,
    faComments,
    faTimesCircle,
    faBan,
    faExclamationTriangle,
    faBars,
} from '@fortawesome/free-solid-svg-icons'
import { faFacebook } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface IconProps {
    readonly className?: string
}

/* eslint-disable react/jsx-props-no-spreading */
export const IconRating = (props: IconProps) => <FontAwesomeIcon icon={faStar} {...props} />

export const IconStar = (props: IconProps) => <FontAwesomeIcon icon={faStar} {...props} />

export const IconComment = (props: IconProps) => <FontAwesomeIcon icon={faComment} {...props} />

export const IconUser = (props: IconProps) => <FontAwesomeIcon icon={faUser} {...props} />

export const IconSearch = (props: IconProps) => <FontAwesomeIcon icon={faSearch} {...props} />

export const IconLocation = (props: IconProps) => <FontAwesomeIcon icon={faLocationArrow} {...props} />

export const IconMoveLeft = (props: IconProps) => <FontAwesomeIcon icon={faChevronCircleLeft} {...props} />

export const IconMoveRight = (props: IconProps) => <FontAwesomeIcon icon={faChevronCircleRight} {...props} />

export const IconFacebook = (props: IconProps) => <FontAwesomeIcon icon={faFacebook} {...props} />

export const IconCaretUp = (props: IconProps) => <FontAwesomeIcon icon={faCaretUp} {...props} />

export const IconLoading = (props: IconProps) => <FontAwesomeIcon icon={faSpinner} pulse {...props} />

export const IconPlus = (props: IconProps) => <FontAwesomeIcon icon={faPlus} {...props} />

export const IconEdit = (props: IconProps) => <FontAwesomeIcon icon={faEdit} {...props} />

export const IconEye = (props: IconProps) => <FontAwesomeIcon icon={faEye} {...props} />

export const IconTrash = (props: IconProps) => <FontAwesomeIcon icon={faTrash} {...props} />

export const IconExternalLink = (props: IconProps) => <FontAwesomeIcon icon={faExternalLinkSquareAlt} {...props} />

export const IconBack = (props: IconProps) => <FontAwesomeIcon icon={faCaretLeft} {...props} />

export const IconNumRatings = (props: IconProps) => <FontAwesomeIcon icon={faStarHalfAlt} {...props} />

export const IconNumComments = (props: IconProps) => <FontAwesomeIcon icon={faComments} {...props} />

export const IconClose = (props: IconProps) => <FontAwesomeIcon icon={faTimesCircle} {...props} />

export const IconDisabled = (props: IconProps) => <FontAwesomeIcon icon={faBan} {...props} />

export const IconMenu = (props: IconProps) => <FontAwesomeIcon icon={faBars} {...props} />

export const IconExclamationTriangle = (props: IconProps) => <FontAwesomeIcon icon={faExclamationTriangle} {...props} />
