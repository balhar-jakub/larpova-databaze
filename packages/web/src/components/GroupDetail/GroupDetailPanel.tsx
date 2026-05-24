import React, { useState } from 'react'
import { useQuery } from '@apollo/client'
import { createUseStyles } from 'react-jss'
import { Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import isInBrowser from 'is-in-browser'
import { LoadGroupQuery, LoadGroupQueryVariables } from '../../graphql/__generated__/typescript-operations'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import { useLoggedInUser } from '../../hooks/useLoggedInUser'
import { isAtLeastEditor } from '../../utils/roleUtils'
import ActionButton from '../common/ActionButton/ActionButton'
import GroupEditModal from './GroupEditModal'
import { IconPlus } from '../common/Icons/Icons'
import DetailGameList from '../common/DetailGameList/DetailGameList'
import { useShowToast } from '../../hooks/useShowToast'

const loadGroupGql = require('./graphql/loadGroup.graphql')

interface Props {
    readonly groupId: string
}

const useStyles = createUseStyles({
    wrapper: {
        backgroundColor: darkTheme.background,
        padding: '20px 0',
    },
    header: {
        fontSize: '1.75rem',
        fontWeight: 'bold',
        marginBottom: '0.3rem',
        color: darkTheme.textGreen,
        lineHeight: '100%',
    },
    text: {
        fontSize: '0.75rem',
        color: darkTheme.textLighter,
    },
    details: {
        backgroundColor: darkTheme.backgroundNearWhite,
        minHeight: 200,
        paddingTop: 20,
        paddingBottom: 20,
    },
    authoredGames: {
        display: 'flex',
        flexWrap: 'wrap',
        marginRight: -20,
        marginBottom: 30,
    },
    authoredGame: {
        width: 425,
        margin: '10px 20px 10px 0',
    },
})

const GroupDetailPanel = ({ groupId }: Props) => {
    const { data, refetch } = useQuery<LoadGroupQuery, LoadGroupQueryVariables>(loadGroupGql, {
        skip: !isInBrowser,
        fetchPolicy: 'cache-and-network',
        variables: {
            groupId,
        },
    })

    const [dialogShown, setDialogShown] = useState<false | 'create' | 'edit'>(false)
    const classes = useStyles()
    const { t } = useTranslation('common')
    const loggedInUser = useLoggedInUser()
    const showToast = useShowToast()

    const name = data?.groupById?.name || ' '
    const authorsOf = data?.groupById?.authorsOf || []

    const handleAddGroup = () => {
        setDialogShown('create')
    }

    const handleEditGroup = () => {
        setDialogShown('edit')
    }

    const handleHideModal = (saved?: boolean) => {
        const dialogShownSave = dialogShown
        setDialogShown(false)
        if (saved) {
            refetch()
            showToast(
                t(dialogShownSave === 'edit' ? 'GroupDetail.groupUpdated' : 'GroupDetail.groupCreated'),
                'success',
            )
        }
    }

    return (
        <>
            <div className={classes.wrapper}>
                <WidthFixer>
                    <div className={classes.header}>{name}</div>
                    <div className={classes.text}>
                        {data?.groupById ? t('GroupDetail.authorsOf', { count: authorsOf.length }) : ' '}
                    </div>
                </WidthFixer>
            </div>
            <div className={classes.details}>
                <WidthFixer>
                    {data?.groupById && (
                        <Row>
                            <Col md={9}>
                                <DetailGameList games={authorsOf} />
                            </Col>
                            <Col md={3}>
                                {isAtLeastEditor(loggedInUser?.role) && (
                                    <>
                                        <ActionButton onClick={handleAddGroup}>
                                            <IconPlus /> {t('GroupDetail.createGroup')}
                                        </ActionButton>
                                        <ActionButton onClick={handleEditGroup}>
                                            {' '}
                                            {t('GroupDetail.editGroup')}
                                        </ActionButton>
                                    </>
                                )}
                            </Col>
                        </Row>
                    )}
                </WidthFixer>
            </div>
            {dialogShown && (
                <GroupEditModal
                    id={dialogShown === 'edit' ? groupId : undefined}
                    initialName={dialogShown === 'edit' ? name : ''}
                    onHide={handleHideModal}
                />
            )}
        </>
    )
}

export default GroupDetailPanel
