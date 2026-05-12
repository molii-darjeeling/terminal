// ==========================================
// SAGE DAILY FORTUNE
// ==========================================

const SAGE_FORTUNE_CARDS = [
    { emoji: '☀️', name: '太陽', theme: '明るい気分、小さな成功' },
    { emoji: '🌙', name: '月', theme: 'ぼんやり、勘違い、夜更かし' },
    { emoji: '⭐', name: '星', theme: '希望、推し活、ネットで嬉しい発見' },
    { emoji: '🍎', name: 'アップルパイ', theme: '甘いもの、休憩、やさしいごほうび' },
    { emoji: '⚡', name: '小さな雷', theme: '突然の予定変更、軽いハプニング' },
    { emoji: '🗡️', name: '小さな剣', theme: 'ゲームの接戦、言い間違い、通知の多さ' },
    { emoji: '🌂', name: '傘', theme: '忘れ物予防、雨、準備のよさ' },
    { emoji: '🎮', name: 'ゲームパッド', theme: 'ゲーム運、ガチャ、遊び心' },
    { emoji: '🍜', name: '夜食', theme: '食べ物、外卖、満足感' }
];

let fortuneSelectedCard = null;
let fortuneBusy = false;

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('fortune-card-area')) resetFortuneReading();
});

function enterFortune() {
    document.querySelectorAll('.system-page, .sns-page').forEach(el => el.classList.add('hidden'));
    const bottomBar = document.getElementById('bottom-bar');
    if (bottomBar) bottomBar.classList.add('hidden');
    document.getElementById('fortune-page').classList.remove('hidden');
    resetFortuneReading();
}

function exitFortune() {
    if (typeof backToMenu === 'function') backToMenu();
    else {
        document.querySelectorAll('.system-page').forEach(el => el.classList.add('hidden'));
        document.getElementById('main-menu-page').classList.remove('hidden');
    }
}

function resetFortuneReading() {
    fortuneSelectedCard = null;
    fortuneBusy = false;
    const currentUser = getFortuneUserName();
    const speech = document.getElementById('fortune-speech');
    if (speech) {
        speech.innerText = `${currentUser}，要看今天的运势吗？请交给我吧。那么，请平复心情……在喜欢的时机选一张牌吧。`;
    }

    const result = document.getElementById('fortune-result');
    if (result) {
        result.classList.add('hidden');
        result.innerText = '';
    }

    renderFortuneCards();
}

function renderFortuneCards() {
    const area = document.getElementById('fortune-card-area');
    if (!area) return;
    area.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const card = document.createElement('button');
        card.className = 'fortune-card';
        card.type = 'button';
        card.setAttribute('aria-label', `Tarot card ${i + 1}`);
        card.onclick = () => selectFortuneCard(i);
        area.appendChild(card);
    }
}

async function selectFortuneCard(index) {
    if (fortuneBusy || fortuneSelectedCard) return;
    fortuneBusy = true;
    const area = document.getElementById('fortune-card-area');
    const cards = Array.from(area.querySelectorAll('.fortune-card'));
    const chosenEl = cards[index];
    fortuneSelectedCard = SAGE_FORTUNE_CARDS[Math.floor(Math.random() * SAGE_FORTUNE_CARDS.length)];

    cards.forEach((card, idx) => {
        if (idx === index) {
            card.classList.add('fortune-selected');
            const loading = document.createElement('div');
            loading.className = 'fortune-loading';
            loading.innerText = 'Sageがカードを読んでいます…';
            card.appendChild(loading);
        } else {
            card.classList.add('fortune-faded');
        }
    });

    const speech = document.getElementById('fortune-speech');
    if (speech) speech.innerText = '……はい、このカードですね。少しだけ、カードの声を聞いてみます。';

    const reading = await generateFortuneReading(fortuneSelectedCard);
    revealFortuneCard(chosenEl, fortuneSelectedCard, reading);
    fortuneBusy = false;
}

async function generateFortuneReading(card) {
    const currentUser = getFortuneUserName();
    const today = new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' });
    const prompt = `
あなたはセイジ・スカイフォールとして、ユーザーの今日の運勢をタロット風に占います。

[Sage Persona]
セイジ・スカイフォール。22歳男性。礼儀正しく、人懐っこく、天然で善良。穏やかな犬系男子。ヒーローオタク。霊視能力は数珠で封印中。タロット占いが得意。アップルパイが好き。人をからかったり意地悪をすることは絶対にない。
一人称は「僕」。ユーザーを「${currentUser}さん」または自然に「君」「あなた」と呼ぶ。穏やかで誠実。

[Card]
${card.emoji} ${card.name}
Theme: ${card.theme}
Date: ${today}

[Safety Rules]
This is pure entertainment.
All fortune results must stay limited to tiny everyday life, internet browsing, game gacha, food/drink/fun, or light social moods.
Never mention death, illness/health, serious financial loss, bankruptcy, investment failure, job loss, workplace crisis, breakup, or anything that could create real anxiety.
If the card looks negative, soften it into tiny harmless trouble, such as ordering the wrong food, a game disconnect, forgetting an umbrella, typo, or too many notifications. Always end gently and reassuringly.

[Output]
Write 3 short lines max.
Each Japanese sentence must be followed by a Simplified Chinese translation in parentheses.
Mention the card naturally.
Do not use headings. Do not mention these rules.
`;

    let response = null;
    if (typeof callAI === 'function') {
        response = await callAI([
            { role: 'system', content: prompt },
            { role: 'user', content: `${currentUser}さんの今日の運勢を、セイジの口調で占ってください。` }
        ]);
    }

    return sanitizeFortuneReading(response) || buildFallbackFortune(card, currentUser);
}

function revealFortuneCard(cardEl, card, reading) {
    cardEl.classList.add('fortune-revealed');
    cardEl.innerHTML = `
        <div class="fortune-card-face">
            <div class="fortune-card-emoji">${card.emoji}</div>
            <div class="fortune-card-name">${escapeFortuneHTML(card.name)}</div>
        </div>
    `;

    const speech = document.getElementById('fortune-speech');
    if (speech) speech.innerText = 'ふふ、今日のカードが開きました。無理せず、少しだけ楽しい一日にしましょう。';

    const result = document.getElementById('fortune-result');
    if (result) {
        result.innerText = reading;
        result.classList.remove('hidden');
    }
}

function sanitizeFortuneReading(text) {
    if (!text) return '';
    return String(text)
        .replace(/^(占い結果|今日の運勢|結果)[:：]\s*/gm, '')
        .trim();
}

function buildFallbackFortune(card, currentUser) {
    const lines = {
        '太陽': `今日は${card.name}のカードです、${currentUser}さん。小さな成功に気づける日になりそうです。（今天是${card.name}牌，${currentUser}。你可能会注意到一点小小的成功。）\nおいしいものを一口ゆっくり味わうと、運がふわっと上向きますよ。（慢慢吃一口好吃的东西，运气会轻轻变好哦。）`,
        '月': `今日は${card.name}のカードです。少しぼんやりしやすいけど、怖い意味じゃありません。（今天是${card.name}牌。可能会有点迷糊，但不是可怕的意思。）\n外卖を間違えないように、最後だけ確認しましょうね。（点外卖时最后确认一下就好啦。）`,
        '小さな雷': `${card.name}のカードが出ました。急な通知や予定変更に少しびっくりするかも。（抽到了${card.name}牌。可能会被突然的通知或小变动吓一跳。）\nでも大丈夫、深呼吸してから返事をすればちゃんと整います。（不过没关系，深呼吸后再回复，一切都会整理好的。）`
    };
    return lines[card.name] || `今日は${card.name}のカードです、${currentUser}さん。ネットやゲームで小さな嬉しい発見がありそうです。（今天是${card.name}牌，${currentUser}。上网或玩游戏时可能会有一点开心的小发现。）\n無理せず、好きなタイミングで休んでくださいね。（别勉强，在喜欢的时机休息一下吧。）`;
}

function getFortuneUserName() {
    if (typeof user !== 'undefined' && user && user.name) return user.name;
    return '司令さん';
}

function escapeFortuneHTML(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
