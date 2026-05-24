import React, { useMemo, useState } from 'react'
import { Toast } from 'react-bootstrap'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { ToastContextShape, ToastContext, ToastKind, toastContextValue } from './ToastContext'
import { darkTheme } from '../../theme/darkTheme'
import { IconClose } from '../../components/common/Icons/Icons'

const HIDE_DELAY = 5000

interface State {
    readonly content?: React.ReactNode
    readonly kind?: ToastKind
}

const useStyles = createUseStyles({
    toast: {
        maxWidth: '70vw',
        position: 'fixed',
        left: '50vw',
        transform: 'translateX(-50%)',
        bottom: 32,
        opacity: 0.8,
        zIndex: '1111', // Show above modal overlay
    },
    body: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    success: {
        backgroundColor: darkTheme.textGreen,
        color: darkTheme.backgroundRealWhite,
    },
    error: {
        backgroundColor: darkTheme.red,
        color: darkTheme.backgroundRealWhite,
    },
    button: {
        border: 0,
        background: 'transparent',
        marginLeft: 16,
        color: 'inherit',
    },
})

const ToastContextProvider: React.FC = ({ children }) => {
    const [value, setValue] = useState<State>({})
    const [toastShown, setToastShown] = useState(false)
    const classes = useStyles()

    const providerValue: ToastContextShape = useMemo(() => {
        const contextValue: ToastContextShape = {
            actions: {
                showToast: (content, kind = 'normal') => {
                    setValue({ content, kind })
                    setToastShown(true)
                },
            },
        }
        // Store action callback to global variable that is used by apollo error resolver.
        // Not nice, but there is no other way :-(
        toastContextValue.actions = contextValue.actions
        return contextValue
    }, [setValue, setToastShown])

    const className = classNames(classes.toast, {
        [classes.success]: value.kind === 'success',
        [classes.error]: value.kind === 'alert',
    })

    const handleClose = () => setToastShown(false)

    return (
        <ToastContext.Provider value={providerValue}>
            {children}
            <Toast
                className={className}
                onClose={handleClose}
                show={toastShown}
                animation
                delay={HIDE_DELAY}
                autohide={value.kind !== 'alert'}
            >
                <Toast.Body className={classes.body}>
                    {value.content}
                    <button type="button" onClick={handleClose} className={classes.button}>
                        <IconClose />
                    </button>
                </Toast.Body>
            </Toast>
        </ToastContext.Provider>
    )
}

export default ToastContextProvider
