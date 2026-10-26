const tagWhitelist: { [key: string]: boolean | undefined } = {
    A: true,
    ABBR: true,
    B: true,
    BODY: true,
    BLOCKQUOTE: true,
    BR: true,
    CODE: true,
    DIV: true,
    EM: true,
    FONT: true,
    H1: true,
    H2: true,
    H3: true,
    H4: true,
    H5: true,
    H6: true,
    HR: true,
    I: true,
    IMG: true,
    INS: true,
    LABEL: true,
    LI: true,
    OL: true,
    P: true,
    PRE: true,
    SMALL: true,
    SOURCE: true,
    SPAN: true,
    STRONG: true,
    TABLE: true,
    TBODY: true,
    TR: true,
    TD: true,
    TH: true,
    THEAD: true,
    UL: true,
    U: true,
}

const contentTagWhiteList: { [key: string]: boolean | undefined } = { FORM: true } // tags that will be converted to DIVs

const attributeWhitelist: { [key: string]: boolean | undefined } = {
    align: true,
    color: true,
    controls: true,
    height: true,
    href: true,
    rel: true,
    src: true,
    style: true,
    target: true,
    title: true,
    type: true,
    width: true,
}

const cssWhitelist: { [key: string]: boolean | undefined } = {
    color: true,
    'background-color': true,
    'font-size': true,
    'text-align': true,
    'text-decoration': true,
    'font-weight': true,
}

const schemaWhiteList = ['http:', 'https:', 'ftp:'] // which "protocols" are allowed in "href", "src" etc

const uriAttributes: { [key: string]: boolean | undefined } = { href: true, action: true }

const startsWithAny = (str: string, substrings: string[]) => substrings.some(start => str.startsWith(start))

/** A URI attribute may carry `javascript:` and friends — only the listed
 * URL schemas pass. A value with a colon that matches no schema is dropped. */
const isSafeUri = (value: string) =>
    value.indexOf(':') === -1 || startsWithAny(value, schemaWhiteList)

/** Copy the whitelisted `style` properties of one node onto its sanitized
 * copy, property by property — only the CSS whitelist passes. */
const copyStyleProperties = (node: HTMLElement, newNode: HTMLElement) => {
    for (let s = 0; s < node.style.length; s += 1) {
        const styleName = node.style[s]
        if (cssWhitelist[styleName]) {
            newNode.style.setProperty(styleName, node.style.getPropertyValue(styleName))
        }
    }
}

/** Copy the whitelisted attributes of one node onto its sanitized copy:
 * plain attributes verbatim, `style` filtered property by property, URI
 * attributes dropped when their schema is not whitelisted. */
const copyAttributes = (node: HTMLElement, newNode?: HTMLElement) => {
    for (let i = 0; i < node.attributes.length; i += 1) {
        const attr = node.attributes[i]
        if (!attributeWhitelist[attr.name] || !newNode) continue
        if (attr.name === 'style') {
            copyStyleProperties(node, newNode)
        } else if (uriAttributes[attr.name]) {
            // a "uri" attribute can have "javascript:" or something
            if (isSafeUri(attr.value)) newNode.setAttribute(attr.name, attr.value)
        } else {
            newNode.setAttribute(attr.name, attr.value)
        }
    }
}

/**
 * Sanitizes HTML using the browser. Adapted from: https://github.com/jitbit/HtmlSanitizer/blob/master/HtmlSanitizer.js
 *
 * @param inputHtml Input HTML string
 *
 * @return Sanitized HTML string
 */
export const sanitizeHtml = (inputHtml: string | null | undefined) => {
    const input = inputHtml?.trim()
    if (!inputHtml) return '' // to save performance and not create iframe

    // firefox "bogus node" workaround
    if (input === '<br>') return ''

    const iframe = document.createElement('iframe', {})
    if (iframe.sandbox === undefined) {
        console.warn('Your browser does not support sandboxed iframes. Please upgrade to a modern browser.')
        return input || ''
    }
    iframe.sandbox.add('allow-same-origin')
    iframe.style.display = 'none'
    document.body.appendChild(iframe) // necessary so the iframe contains a document
    const iframedoc: Pick<Document, 'body' | 'createElement' | 'write'> =
        iframe.contentDocument || iframe.contentWindow?.document || ({} as Pick<Document, 'body' | 'createElement' | 'write'>)
    if (iframedoc.body == null) iframedoc.write('<body></body>') // null in IE
    iframedoc.body.innerHTML = input

    const makeSanitizedCopy = (node: HTMLElement): HTMLElement | undefined => {
        let newNode: HTMLElement | undefined
        if (node.nodeType === Node.TEXT_NODE) {
            newNode = node.cloneNode(true) as HTMLElement
        } else if (
            node.nodeType === Node.ELEMENT_NODE &&
            (tagWhitelist[node.tagName] || contentTagWhiteList[node.tagName])
        ) {
            if (contentTagWhiteList[node.tagName]) newNode = iframedoc.createElement('DIV')
            // convert to DIV
            else newNode = iframedoc.createElement(node.tagName)

            copyAttributes(node, newNode)

            for (let i = 0; i < node.childNodes.length; i += 1) {
                const subCopy = makeSanitizedCopy(node.childNodes[i] as HTMLElement)
                if (newNode && subCopy) {
                    newNode.appendChild(subCopy)
                }
            }
        } else {
            newNode = document.createDocumentFragment() as unknown as HTMLElement
        }
        return newNode
    }

    const resultElement = makeSanitizedCopy(iframedoc.body)
    document.body.removeChild(iframe)
    return resultElement?.innerHTML.replace(/<br[^>]*>(\S)/g, '<br>\n$1').replace(/div><div/g, 'div>\n<div') || '' // replace is just for cleaner code
}
