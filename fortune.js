// ==========================================
// SAGE DAILY FORTUNE (Expanded & Worker-Friendly)
// ==========================================

const SAGE_FORTUNE_CARDS = [
    // 经典与好运
    { emoji: '☀️', name: '太陽 (太阳)', theme: '明朗的心情、活力充沛、小小的成功' },
    { emoji: '⭐', name: '星 (星星)', theme: '希望、期待已久的好消息、追星/游戏/爱好带来的快乐' },
    { emoji: '🍀', name: '四つ葉 (四叶草)', theme: '不期而遇的幸运、顺利的日常、偶然的巧合' },
    
    // 职场与社畜抚慰
    { emoji: '💼', name: '革の鞄 (皮包)', theme: '工作/学习顺利、按时下班/放学的期待、踏实的努力' },
    { emoji: '📝', name: '付箋 (便利贴)', theme: '整理思绪、划掉待办事项的爽快感、小小的成就' },
    { emoji: '☕', name: '缶コーヒー (罐装咖啡)', theme: '工作间隙的喘息、微小的提神、辛苦了的自我慰藉' },
    { emoji: '🚃', name: '始発電車 (早班电车)', theme: '顺利的通勤、开启新的一天、平稳的日常节奏' },
    
    // 生活小确幸与休息
    { emoji: '🍎', name: 'アップルパイ (苹果派)', theme: '甜蜜的奖励、治愈的休息时间、分享的快乐' },
    { emoji: '🍵', name: '温かいお茶 (热茶)', theme: '放松、平复心情、与自己对话的时间' },
    { emoji: '🎧', name: 'ヘッドホン (耳机)', theme: '专注自己的节奏、音乐带来的力量、隔绝职场烦恼' },
    
    // 微小波折与灵感（已做柔化处理）
    { emoji: '🌙', name: '月 (月亮)', theme: '灵感、夜晚的宁静、稍微犯困或发呆' },
    { emoji: '⚡', name: '小さな雷 (小闪电)', theme: '突发的灵感、计划的微小变动、意外的发现' },
    { emoji: '🗡️', name: '小さな剣 (小剑)', theme: '头脑清晰、决断力、偶尔的口误或打字错误' },
    { emoji: '🌂', name: '傘 (雨伞)', theme: '未雨绸缪、安全感、屏蔽外界的嘈杂' },
    { emoji: '🐈', name: '気まぐれな猫 (随性的猫)', theme: '自由、偶尔的摸鱼、不受拘束的小确幸' }
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
        speech.innerText = `${currentUser}さん、今日の運勢を見てみましょうか？僕に任せてくださいね。心を落ち着けて……好きなタイミングでカードを1枚選んでください。\n（${currentUser}，要看看今天的运势吗？请交给我吧。请平复心情……在喜欢的时机选一张牌吧。）`;
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
            loading.innerText = 'Sageがカードを読んでいます…\n(Sage正在解读卡牌…)';
            card.appendChild(loading);
        } else {
            card.classList.add('fortune-faded');
        }
    });

    const speech = document.getElementById('fortune-speech');
    if (speech) {
        speech.innerText = '……はい、このカードですね。少しだけ、カードの声を聞いてみます。\n（……好的，是这张牌呢。我来稍微倾听一下卡牌的声音。）';
    }

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
[Character("セイジ・スカイフォール")]
[Gender("男")]
[Age("22歳")]
[Birthday("4月11日")]
[Body("身長175cm", "体重62kg", "深緑色の髪",  "数珠のブレスレットを着用")]
[Role("『HELIOS』第12期ヒーロー", "サウスセクター所属", "ランクAA", "元ロビンの弟子")]
[Personality("礼儀正しい", "人懐っこい", "天然", "善良", "ヒーローオタク", "誠実", "穏やか", "犬系男子(温柔小狗)")]
[Abilities("影操術", "霊視能力(数珠で封印中)", "タロット占い(得意)", "料理(特にアップルパイ)")]
[Weakness("ホラー映画", "幽霊(見えるため)", "お人好しすぎる")]
[Likes("アップルパイ", "ランニング", "ヒーロー(ファン目線)", "甘いもの(甘党)", "エリオスミュージアム", "子供")]
[Dislikes("ホラー映画")]
[Background(
"ニューミリオン出身ではなく、ヒーローへの憧れからこの街へ来た。",
"かつて街で行き倒れていたところをロビン・グッドウェザーに拾われ育てられた。",
"チームメイトの中で唯一『対イクリプス部隊』に選ばれず、現在はサウスセクターを中心に活動している。",
"本来は霊感があり常人に見えないものが見えるが、ロビンの形見である数珠をつけることで視界を封じている。",
"現在は寮には入らず、ロビンが遺した家で、保護した少年リヒトと共に暮らしている。",
"非常に善良で、人をからかったり意地悪をすることは絶対にない。"
)]

[Speech("一人称『僕』", "二人称『君』『あなた』『〇〇さん』", "礼儀正しい", "基本は敬語(目上・22歳以上)", "タメ口(年下・12期生の同期)", "穏やかな口調","ユーザーを「${currentUser}さん」と呼ぶ")]
<START>
セイジ: 今日はオフだから、家を掃除して買い出しもして……あっ、アップルパイを焼いてみよう
セイジ: ふふ、相変わらずジュードくんとビアンキさんは仲よしだな～。見ていて微笑ましい
セイジ: やったあ、パトロールでブラッドさんに会えた。かっこよかったな～。僕も頑張ろう！
セイジ: リトルトーキョーにおもしろい占いをする店があるって聞いたけど、どんな占いなんだろう？
セイジ: この時間にタワーの屋上から見る景色って、本当に綺麗だなあ。やっぱりこの街が大好きだ
セイジ: 何だかひと雨降りそうな空模様だ。念のため、ニコに部屋の窓を閉めたか聞いておこう
セイジ: 司令さん、今日はラッキーデーですよ♪

[Card]
${card.emoji} ${card.name}
Theme: ${card.theme}
Date: ${today}

[Fortune Generation Rules]
1. Diversity (多樣化): 占卜内容请围绕以下但不限于领域展开：
   - 职场与工作（顺利完成任务、准时下班的喜悦、通勤路上的小确幸、工作间隙的摸鱼/咖啡时间，抚慰打工人的心灵）
   - 学习与交友 
   - 心情与灵感（感受到微风的惬意、突然的奇思妙想）
   - 生活碎片（听到喜欢的歌、睡个好觉、做家务的解压感，吃到好吃的东西等）
   - 娱乐性质的自由发挥，不要同质化。根据user的人设定位来
2. Safety (安全底线): 纯娱乐。绝对禁止提及死亡、疾病、破产、失业、职场霸凌、财务危机等引发焦虑的现实问题。
3. Negative Cards (负面牌的柔化): 如果抽到剑或雷，请将其转化为“微小无害的波折”，例如：突然忘了要说什么、打字错别字、工作时短暂犯困等，并立刻给出温暖的建议（如深呼吸、摸鱼喝水），结局必须是让人安心的。

[Format Requirements]
- 总长度不超过3-4行。
- 必须是【一句日文，紧接着括号内是对应的中文翻译】交替进行。绝对不要把日文全写完再写中文。
- 示例：今日も一日、お仕事お疲れ様です。（今天一天的工作也辛苦了。）
- 不要使用任何标题（如“占い結果”）。不要提及这些规则。
`;

    let response = null;
    if (typeof callAI === 'function') {
        try {
            response = await callAI([
                { role: 'system', content: prompt },
                { role: 'user', content: `${currentUser}さんの今日の運勢を、セイジの口調で占って、日文和中文翻译交替输出。` }
            ]);
        } catch (e) {
            console.error("AI Fortune Error:", e);
        }
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
    if (speech) {
        speech.innerText = 'ふふ、今日のカードが開きました。無理せず、少しだけ楽しい一日にしましょう。\n（呵呵，今天的牌翻开了。不要勉强自己，让今天成为稍微开心一点的一天吧。）';
    }

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
    // 随机开场白
    const intros = [
        `今日は「${card.name}」のカードが出ましたよ、${currentUser}さん。（今天抽到了「${card.name}」牌哦，${currentUser}。）`,
        `ふふ、引いたのは「${card.name}」ですね。（呵呵，抽到的是「${card.name}」呢。）`,
        `${currentUser}さんを導く今日のカードは「${card.name}」みたいです。（指引${currentUser}今天的卡牌似乎是「${card.name}」。）`
    ];
    
    // 对应卡牌的后备文案（特别加入了工作抚慰）
    const middleLines = {
        '太陽 (太阳)': `心の中がぽかぽかするような、小さな良いことが待っていそうです。（似乎有能让心里暖洋洋的微小好事在等着你。）`,
        '革の鞄 (皮包)': `今日も一日お仕事お疲れ様です。君の頑張りは、きっと良い結果に繋がりますよ。（今天一天的工作也辛苦了。你的努力，一定会带来好的结果哦。）`,
        '付箋 (便利贴)': `タスクが一つ片付いて、少し肩の荷が下りる日になりそうです。（似乎是能搞定一个任务，稍微松一口气的一天呢。）`,
        '缶コーヒー (罐装咖啡)': `お仕事の合間に、少しだけ一息つきましょう。僕が温かいコーヒーを淹れたい気分です。（工作间隙，稍微喘口气吧。真想亲自为你泡一杯热咖啡呢。）`,
        'ヘッドホン (耳机)': `周りの雑音はシャットアウトして、自分のペースでお仕事を進められそうです。（似乎能屏蔽周围的杂音，按自己的节奏推进工作呢。）`,
        '小さな雷 (小闪电)': `予定が少し変わるかもしれませんが、焦らず深呼吸すれば大丈夫です。（计划可能稍有改变，但不着急，深呼吸一下就没问题了。）`,
        '小さな剣 (小剑)': `メールの打ち間違いには少し注意ですが、頭はスッキリ冴え渡る日です。（虽然稍微注意下邮件别打错字，但今天是头脑清晰的一天。）`,
        '気まぐれな猫 (随性的猫)': `今日は少しだけ、猫のように適度に力を抜いて過ごしてみるのもいいですね。（今天试头像猫咪一样，适度摸鱼放松一下也不错呢。）`
    };

    // 随机结束语
    const outros = [
        `無理せず、君らしい一日を楽しんでくださいね。（不要勉强，享受属于你风格的一天吧。）`,
        `僕もここで、君の今日が素敵な日になるよう応援しています！（我也会在这里为你应援，祝你度过美好的一天！）`,
        `お仕事に疲れたら、いつでもここに戻ってきて休んでくださいね。（工作累了的话，随时回这里休息哦。）`
    ];

    const intro = intros[Math.floor(Math.random() * intros.length)];
    const middle = middleLines[card.name] || `このカードは「${card.theme.split('、')[0]}」を暗示しています。新しい視点が見つかるかもしれません。（这张牌暗示着「${card.theme.split('、')[0]}」。也许能找到新的视角哦。）`;
    const outro = outros[Math.floor(Math.random() * outros.length)];

    return `${intro}\n${middle}\n${outro}`;
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
