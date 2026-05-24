import React from 'react'
import { Form } from 'react-bootstrap'
import { Form as FinalForm } from 'react-final-form'
import FormTextInputField from '../FormTextInputField'
import { IconStar } from '../../Icons/Icons'

export default { title: 'FormTextInputFieldField' }

interface FormData {
    readonly email: string
}

const validate = (data: FormData) => {
    if (!/^[\\.a-z0-9]+@[\\.a-z0-9]+$/.test(data.email)) {
        return { email: 'Not a valid email' }
    }
    return {}
}

const Wrapper: React.FC<{}> = ({ children }) => (
    <FinalForm<FormData> onSubmit={() => {}} validate={validate} render={() => <Form>{children}</Form>} />
)

export const Email = () => (
    <Wrapper>
        <FormTextInputField name="email" type="email" placeholder="Enter your email" />
    </Wrapper>
)

export const LabelIconTooltip = () => (
    <Wrapper>
        <FormTextInputField
            name="email"
            label="Your email"
            type="email"
            placeholder="Enter your email"
            appendIcon={<IconStar />}
            hint="Your email, dude!"
            showErrorPlaceholder={false}
        />
    </Wrapper>
)
