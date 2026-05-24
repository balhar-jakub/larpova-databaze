const entities = {
    amp: '&',
    lt: '<',
    gt: '>',
    nbsp: ' ',
    Aacute: 'Á',
    Eacute: 'É',
    Iacute: 'Í',
    Oacute: 'Ó',
    Uacute: 'Ú',
    Uring: 'Ů',
    Yacute: 'Ý',
    aacute: 'á',
    eacute: 'é',
    iacute: 'í',
    oacute: 'ó',
    uacute: 'ú',
    uring: 'ů',
    yacute: 'ý',
}

export const htmlToText = (html: string | null | undefined) => {
    if (!html) {
        return ''
    }
    return html
        .replace(/(<([^>]+)>)/gi, '')
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        .replace(/&([^;]+);/g, (match, code: string) => {
            // @ts-ignore
            const entity = entities[code]
            if (entity) {
                return entity
            }
            return code[0]
        })
        .replace(/\n/g, ' ')
}
