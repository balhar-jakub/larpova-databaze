import React from 'react'
import { NextPage } from 'next'
import { PrivacyPolicyPanel } from '../../src/components/Privacy/PrivacyPolicyPanel'

interface Props {}
interface InitialProps {}

/**
 * Zásady ochrany osobních údajů — veřejná stránka bez stavu a bez dat z API.
 *
 * Musí existovat i proto, že ji Google vyžaduje u přihlášení přes Google (odkaz
 * na zásady na veřejné doméně); odkazuje na ni patička na každé stránce a nabídka
 * registrace.
 */
const PrivacyPolicyPage: NextPage<Props, InitialProps> = () => {
    return <PrivacyPolicyPanel />
}

PrivacyPolicyPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default PrivacyPolicyPage
