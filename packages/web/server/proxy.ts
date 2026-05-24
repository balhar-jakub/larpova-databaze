require('dotenv').config()

// Change cookie path to /graphql
const transformCookiePath = (cookie: string) => {
    if (cookie.startsWith('JSESSIONID') || cookie.startsWith('LoggedIn')) {
        const parts = cookie.split(';')
        const newParts = parts.map(part => {
            const iEq = part.indexOf('=')
            if (iEq < 0) {
                // No '='
                return part
            }
            let iStart = 0
            while (part[iStart] === ' ') {
                iStart += 1
            }
            if (part.substring(iStart, iEq).toLowerCase() === 'path') {
                // Use / path
                return ' Path=/'
            }

            // Not our cookie
            return part
        })
        return newParts.join(';')
    }

    return cookie
}

/**
 * We must rewrite JSESSION cookie path so that browser sends them in subsequent requests
 */
const onProxyRes = (proxyRes: any) => {
    const setCookie = proxyRes.headers['set-cookie']
    if (setCookie) {
        if (Array.isArray(setCookie)) {
            // eslint-disable-next-line no-param-reassign
            proxyRes.headers['set-cookie'] = setCookie.map(cookie => transformCookiePath(cookie))
        } else {
            // Just a string
            // eslint-disable-next-line no-param-reassign
            proxyRes.headers['set-cookie'] = transformCookiePath(setCookie)
        }
    }
}

const proxy = ({
    API_URL,
    API_PATH,
    USER_ICON_PATH,
    GAME_IMAGE_PATH,
    ICAL_PATH,
    CAL_SYNC_PATH,
}: {
    [key: string]: string | undefined
}): { [key: string]: {} } => ({
    '/graphql': {
        target: API_URL,
        pathRewrite: { '^/graphql': API_PATH },
        changeOrigin: true,
        onProxyRes,
    },
    '/user-icon': {
        target: API_URL,
        pathRewrite: { '^/user-icon': USER_ICON_PATH },
        changeOrigin: true,
    },
    '/game-image': {
        target: API_URL,
        pathRewrite: { '^/game-image': GAME_IMAGE_PATH },
        changeOrigin: true,
    },
    '/ical': {
        target: API_URL,
        pathRewrite: { '^/ical': ICAL_PATH },
        changeOrigin: true,
    },
    '/cal-sync': {
        target: API_URL,
        pathRewrite: { '^/cal-sync': CAL_SYNC_PATH },
        changeOrigin: true,
    },
})

export default proxy
