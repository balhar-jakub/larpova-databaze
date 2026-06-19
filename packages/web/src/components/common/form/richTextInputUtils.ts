import { ContentState, convertToRaw, EditorState, RawDraftContentBlock } from 'draft-js'
import draftToHtml from 'draftjs-to-html'

const removeEntities = (blocks: RawDraftContentBlock[]) => {
    blocks.forEach(block => {
        // eslint-disable-next-line no-param-reassign
        block.entityRanges = []
    })
    return blocks
}

// Dynamic import — html-to-draftjs references `window` and cannot be loaded during SSR
let htmlToDraft: ((html: string) => { contentBlocks: any; entityMap: any }) | null = null;
async function getHtmlToDraft() {
    if (!htmlToDraft) {
        const mod = await import('html-to-draftjs');
        htmlToDraft = mod.default;
    }
    return htmlToDraft;
}

export const htmlToEditorState = async (html: string) => {
    const fn = await getHtmlToDraft();
    const blocksFromHtml = fn(html)
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
