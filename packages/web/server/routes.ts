const nextRoutes = require('next-routes')

const routes = (module.exports = nextRoutes())

routes.add('homepage', '/')
routes.add('/larp/:name/:lng/:id', 'gameDetail')
routes.add('/profile/:id', 'profile')
routes.add('/group/:id', 'groupDetail')
routes.add('/event/:name/:id', 'eventDetail')
routes.add('/recoverPassword/:token', 'recoverPassword')
routes.add('/gameEdit/:id', 'gameEdit')
routes.add('/eventEdit/:id', 'eventEdit')
routes.add('/games/:ladderType', 'games')

export default routes
