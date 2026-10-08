import fs from 'fs'
import path from 'path'

/**
 * Every document that feeds UserProfilePanel has to select `gender`, otherwise
 * the profile falls back to "Hrál/a jsem" even for a user who set their gender.
 * The profile is loaded through three different documents and the inline copy in
 * OtherUserProfileContainer had already been missed once.
 */
// Resolved from the package root (jest's cwd) so the test works whichever
// module system the runner picks for this file.
const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), 'src/components/Profile', p), 'utf8')

describe('documents feeding the profile panel select gender', () => {
    it('the shared fragment selects gender', () => {
        expect(read('graphql/fragments.graphql')).toMatch(/fragment userProfileData on User \{[\s\S]*?\bgender\b/)
    })

    it('the current user profile document uses that fragment', () => {
        expect(read('graphql/loadCurrentUserProfile.graphql')).toMatch(/\.\.\.userProfileData/)
    })

    it('the inline document in OtherUserProfileContainer selects gender', () => {
        const document = read('OtherUserProfileContainer.tsx').match(/const GQL = `([\s\S]*?)`/)?.[1] ?? ''
        expect(document).toMatch(/userById\(userId: \$userId\) \{[\s\S]*?\bgender\b/)
    })

    it('the settings document selects gender as well', () => {
        expect(read('graphql/loadCurrentUserSettings.graphql')).toMatch(/\bgender\b/)
    })
})
