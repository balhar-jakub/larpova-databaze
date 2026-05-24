import React from 'react'
import { Button } from 'react-bootstrap'
import { IconLoading } from '../Icons/Icons'

interface Props {
    readonly submitting: boolean
    readonly disabled?: boolean
    readonly className?: string
}

const SubmitButton: React.FC<Props> = ({ submitting, disabled, className, children }) => (
    <Button variant="dark" type="submit" disabled={submitting || disabled} className={className}>
        {submitting && (
            <>
                <IconLoading />
                &nbsp;
            </>
        )}
        {children}
    </Button>
)

export default SubmitButton
