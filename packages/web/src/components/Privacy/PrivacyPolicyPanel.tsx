import React from 'react'
import { createUseStyles } from 'react-jss'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import OpenGraphMeta from '../common/OpenGraphMeta/OpenGraphMeta'
import { darkTheme } from '../../theme/darkTheme'

/**
 * Zásady ochrany osobních údajů.
 *
 * Tenhle text není šablona: každý údaj, každý příjemce a každá doba uchování v něm
 * odpovídá tomu, co aplikace opravdu dělá (sloupce `csld_csld_user`, cookies
 * `csld.sid`/`LoggedIn`, tokeny v `csld_email_authentication`, Google Analytics
 * s Consent Mode, reCAPTCHA, Gmail SMTP, Google přihlášení, nginx logy 14 dní,
 * denní zálohy do soukromého GitHub repozitáře). Když se tohle chování změní,
 * mění se i tenhle soubor ve stejném commitu — prosím, ne obecné fráze.
 *
 * Proč je próza přímo v JSX a ne v `common.json`: shim `src/lib/i18n` umí jen
 * jednotlivé stringy, ne strukturu; právní dokument z dvou set klíčů by se nedal
 * čitelně udržovat.
 */

const CONTACT_EMAIL = 'larpovadatabaze@gmail.com'
const UPDATED = '20. 10. 2026'

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundWhite,
        padding: '20px 0 40px',
        minHeight: '60vh',
    },
    title: {
        margin: '0 0 4px',
        fontSize: '1.6rem',
        color: darkTheme.textOnLightDark,
    },
    subtitle: {
        fontSize: '0.9rem',
        color: darkTheme.textOnLightLighter,
        maxWidth: 680,
        margin: '0 0 4px',
    },
    updated: {
        fontSize: '0.78rem',
        color: darkTheme.textOnLightLighter,
        margin: '0 0 26px',
    },
    section: {
        maxWidth: 820,
        marginBottom: 26,
        color: darkTheme.textOnLightDark,
        fontSize: '0.92rem',
        lineHeight: '165%',
    },
    h2: {
        fontSize: '1.1rem',
        margin: '0 0 8px',
        color: darkTheme.textOnLightDark,
    },
    p: {
        margin: '0 0 8px',
    },
    list: {
        margin: '0 0 8px',
        paddingLeft: 22,
        '& li': {
            marginBottom: 6,
        },
    },
    table: {
        borderCollapse: 'collapse',
        width: '100%',
        margin: '6px 0 10px',
        fontSize: '0.86rem',
        '& th, & td': {
            border: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
            padding: '6px 8px',
            textAlign: 'left',
            verticalAlign: 'top',
        },
        '& th': {
            backgroundColor: darkTheme.backgroundAlmostNearWhite2,
            fontWeight: 'bold',
        },
    },
    note: {
        maxWidth: 820,
        margin: '0 0 26px',
        padding: '10px 14px',
        borderLeft: `3px solid ${darkTheme.textGreenDark}`,
        backgroundColor: darkTheme.backgroundAlmostNearWhite2,
        fontSize: '0.9rem',
        lineHeight: '160%',
        color: darkTheme.textOnLightDark,
    },
    link: {
        color: darkTheme.textGreenDark,
    },
})

export const PrivacyPolicyPanel = () => {
    const classes = useStyles()

    return (
        <>
            <OpenGraphMeta
                title="Ochrana osobních údajů | Larpová databáze"
                description="Jaké údaje o vás Larpová databáze zpracovává, komu se dostanou, jak dlouho je uchováváme a jak je nechat smazat."
                image="/images/lk-logo.png"
            />
            <div className={classes.row} data-testid="privacy.panel">
            <WidthFixer>
                <h1 className={classes.title}>Ochrana osobních údajů</h1>
                <div className={classes.subtitle}>
                    Jaké údaje o vás Larpová databáze zpracovává, komu se dostanou a co s tím můžete dělat.
                </div>
                <div className={classes.updated}>Naposledy upraveno {UPDATED}.</div>

                <div className={classes.section}>
                    <h2 className={classes.h2}>1. Kdo vaše údaje zpracovává</h2>
                    <p className={classes.p}>
                        Larpovou databázi (larpovadatabaze.cz) provozuje její tým, tedy sdružení dobrovolníků, kteří
                        databázi vyvíjejí a spravují. Ve smyslu nařízení GDPR jsme správcem vašich údajů my.
                    </p>
                    <p className={classes.p}>
                        Ve všech věcech kolem osobních údajů nám napište na{' '}
                        <a className={classes.link} href={`mailto:${CONTACT_EMAIL}`}>
                            {CONTACT_EMAIL}
                        </a>
                        .
                    </p>
                </div>

                <div className={classes.section}>
                    <h2 className={classes.h2}>2. Jaké údaje zpracováváme</h2>
                    <ul className={classes.list}>
                        <li>
                            <strong>Účet:</strong> e-mail (povinný — slouží k přihlášení a k obnově hesla), jméno,
                            přezdívka, popis profilu, pohlaví (používáme ho jen kvůli českému skloňování textů),
                            jazyk, město a datum narození (nepovinné), profilová fotka a odvozené počty (kolik her
                            jste ohodnotili, sehráli a přidali).
                        </li>
                        <li>
                            <strong>Heslo</strong> ukládáme pouze jako otisk (PBKDF2 se solí). Nikdy ho nevidíme v
                            čitelné podobě a nikomu ho neposíláme.
                        </li>
                        <li>
                            <strong>Obsah, který vytvoříte:</strong> hodnocení her, komentáře a hlasy u komentářů,
                            hry a události, které přidáte, fotky, videa a články.
                        </li>
                        <li>
                            <strong>Přihlašování:</strong> relace v cookie <code>csld.sid</code>, cookie pro
                            zapamatování přihlášení <code>LoggedIn</code>, jednorázové přihlašovací odkazy (platí
                            15 minut) a tokeny pro obnovu hesla (platí 1 hodinu). Pokud se přihlásíte přes Google,
                            uložíme si identifikátor vašeho Google účtu, e-mail a jméno z něj.
                        </li>
                        <li>
                            <strong>Provozní údaje:</strong> přístupové logy webového serveru — IP adresa, čas,
                            požadovaná adresa a typ prohlížeče — a to po dobu 14 dní.
                        </li>
                        <li>
                            <strong>Historie dárců:</strong> dřív jste mohli databázi přispět; v seznamu dárců je
                            proto veřejně jméno či označení dárce, částka a poznámka. Dnes se nevybírá nic a nové
                            záznamy nepřibývají.
                        </li>
                    </ul>
                </div>

                <div className={classes.section}>
                    <h2 className={classes.h2}>3. Co je veřejné a co ne</h2>
                    <p className={classes.p}>
                        Larpová databáze je veřejný katalog, takže to podstatné je vidět bez přihlášení: vaše jméno,
                        přezdívka, popis profilu, fotka, město, věk (ten počítáme z data narození, datum samotné
                        nezobrazujeme), vaše hodnocení a komentáře, přidané hry a události, fotky a články. Jméno,
                        přezdívku a město také používají ostatní pro hledání lidí.
                    </p>
                    <p className={classes.p}>
                        Neveřejné zůstávají: e-mail (ten vidíte jen vy a správci), otisk hesla, datum narození, IP
                        adresy, logy a přihlašovací tokeny.
                    </p>
                </div>

                <div className={classes.section}>
                    <h2 className={classes.h2}>4. Proč údaje zpracováváme</h2>
                    <ul className={classes.list}>
                        <li>
                            <strong>Účet a obsah, který vložíte</strong> — abychom vám mohli službu poskytovat, tedy
                            plnění smlouvy (čl. 6 odst. 1 písm. b GDPR).
                        </li>
                        <li>
                            <strong>Bezpečnost, ochrana proti spamu a provozní logy</strong> — náš oprávněný zájem
                            na tom, aby databáze fungovala a nebyla zaplavena roboty (čl. 6 odst. 1 písm. f).
                        </li>
                        <li>
                            <strong>Měření návštěvnosti</strong> — jen s vaším souhlasem (čl. 6 odst. 1 písm. a),
                            který udělujete v liště dole. Do té doby běží měření bez cookies a bez identifikace.
                        </li>
                    </ul>
                    <p className={classes.p}>
                        Vaše údaje neprodáváme a nepoužíváme je k reklamě. Nenajdete tu žádné reklamní sítě ani
                        profilování, které by o vás rozhodovalo automaticky.
                    </p>
                </div>

                <div className={classes.section}>
                    <h2 className={classes.h2}>5. Komu se údaje dostanou</h2>
                    <p className={classes.p}>
                        Údaje nepředáváme nikomu k marketingu. Používáme ale služby, které při provozu databáze
                        údaje zpracovávají:
                    </p>
                    <ul className={classes.list}>
                        <li>
                            <strong>Google (Google Ireland Ltd.)</strong> — doručování e-mailů přes Gmail (přihlašovací
                            odkazy a obnova hesla), ověření, že registraci nedělá robot (reCAPTCHA), měření
                            návštěvnosti (Google Analytics) a přihlášení přes Google, pokud si ho zvolíte. Při
                            předání mimo EU se opíráme o standardní smluvní doložky a rozhodnutí o odpovídající
                            ochraně (EU-US Data Privacy Framework).
                        </li>
                        <li>
                            <strong>Poskytovatel serveru</strong>, na kterém databáze běží, včetně úložiště
                            nahraných souborů.
                        </li>
                        <li>
                            <strong>GitHub</strong> — do soukromého repozitáře ukládáme denní zálohy databáze a
                            nahraných souborů.
                        </li>
                    </ul>
                    <p className={classes.p}>
                        Údaje můžeme vydat jen tehdy, když nám to uloží zákon (například na vyžádání orgánů činných v
                        trestním řízení).
                    </p>
                </div>

                <div className={classes.section}>
                    <h2 className={classes.h2}>6. Cookies a úložiště v prohlížeči</h2>
                    <table className={classes.table}>
                        <thead>
                            <tr>
                                <th>Název</th>
                                <th>K čemu</th>
                                <th>Jak dlouho</th>
                                <th>Potřebuje souhlas</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <code>csld.sid</code>
                                </td>
                                <td>Drží vaše přihlášení mezi stránkami.</td>
                                <td>30 dní, nebo do odhlášení</td>
                                <td>ne — bez něj se nedá přihlásit</td>
                            </tr>
                            <tr>
                                <td>
                                    <code>LoggedIn</code>
                                </td>
                                <td>Zapamatuje si vás, když zaškrtnete „zůstat přihlášený“.</td>
                                <td>30 dní</td>
                                <td>ne — jen když si to zvolíte</td>
                            </tr>
                            <tr>
                                <td>
                                    <code>_ga</code>, <code>_ga_*</code>
                                </td>
                                <td>Google Analytics — počítání návštěv.</td>
                                <td>až 2 roky</td>
                                <td>ano</td>
                            </tr>
                            <tr>
                                <td>
                                    <code>csld-ga-consent</code> (v prohlížeči, ne cookie)
                                </td>
                                <td>Vaše rozhodnutí o měření, abychom se neptali pořád.</td>
                                <td>do vymazání úložiště</td>
                                <td>—</td>
                            </tr>
                        </tbody>
                    </table>
                    <p className={classes.p}>
                        Rozhodnutí o měření můžete změnit kdykoli tím, že v prohlížeči vymažete úložiště pro tuto
                        stránku; lišta se zeptá znovu. Cookies pro přihlášení smažete odhlášením nebo v nastavení
                        prohlížeče — pak ale zůstanete odhlášení.
                    </p>
                </div>

                <div className={classes.section}>
                    <h2 className={classes.h2}>7. Jak dlouho údaje uchováváme</h2>
                    <ul className={classes.list}>
                        <li>Účet a obsah, který jste vytvořili — dokud je nesmažete (viz bod 8).</li>
                        <li>Přihlašovací odkaz platí 15 minut, token pro obnovu hesla 1 hodinu; po použití je mažeme.</li>
                        <li>Relace a „zůstaň přihlášený“ — 30 dní.</li>
                        <li>Přístupové logy serveru — 14 dní.</li>
                        <li>Měření návštěvnosti — podle nastavení Google Analytics, nejdéle 14 měsíců.</li>
                    </ul>
                    <p className={classes.p}>
                        Denně také vytváříme záložní kopii databáze a nahraných souborů do soukromého úložiště na
                        GitHubu. Historie záloh se automaticky nezkracuje, takže smazaná data v nich mohou zůstat.
                        Když chcete výmaz i ze záloh, napište nám — uděláme ho ručně.
                    </p>
                </div>

                <div className={classes.section}>
                    <h2 className={classes.h2}>8. Vaše práva</h2>
                    <ul className={classes.list}>
                        <li>
                            <strong>Vědět, co o vás máme</strong> (přístup k údajům) a dostat jejich kopii
                            (přenositelnost).
                        </li>
                        <li>
                            <strong>Opravit je</strong> — jméno, přezdívku, popis, město i datum narození si
                            upravíte sami v nastavení profilu.
                        </li>
                        <li>
                            <strong>Nechat je smazat</strong> — napište nám z adresy, kterou máte u účtu. Účet
                            smažeme i s tím, co k němu patří: hodnocení, komentáře, hlasy a autorství her.
                        </li>
                        <li>
                            <strong>Omezit zpracování nebo vznést námitku</strong> proti tomu, co děláme z
                            oprávněného zájmu.
                        </li>
                        <li>
                            <strong>Vzít souhlas zpět</strong> — u měření návštěvnosti kdykoli, bez vysvětlování.
                        </li>
                    </ul>
                    <p className={classes.p}>
                        Odpovídáme do jednoho měsíce a nic za to neplatíte. Pokud si myslíte, že jsme něco
                        nezvládli, můžete se obrátit na Úřad pro ochranu osobních údajů (Pplk. Sochora 27, 170 00
                        Praha 7,{' '}
                        <a className={classes.link} href="https://www.uoou.cz" target="_blank" rel="noreferrer">
                            uoou.cz
                        </a>
                        ).
                    </p>
                </div>

                <div className={classes.section}>
                    <h2 className={classes.h2}>9. Děti</h2>
                    <p className={classes.p}>
                        Databáze není určená dětem mladším 15 let. Pokud je vám méně než 15, používejte ji
                        prosím se souhlasem zákonného zástupce.
                    </p>
                </div>

                <div className={classes.section}>
                    <h2 className={classes.h2}>10. Jak údaje chráníme</h2>
                    <p className={classes.p}>
                        Celý web běží po HTTPS. Hesla ukládáme jen jako otisk se solí. Přístup k databázi mají jen
                        správci, server je zabezpečený a zálohy leží v soukromém repozitáři. Nahrané fotky
                        zmenšujeme, takže se do úložiště dostane jen samotný obrázek bez metadat, která do něj
                        foťák či mobil zapisují (například poloha).
                    </p>
                </div>

                <div className={classes.section}>
                    <h2 className={classes.h2}>11. Změny tohoto dokumentu</h2>
                    <p className={classes.p}>
                        Když se změní to, co děláme s údaji, upravíme i tuhle stránku a datum nahoře. Podstatné
                        změny oznámíme na hlavní stránce. Historie úprav je veřejně dohledatelná ve vývoji
                        aplikace.
                    </p>
                </div>

                <div className={classes.note}>
                    Něco je tu nejasné nebo chcete údaje smazat? Napište na{' '}
                    <a className={classes.link} href={`mailto:${CONTACT_EMAIL}`}>
                        {CONTACT_EMAIL}
                    </a>{' '}
                    — odpovídáme do měsíce.
                </div>
            </WidthFixer>
            </div>
        </>
    )
}

export default PrivacyPolicyPanel
