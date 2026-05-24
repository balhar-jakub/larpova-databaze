import React, { useContext } from 'react'
import { InPlaceSignInContext } from '../../../context/InPlaceSignInContext/InPlaceSignInContext'
import SignInPanel from '../../SignIn/SignInPanel'

const InPlaceSignInWrapper: React.FC = ({ children }) => {
    const context = useContext(InPlaceSignInContext)

    if (context.value) {
        return <SignInPanel stayOnPage onSuccess={() => context.setValue(false)} />
    }

    return <>{children}</>
}

export default InPlaceSignInWrapper
