import React from 'react'
import { Form as FinalForm } from 'react-final-form'
import { Form } from 'react-bootstrap'
import FormCheckBoxField from '../FormCheckBoxField'

export default { title: 'FormCheckBoxField' }

interface FormData {
    readonly agree: boolean
}

const validate = (data: FormData) => {
    if (!data.agree) {
        return { email: 'Not a valid email' }
    }
    return {}
}

const Wrapper: React.FC<{}> = ({ children }) => (
    <FinalForm<FormData> onSubmit={() => {}} validate={validate} render={() => <Form>{children}</Form>} />
)

export const CheckBox = () => (
    <Wrapper>
        <FormCheckBoxField name="agree" label="Agree to terms" />
    </Wrapper>
)
