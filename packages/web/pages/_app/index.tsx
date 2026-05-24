import * as React from 'react'
import App, { AppInitialProps, AppContext } from 'next/app'

import { appWithTranslation } from 'src/lib/i18n'
import { ErrorBoundary } from 'src/components/common/ErrorBoundary/ErrorBoundary'
import { ApolloProvider } from '@apollo/react-hooks'
import { config } from '@fortawesome/fontawesome-svg-core'
import { WithApolloProps } from 'next-with-apollo'
import UserContextProvider from 'src/context/UserContext/UserContextProvider'
import { Router } from 'next/router'
import { withApolloWrapper } from 'src/with/withApolloProvider'
import ToastContextProvider from 'src/context/ToastContext/ToastContextProvider'
import { PageHeader } from 'src/components/common/PageHeader/PageHeader'
import { PageFooter } from 'src/components/common/PageFooter/PageFooter'
import { InPlaceSignInContextProvider } from 'src/context/InPlaceSignInContext/InPlaceSignInContextProvider'
import InPlaceSignInWrapper from 'src/components/common/InPlaceSignInWrapper/InPlaceSignInWrapper'

import '@fortawesome/fontawesome-svg-core/styles.css'
import 'react-bootstrap-typeahead/css/Typeahead.css'
import { registerGTagPageview } from '../../src/utils/gtag'
import FirstRenderContextProvider from '../../src/context/FirstRenderContext/FirstRenderContextProvider'

// Import the CSS
config.autoAddCss = false // Tell Font Awesome to skip adding the CSS automatically since it's being imported above

const handlePageChange = (url: URL) => {
    // Reset window scroll on route change (= when we went to another page)
    window.scroll({
        top: 0,
        left: 0,
    })

    // Register page change to GTag
    registerGTagPageview(url)
}

class WebApp extends App<AppInitialProps & WithApolloProps<any>> {
    static async getInitialProps({ Component, ctx }: AppContext): Promise<AppInitialProps> {
        const pageProps = Component.getInitialProps ? await Component.getInitialProps(ctx) : {}

        return { pageProps }
    }

    componentDidMount() {
        // Remove styles sent from server - we have generated out own
        document.getElementById('server-side-styles')?.remove()

        Router.events.on('routeChangeComplete', handlePageChange)
    }

    componentWillUnmount() {
        Router.events.off('routeChangeComplete', handlePageChange)
    }

    render() {
        const { Component, pageProps, apollo } = this.props

        return (
            <ErrorBoundary>
                <ToastContextProvider>
                    <ApolloProvider client={apollo}>
                        <UserContextProvider>
                            <FirstRenderContextProvider>
                                <InPlaceSignInContextProvider>
                                    <PageHeader />
                                    <InPlaceSignInWrapper>
                                        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
                                        <Component {...pageProps} />
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

export default appWithTranslation(withApolloWrapper(WebApp))
