import React from 'react'
import ActionButton from './ActionButton'

export default { title: 'ActionButton' }

export const Button = () => (
    <div style={{ width: 200 }}>
        <ActionButton onClick={() => {}}>Edit game</ActionButton>
    </div>
)
