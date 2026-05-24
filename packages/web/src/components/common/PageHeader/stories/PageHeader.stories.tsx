import React from 'react'
import { MockedProvider } from '@apollo/client/testing'
import { PageHeader } from '../PageHeader'

export default { title: 'PageHeader' }

export const Header = () => (
    <MockedProvider>
        <PageHeader />
    </MockedProvider>
)
