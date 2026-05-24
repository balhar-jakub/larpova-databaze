import next from 'next'
import express from 'express'
import path from 'path'
import nextI18NextMiddleware from 'next-i18next/middleware'

import nextI18next from './i18n'
import routes from './routes'
import proxy from './proxy'

const dev = process.env.NODE_ENV !== 'production'

const getEnvFileName = () => {
    const apiEnv = process.env.API_ENV

    if (dev) {
        if (apiEnv === 'staging') {
            return '.env.dev.staging'
        }

        if (apiEnv === 'prod') {
            return '.env.dev.prod'
        }

        return '.env.dev'
    }

    return '.env.prod'
}

require('dotenv').config({
    path: getEnvFileName(),
})

const port = parseInt(process.env.PORT || '3000', 10)
const app = next({ dev })
const handler = routes.getRequestHandler(app)

app.prepare().then(() => {
    const server = express()

    app.setAssetPrefix(process.env.STATIC_PATH)
    server.use(express.static(path.join(__dirname, '../public/static')))
    server.use(nextI18NextMiddleware(nextI18next))

    if (process.env.PROXY_MODE === 'local') {
        // eslint-disable-next-line global-require
        const proxyMiddleware = require('http-proxy-middleware')
        const proxyConfig = proxy(process.env)
        Object.keys(proxyConfig).forEach(context => {
            server.use(proxyMiddleware(context, proxyConfig[context]))
        })
    }

    server.all('*', (req, res) => handler(req, res))

    server.listen(port)

    // eslint-disable-next-line no-console
    console.log(`> Server listening at http://localhost:${port} as ${dev ? 'development' : process.env.NODE_ENV}`)
})
