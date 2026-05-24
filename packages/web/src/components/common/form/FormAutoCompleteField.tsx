import React, { ReactNode, useRef, useState } from 'react'
import { FieldValidator } from 'final-form'
import {
    AsyncTypeahead,
    Menu,
    MenuItem,
    TypeaheadLabelKey,
    TypeaheadMenuProps,
    TypeaheadModel,
    TypeaheadResult,
} from 'react-bootstrap-typeahead'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import { useField } from 'react-final-form'
import { darkTheme } from '../../../theme/darkTheme'
import { IconExternalLink } from '../Icons/Icons'
import FieldWithError from './FieldWithError'

type ModelBase = TypeaheadModel & { readonly id?: string; readonly itemLabel: string }

interface Props<T extends ModelBase> {
    readonly name: string
    readonly placeholder?: string
    readonly hint?: string
    readonly validate?: FieldValidator<T[]>
    readonly createUrl?: (item: T) => string
    readonly createNewText?: ReactNode
    readonly entityLinkText?: ReactNode
    readonly loading?: boolean
    readonly onCreateNew: () => void
    readonly onSearch: (query: string) => Promise<T[]>
}

interface RenderMenuProps<T> {
    readonly createUrl?: (item: T) => string
    readonly createNewText?: ReactNode
    readonly entityLinkText?: ReactNode
    readonly onCreateNew: () => void
}

interface OptionsMenuProps<T extends ModelBase> extends RenderMenuProps<T> {
    readonly results: Array<TypeaheadResult<T>>
    readonly menuProps: TypeaheadMenuProps<T>
}

const useStyles = createUseStyles({
    createButton: {
        display: 'block',
        margin: '8px auto',
    },
    message: {
        padding: 8,
        textAlign: 'center',
    },
    link: {
        marginLeft: 8,
        color: darkTheme.textGreen,

        '&:hover': {
            color: darkTheme.text,
        },
    },
})

const openLink = (href: string) => (e: React.MouseEvent) => {
    window.open(href, '_blank')
    e.preventDefault()
    e.stopPropagation()
}

const NO_RESULTS = ''

const OptionsMenu = <T extends ModelBase>({
    results,
    menuProps,
    createUrl,
    createNewText,
    entityLinkText,
    onCreateNew,
}: OptionsMenuProps<T>) => {
    const { t } = useTranslation()
    const classes = useStyles()

    const noResults = results.length === 1 && results[0].id === NO_RESULTS
    const searching = results.length === 0

    return (
        // eslint-disable-next-line react/jsx-props-no-spreading
        <Menu {...menuProps}>
            {searching && <div className={classes.message}>{t('AutoComplete.searching')}</div>}
            {noResults && <div className={classes.message}>{t('AutoComplete.noResults')}</div>}
            {!noResults &&
                results.map((item, position) => (
                    <MenuItem<T> key={item.id || position} option={item} position={position}>
                        {item.itemLabel}
                        {createUrl && (
                            <span role="link" tabIndex={0} className={classes.link} onClick={openLink(createUrl(item))}>
                                {entityLinkText} <IconExternalLink />
                            </span>
                        )}
                    </MenuItem>
                ))}
            <Button variant="dark" onClick={onCreateNew} size="sm" className={classes.createButton}>
                {createNewText}
            </Button>
        </Menu>
    )
}

const renderMenuHof = <T extends ModelBase>(rmp: RenderMenuProps<T>) => (
    results: Array<TypeaheadResult<T>>,
    menuProps: TypeaheadMenuProps<T>,
) => {
    return (
        <OptionsMenu<T>
            results={results}
            menuProps={menuProps}
            entityLinkText={rmp.entityLinkText}
            createNewText={rmp.createNewText}
            createUrl={rmp.createUrl}
            onCreateNew={rmp.onCreateNew}
        />
    )
}

const FormAutoCompleteField = <T extends ModelBase>({
    name,
    placeholder,
    hint,
    validate,
    createUrl,
    createNewText,
    entityLinkText,
    loading,
    onCreateNew,
    onSearch,
}: Props<T>) => {
    const [options, setOptions] = useState<T[]>([])
    const typeaheadRef = useRef<AsyncTypeahead<any> | null>(null)
    const { input, meta } = useField<T[]>(name, {
        validate,
    })

    const handleSearch = async (query: string) => {
        onSearch(query).then(data => {
            if (data.length === 0) {
                setOptions([{ id: NO_RESULTS, itemLabel: '' } as T])
            } else {
                setOptions(data)
            }
        })
    }

    const handleCreateNew = () => {
        const ta = typeaheadRef.current
        if (ta) {
            // Clear input when new item modal is shown. Bit dirty, but there's no better way :-(
            ta.setState(oldState => ({ ...oldState, text: '' }))
        }
        onCreateNew()
    }

    const renderMenu = renderMenuHof<T>({
        createUrl,
        createNewText,
        entityLinkText,
        onCreateNew: handleCreateNew,
    })

    return (
        <FieldWithError meta={meta} hint={hint}>
            {isInvalid => (
                <AsyncTypeahead<T>
                    placeholder={placeholder}
                    ref={typeaheadRef}
                    id={name}
                    inputProps={{ id: `${name}-input` }}
                    onSearch={handleSearch}
                    isLoading={!!loading}
                    options={options}
                    selected={input.value}
                    isInvalid={isInvalid}
                    useCache={false}
                    multiple
                    minLength={3}
                    filterBy={() => true}
                    onChange={value => input.onChange({ target: { value } })}
                    labelKey={'itemLabel' as TypeaheadLabelKey<T>}
                    renderMenu={renderMenu}
                />
            )}
        </FieldWithError>
    )
}

export default FormAutoCompleteField
