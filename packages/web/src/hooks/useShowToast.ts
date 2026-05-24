import { useContext } from 'react'
import { ToastContext } from '../context/ToastContext/ToastContext'

/**
 * Returns action to show toast. Do NOT put nodes with references to your component there, simple text nodes are best!
 */
export const useShowToast = () => {
    const toastContext = useContext(ToastContext)
    return toastContext.actions.showToast
}
