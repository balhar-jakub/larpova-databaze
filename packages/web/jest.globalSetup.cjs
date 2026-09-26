// Pins the timezone for the whole test run.
//
// `parseDateTime` in src/utils/dateUtils.ts hands "YYYY-MM-DD HH:MM:SS" strings
// to `new Date()`, which interprets them in the *local* zone, and the tests
// assert the resulting UTC hours. That only holds in a Europe/Prague process,
// which is why CI exports TZ=Europe/Prague at the job level — running the suite
// on a machine without it made two dateUtils tests fail.
//
// This has to run as `globalSetup`, not `setupFiles`: the jsdom environment (and
// its cached timezone) is created before `setupFiles` execute, so assigning TZ
// there came too late and changed nothing. `globalSetup` runs in the main process
// before the workers are spawned, so every worker and every environment inherits
// the zone. Verified on Node 26.7.0 — `Intl.DateTimeFormat().resolvedOptions()
// .timeZone` is Europe/Prague inside the tests, with no ambient TZ set.
module.exports = () => {
    process.env.TZ = 'Europe/Prague'
}
