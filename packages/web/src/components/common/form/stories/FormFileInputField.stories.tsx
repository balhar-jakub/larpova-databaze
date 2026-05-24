import React from 'react'
import { Form } from 'react-bootstrap'
import { Form as FinalForm } from 'react-final-form'
import FormFileInputField from '../FormFileInputField'

export default { title: 'FormFileInputFieldField' }

interface FormData {
    readonly profilePicture?: string
}

const Wrapper: React.FC<{}> = ({ children }) => (
    <FinalForm<FormData>
        onSubmit={() => {}}
        render={({ values }) => (
            <Form>
                <div>PP Length: {values.profilePicture?.length}</div>
                {children}
            </Form>
        )}
    />
)

export const ProfilePicture = () => (
    <Wrapper>
        <FormFileInputField
            name="profilePicture"
            label="Select file"
            placeholder="Add your profile picture"
            hint="Profile picture, please"
            sizeLimit={2000000}
        />
    </Wrapper>
)
