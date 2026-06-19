import * as React from 'react'
import App, { AppInitialProps, AppContext } from 'next/app'

import { appWithTranslation } from 'src/lib/i18n'
import { ErrorBoundary } from 'src/components/common/ErrorBoundary/ErrorBoundary'
import { ApolloProvider } from '@apollo/client/index.js'
import { makeClient } from 'src/with/apolloClient'
import { config } from '@fortawesome/fontawesome-svg-core'
import UserContextProvider from 'src/context/UserContext/UserContextProvider'
import { Router } from 'next/router'
import ToastContextProvider from 'src/context/ToastContext/ToastContextProvider'
import { PageHeader } from 'src/components/common/PageHeader/PageHeader'
import { PageFooter } from 'src/components/common/PageFooter/PageFooter'
import { InPlaceSignInContextProvider } from 'src/context/InPlaceSignInContext/InPlaceSignInContextProvider'
import InPlaceSignInWrapper from 'src/components/common/InPlaceSignInWrapper/InPlaceSignInWrapper'

import '@fortawesome/fontawesome-svg-core/styles.css'
import 'react-bootstrap-typeahead/css/Typeahead.css'
import { registerGTagPageview } from '../src/utils/gtag'
import FirstRenderContextProvider from '../src/context/FirstRenderContext/FirstRenderContextProvider'

config.autoAddCss = false

const handlePageChange = (url: URL) => {
    window.scroll({ top: 0, left: 0 })
    registerGTagPageview(url)
}

const useIsBrowser = () => {
    const [isBrowser, setIsBrowser] = React.useState(false)
    React.useEffect(() => setIsBrowser(true), [])
    return isBrowser
}

class WebApp extends App<AppInitialProps> {
    static async getInitialProps({ Component, ctx }: AppContext): Promise<AppInitialProps> {
        const pageProps = Component.getInitialProps ? await Component.getInitialProps(ctx) : {}
        return { pageProps }
    }

    componentDidMount() {
        document.getElementById('server-side-styles')?.remove()
        Router.events.on('routeChangeComplete', handlePageChange)
    }

    componentWillUnmount() {
        Router.events.off('routeChangeComplete', handlePageChange)
    }

    render() {
        const { Component, pageProps } = this.props
        const apolloClient = makeClient()

        return (
            <ErrorBoundary>
                <ToastContextProvider>
                    <ApolloProvider client={apolloClient}>
                        <UserContextProvider>
                            <FirstRenderContextProvider>
                                <InPlaceSignInContextProvider>
                                    <PageHeader />
                                    <InPlaceSignInWrapper>
                                        <ClientHydrationWrapper>
                                            <Component {...pageProps} />
                                        </ClientHydrationWrapper>
                                    </InPlaceSignInWrapper>
                                    <PageFooter />
                                </InPlaceSignInContextProvider>
                            </FirstRenderContextProvider>
                        </UserContextProvider>
                    </ApolloProvider>
                </ToastContextProvider>
            </ErrorBoundary>
        )
    }
}

// Wraps children so they only render after client hydration.
// This avoids the React 18 SSR context propagation issue with ApolloProvider.
// During SSR, renders a hidden placeholder that Next.js hydrates into the real page.
const ClientHydrationWrapper = ({ children }: { children: React.ReactNode }) => {
    const isBrowser = useIsBrowser()
    // suppressHydrationWarning prevents React from complaining about
    // the SSR/client HTML mismatch (SSR renders empty, client renders content)
    return (
        <div suppressHydrationWarning>
            {isBrowser ? children : null}
        </div>
    )
}

ClientHydrationWrapper.displayName = 'ClientHydrationWrapper'

export default appWithTranslation(WebApp)
