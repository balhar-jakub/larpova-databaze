import React from 'react'
import GameCommentPanel from '../GameCommentPanel'

export default { title: 'GameCommentPanel' }

const comment = {
    id: '123',
    comment: `
<p>Tuhle akci je strašně těžký hodnotit. Jakože jasně že dostane plnej počet, ale je hrozně těžký o ní cokoli psát. Nerad bych upadnul do nějakých klišé, ale zejména orgové vytvářející příběh si je jistě rádi přečtou, takže proč vlastně ne.<br><br>Být stalkerem je prostě víc životní postoj, než role na jakémkoli LARPu. Na téhle akci zapomenete na všechno, co jste tam venku nechali - na práci, školu, na ženu. Na to dobré i špatné. Je jen teď a tady. Spíte když to jde, jíte když to jde a chodíte na záchod když to jde (a když není hic). Cokoli v Zóně je naléhavější než jakékoli jiné potřeby, Zóna si vás vezme a po týdnu vás vyplivne sežvýkaného a lehce ozářeného, ale s přiblblým úsměvem na obličeji.</p>
<p>Zóna je totiž mnohem zajímavější, propracovanější a opravdovější než svět tam venku. Většina příběhů z ní je pohnutějších než historky bezďáků v Sherwoodu a když odsud odjedete, hodně dlouho trvá, než se aspoň jakž-takž srovnáte do normálního života, což se ale vlastně asi nikdy úplně nestane, protože většina z nás má kousek srdce zakopaný v krabičce někde mezi Barem a Oázou.<br><br>Zcela upřímně nevím, co bych dělal a kým bych byl, kdyby tahle akce nebyla.&nbsp;</p>
`,
    added: '2019-08-12',
    amountOfUpvotes: 93,
    isHidden: false,
    user: {
        id: '12',
        name: 'Jenda Zahradník',
        nickname: 'Zahry',
    },
}

export const Panel = () => (
    <div style={{ background: '#efefef', padding: 20, width: 800 }}>
        <GameCommentPanel comment={comment} showVisibilityButton onChangeCommentVisibility={() => {}} />
    </div>
)
