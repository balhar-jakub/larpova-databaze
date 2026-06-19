module.exports = {
  i18n: {
    defaultLocale: 'cs',
    locales: ['cs', 'en'],
  },
  ns: ['common'],
  defaultNS: 'common',
  localePath: typeof window === 'undefined'
    ? require('path').resolve('./public/static/locales')
    : '/static/locales',
};
