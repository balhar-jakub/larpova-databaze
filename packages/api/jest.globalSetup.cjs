// Pins the timezone for the whole test run.
//
// The API formats and compares timestamps, so its tests must not depend on the
// ambient zone of whichever machine runs them. CI exports TZ=Europe/Prague at
// the job level; pinning it here makes `yarn test` self-sufficient everywhere
// (dev box, CI, the deployment host) and keeps both packages consistent.
//
// Use `globalSetup`, not `setupFiles`: the test environment is created before
// `setupFiles` run, so a TZ assignment there is applied too late to be observed.
// `globalSetup` runs in the main process before workers are spawned, so the zone
// is inherited by every worker and environment.
module.exports = () => {
    process.env.TZ = 'Europe/Prague'
}
