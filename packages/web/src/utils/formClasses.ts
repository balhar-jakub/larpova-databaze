import { Styles } from 'react-jss'
import { darkTheme } from '../theme/darkTheme'
import { breakPoints } from '../theme/breakPoints'

export const formSectionHeaderStyles: Styles<'header' | 'headerRight'> = {
    header: {
        backgroundColor: darkTheme.backgroundRealWhite,
        fontSize: '1rem',
        color: darkTheme.textOnLight,
        borderBottom: '1px solid rgba(0,0,0,.1)',
        padding: '8px 8px 8px 18px',
        margin: '0 -15px 12px -18px',
    },
    headerRight: {
        margin: '0 -15px 12px -18px',
    },
}

export const formSectionHeaderStylesMd: Styles<'header' | 'headerRight'> = {
    header: {
        '&:not(.fullWidth)': {
            margin: '0 0 12px -18px',
        },
    },
    headerRight: {
        margin: '0 -15px 12px -18px',
    },
}

/**
 * Common classes to be used in game / event edit form.
 *
 * The key union must be spelled out: with Styles<string>, spreading
 * formClasses into createUseStyles collapses the type to the literal keys of
 * the spread target and drops every shared class (subHeader, helpText, …)
 * from the generated Classes<> type — which is exactly what the ~25 tsc
 * errors in GameEditForm/EventEditForm were.
 */
export type FormClass =
    | 'row'
    | 'form'
    | 'helpText'
    | 'header'
    | 'headerRight'
    | 'subHeader'
    | 'subHeaderNext'
    | 'formError'
    | 'cancelButton'
    | 'labelsCol'
    | 'expandButton'
    | 'expandArrow'

export const formClasses: Styles<FormClass> = {
    row: {
        backgroundColor: darkTheme.backgroundNearWhite,
        padding: '16px 0',
    },
    form: {
        backgroundColor: darkTheme.backgroundWhite,
        color: darkTheme.textOnLight,
        padding: '15px',
    },
    helpText: {
        fontSize: '0.75rem',
    },
    ...formSectionHeaderStyles,
    [`@media(min-width: ${breakPoints.md}px)`]: formSectionHeaderStylesMd,
    subHeader: {
        color: darkTheme.textOnLight,
        borderBottom: '1px solid rgba(0,0,0,.1)',
        marginBottom: 20,
    },
    subHeaderNext: {
        marginTop: 20,
    },
    formError: {
        marginLeft: 16,
        color: darkTheme.red,
    },
    cancelButton: {
        marginRight: 16,
    },
    labelsCol: {},
    [`@media(max-width: ${breakPoints.md - 1}px)`]: {
        labelsCol: {
            marginTop: 16,
            marginBottom: 16,
        },
    },
    expandButton: {
        display: 'block',
        margin: '-6px 0 24px 6px',
        fontSize: '0.9rem',
        borderWidth: 0,
        backgroundColor: 'transparent',
        color: darkTheme.textOnLight,
        '&:hover': {
            color: `${darkTheme.textGreen} !important`,
        },
    },
    expandArrow: {
        marginLeft: 4,
    },
}
