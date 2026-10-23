import React from 'react'
import { NextPage } from 'next'
import { AllCommentsPanel } from '../../src/components/Comments/AllCommentsPanel'

interface Props {}
interface InitialProps {}

/**
 * All comments, newest first — the page the homepage's „všechny komentáře“
 * link opens. Like /games for the catalog: one URL, no filters, the pager
 * is the only state (and it lives in the component, not the URL — the
 * listing is a stream of activity, not a search result).
 */
const CommentsPage: NextPage<Props, InitialProps> = () => {
    return <AllCommentsPanel />
}

CommentsPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default CommentsPage
