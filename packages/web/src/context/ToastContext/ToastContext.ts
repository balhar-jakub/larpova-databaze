import React from 'react'

export type ToastKind = 'normal' | 'success' | 'alert'

export interface ToastContextShape {
    actions: {
        showToast: (content: React.ReactNode, kind?: ToastKind) => void
    }
}

export const toastContextValue: ToastContextShape = { actions: { showToast: () => {} } }

export const ToastContext = React.createContext<ToastContextShape>(toastContextValue)
