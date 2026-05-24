import React from 'react'
import { Form, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { Placement } from 'react-bootstrap/Overlay'

interface Props {
    readonly label: React.ReactNode
    readonly tooltip?: React.ReactNode
    readonly tooltipId?: string
    readonly placement?: Placement
}

/**
 * Render Form.Check.Label that displays optional tooltip on hover
 *
 * @param label Check label
 * @param tooltip Tooltip to show
 * @param tooltipId Tooltip id (must be present for tooltip to show!)
 * @param placement Tooltip placement (default is top)
 */
const FormCheckLabelWithTooltip = ({ label, tooltip, tooltipId, placement = 'top' }: Props) => {
    if (tooltip && tooltipId) {
        return (
            <OverlayTrigger placement={placement} overlay={<Tooltip id={tooltipId}>{tooltip}</Tooltip>}>
                <Form.Check.Label>{label}</Form.Check.Label>
            </OverlayTrigger>
        )
    }
    return <Form.Check.Label>{label}</Form.Check.Label>
}

export default FormCheckLabelWithTooltip
