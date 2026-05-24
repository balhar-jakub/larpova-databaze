import * as React from 'react'
import Document, { Html, Head, Main, NextScript, DocumentContext } from 'next/document'
import { createGenerateId, JssProvider, SheetsRegistry } from 'react-jss'
import { darkTheme } from '../../src/theme/darkTheme'
import { GA_TRACKING_ID } from '../../src/utils/gtag'

const globalStyle = `
    body {
        margin: 0;
          font-family: Open Sans, sans-serif;
          font-size: 16px;
          background-color: ${darkTheme.backgroundLight};
          box-sizing: border-box;
          overflow-y: scroll;
    }
    
    body.modal-open #mainNav {
        right: 16px;
    }
        
    a {
        text-decoration: none;
        color: #6dc8b7;
    }
    
    a:hover {
        text-decoration: none;
        color: #afafaf;
    }
    
    a:focus, button:focus {
        outline-offset: 2px;    
        outline: 1px dotted rgba(128, 128, 128, 0.7);
    }
    `

const initGA = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_TRACKING_ID}', {
page_path: window.location.pathname,
});
`

class WebAppDocument extends Document {
    static async getInitialProps(ctx: DocumentContext) {
        /**
         * Decorate first render with SheetsRegistry and then put generated CSS into output
         */
        const registry = new SheetsRegistry()
        const generateId = createGenerateId()
        const originalRenderPage = ctx.renderPage
        ctx.renderPage = () =>
            originalRenderPage({
                enhanceApp: App => props => (
                    <JssProvider registry={registry} generateId={generateId}>
                        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
                        <App {...props} />
                    </JssProvider>
                ),
            })

        const initialProps = await Document.getInitialProps(ctx)
        return {
            ...initialProps,
            styles: (
                <>
                    {initialProps.styles}
                    <style id="server-side-styles">{registry.toString()}</style>
                </>
            ),
        }
    }

    render() {
        return (
            <Html>
                <Head>
                    <link rel="shortcut icon" href="/images/favicon.png" />
                    <link
                        rel="stylesheet"
                        href="//fonts.googleapis.com/css?family=Open+Sans:300italic,400italic,600italic,700italic,800italic,400,300,600,700,800&subset=latin,latin-ext,cyrillic-ext,cyrillic"
                    />
                    <link
                        rel="stylesheet"
                        href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css"
                        integrity="sha384-9aIt2nRpC12Uk9gS9baDl411NQApFmC26EwAOH8WgZl5MYYxFfc+NcPb1dKGj7Sk"
                        crossOrigin="anonymous"
                    />
                    <style type="text/css">{globalStyle}</style>
                    {/* Global Site Tag (gtag.js) - Google Analytics */}
                    <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`} />
                    <script
                        /* eslint-disable-next-line react/no-danger */
                        dangerouslySetInnerHTML={{
                            __html: initGA,
                        }}
                    />
                </Head>
                <body>
                    <Main />
                    <NextScript />
                </body>
            </Html>
        )
    }
}

export default WebAppDocument
