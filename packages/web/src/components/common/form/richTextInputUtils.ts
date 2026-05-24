import htmlToDraft from 'html-to-draftjs'
import { ContentState, convertToRaw, EditorState, RawDraftContentBlock } from 'draft-js'
import draftToHtml from 'draftjs-to-html'

const removeEntities = (blocks: RawDraftContentBlock[]) => {
    blocks.forEach(block => {
        // eslint-disable-next-line no-param-reassign
        block.entityRanges = []
    })
    return blocks
}

export const htmlToEditorState = (html: string) => {
    const blocksFromHtml = htmlToDraft(html)
    const { contentBlocks, entityMap } = blocksFromHtml
    const contentState = ContentState.createFromBlockArray(contentBlocks, entityMap)
    return EditorState.createWithContent(contentState)
}

export const editorStateToHtml = (editorState?: EditorState | string) => {
    if (!editorState) {
        return undefined
    }

    if (typeof editorState === 'string') {
        return editorState
    }

    const rawContentState = convertToRaw(editorState.getCurrentContent())
    // By removing entities we get rid of links and let server create them as we seem fit
    // Currently we can just remove all entities. We could check entityMap whether it is
    // actually a link.
    removeEntities(rawContentState.blocks)
    return draftToHtml(rawContentState)
}
