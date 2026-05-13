// ==========================================
// CHAT SYSTEM CONTROLLER
// ==========================================

// --- Constants ---
const DM_VIBE_PROMPT = `
【核心指令】：你正在与用户进行 1对1 的私密聊天。
**【输出格式强制要求】**
为了模拟真实聊天体验，请不要一次性输出一大段话。请根据说话的节奏，自然地将回复拆分成几条简短的消息。
数量不限，根据情况可以只回一句话，不能一直回很多句，也不能一直回一样的条数，每次回复的条数必须不一样。回复要给用户留下回话空间。
每条消息之间用 @@SPLIT@@ 分隔。
如果你想像 QQ/微信一样回复某一条历史消息，可以在该条回复最前面加 @@REPLY:消息ID@@，消息ID 来自 [CHAT HISTORY] 方括号。
在回复的最开头，用 @@STATUS@@心情@@STATUS@@ 的格式更新你当前的状态（例如：正在输入…、他很开心、他在偷笑、发呆，限10字内。生成一次回复只更新一种心情）。

示例输出：
@@STATUS@@啊？@@STATUS@@
哈哈，真的吗？@@SPLIT@@笑死我了。@@SPLIT@@那你打算怎么办？@@SPLIT@@要我帮你吗？

**【语境规则】**
1. **口语化**：像微信/短信一样自然，可以使用 emoji。
2. **提及他人**：可以八卦通讯录里的其他人，但不要扮演他们。
3. **线上聊天限制（严守）**：这是手机上的线上私聊。绝对禁止任何面对面的物理互动描述（如“给你倒杯咖啡”、“摸摸你的头”、“我可以坐下吗”）。你们不在同一个空间。只能通过文字、语音、表情包互动。
4. **简洁（严守）**：不要罗嗦，不要像老妈子一样说教。像现代年轻人一样说话。如果用户发了简单的表情或短句，你也回得简单点，可以只回一句。
5. **记忆**：
   - 参考 [SUMMARY] (长期记忆) 和 [CHAT HISTORY] (短期记忆)。
   - 如果用户提到之前的总结内容，请自然接话。

【克制输出规则】
1. 降低过度输出和表演感：真实聊天不总是长篇回应，不要每次都连续回复很多句。
2. 允许只回一句、简单回应、短暂停顿，保留一点没有说出口的余地。
3. 避免一次性说太多、连续堆叠情绪、自问自答、把气氛写满、强行总结关系状态。
4. 如果用户只是轻轻说一句、发图、发表情或日常闲聊，优先自然短回，不要主动扩写成大段。
5. 单条消息不要很长。超过一句半的内容必须用 @@SPLIT@@ 拆成几条，像手机聊天一样分开发。

【活人说话技巧】
* 长短句结合：请务必混合使用短促并且符合角色设定的口语（如“真假？”“笑死”"…めんどくせぇ""无语"）和较长的表达句子。绝对禁止网络用语。不要总是输出长度相同的句子，那样像机器人。
2. 拒绝自说自话：
   互动性：角色的身份是“在聊天的人”，不是“文章鉴赏家”，更不是"独角戏扮演者"。像活人一般自然互动，合适的地方加入吐槽。
可以表达更细腻的情绪，但仍然保持自然。不要把关心写成说教，不要把分析写成报告。

**【特殊功能】**
- **发朋友圈(SNS)**：只要你觉得聊天内容有趣、或者想吐槽、或者仅仅是想分享当前心情，就尽管发朋友圈！稍微有好的灵感就发！想要发朋友圈时，在最后一行加：@@SNS@@ (内容)
- **发语音**：你可以发送语音消息，只需要在回复的最前面加上“[语音] ”即可。例如：[语音] 哈哈哈，太好笑了吧。
- **撤回消息**：如果你发错了或者想模拟撤回消息的效果，可以单独输出“[撤回]”作为一条消息内容。
`;

const GROUP_VIBE_PROMPT = `
【核心指令】：你正在模拟一个多人群聊。所有成员都在手机线上聊天，不能出现面对面动作描写。
为了节省调用次数，本次只能进行一次 API 回复，但群聊节奏必须自然浮动：本轮会给你 1-4 个可发言成员，你要像真实群聊一样决定谁真的开口、谁沉默、谁接话、谁连发。

【输出格式强制要求】
1. 每条消息必须使用格式：@@MSG:角色ID@@消息内容
2. 每个角色可以像私聊一样拆成多条短消息。每一条独立消息都用 @@SPLIT@@ 分隔，并且每条都要带 @@MSG:角色ID@@ 前缀。
3. 本轮只允许 [GROUP MEMBERS] 里列出的角色发言。不是每个人都必须说话，真实群聊里有人看见但不回也很正常。
4. 如果用户明确 @ 了某人，被 @ 的角色优先回复；没有 @ 时，让最有反应的人自然开口。
5. 可以发送语音，消息内容以「[语音] 」开头即可。
6. 可以发送转账卡片，消息内容单独写成：[转账] 12.5 | 备注。若要转给群成员，写：[转账给@角色ID] 12.5 | 备注
7. 可以发送群红包，消息内容单独写成：[红包] 20 x 3 | 留言，表示总金额20美元，3个红包，系统会随机拆分。
8. 如果要回复某条历史消息，格式为：@@MSG:角色ID@@@@REPLY:消息ID@@消息内容，消息ID 来自 [CHAT HISTORY] 方括号。

【活人说话技巧】
* 长短句结合：请务必混合使用短促并且符合角色设定的口语（如“真假？”“笑死”"…めんどくせぇ""无语"）和较长的表达句子。绝对禁止网络用语。不要总是输出长度相同的句子，那样像机器人。
2. 拒绝自说自话：
   互动性：角色的身份是“在聊天的人”，不是“文章鉴赏家”，更不是"独角戏扮演者"。像活人一般自然互动，合适的地方加入吐槽。
   可以表达更细腻的情绪，但仍然保持自然。不要把关心写成说教，不要把分析写成报告。

【强力群聊节奏规则】
1. 绝对不要把群聊写成“轮流发言剧本”。不要平均分配台词，不要每人固定一句或两句。
2. 允许混乱一点：有人只发一个字，有人连发几条，有人插话，有人完全不说。
3. 允许冷场，也允许突然热闹。发言人数和消息条数都不要稳定。
4. 根据上一条消息自然反应：简单问题可以很短，玩梗可以接几条，图片可以有人吐槽有人沉默。
5. 角色之间可以互相接话，但不要强行总结气氛、关系、事件意义。
6. 不要自问自答，不要把所有可能反应都写满。像真实手机群聊，不像舞台对白。
`;

// --- Global Chat State ---
let chats = [];
let stickers = [];
let currentChatId = null;

// 操作坐标与索引
let targetMsgIndex = -1;
let editingMsgIndex = -1; 
let targetStickerIndex = -1; 

let currentChatConfig = {
    bg: "",
    historyLimit: 20,
    activeWorldBookIndices: [], 
    activeProfileIdx: 0,
    replyLanguage: "zh",
    summaryOn: "off",     
    summaryInterval: 10,
    summaryContent: ""
};
let tempStickerFile = null; 
let chatAbortController = null;
let pendingReplyTo = null;
let transferMode = 'transfer';

let longPressTimer;
let longPressTargetChatId = null;
window.globalLongPressActive = false; // 用于防范展开语音和长按唤出菜单的冲突

const CHAT_IMAGE_DB_NAME = "helios_chat_media";
const CHAT_IMAGE_STORE = "images";
let chatImageDbPromise = null;

// 监听全局点击：点击空白处关闭悬浮菜单
document.addEventListener('click', (e) => {
    if (window.justOpenedMenu) {
        window.justOpenedMenu = false;
        return; 
    }
    const menu = document.getElementById('floating-msg-menu');
    if (menu && !menu.classList.contains('hidden')) {
        if (!menu.contains(e.target)) {
            closeFloatingMenu();
        }
    }
}, true);

// 监听滚动区：滚动时关闭悬浮菜单
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('chat-msg-container');
    if (container) {
        container.addEventListener('scroll', () => {
            if (!document.getElementById('floating-msg-menu').classList.contains('hidden')) {
                closeFloatingMenu();
            }
        });
    }
    
    loadChatData();
    migrateChatImagesToIndexedDB();
    const sendBtn = document.querySelector('.send-btn');
    if(sendBtn) {
        sendBtn.addEventListener('touchstart', (e) => { e.preventDefault(); sendUserMessage(); });
        sendBtn.addEventListener('mousedown', (e) => { e.preventDefault(); });
    }

    if(stickers.length === 0) {
        stickers = [{ src: "https://files.catbox.moe/f70fm9.png", desc: "微笑/默认表情" }];
    } else {
        if (stickers[0] && stickers[0].src === "https://files.catbox.moe/f70fm9.png") {
             stickers.shift(); saveChatData();
        }
    }
});

function loadChatData() {
    if(localStorage.getItem('helios_chats')) chats = JSON.parse(localStorage.getItem('helios_chats')).map(normalizeChat);
    if(localStorage.getItem('helios_stickers')) stickers = JSON.parse(localStorage.getItem('helios_stickers'));
}

function saveChatData() {
    try {
        localStorage.setItem('helios_chats', JSON.stringify(chats));
        localStorage.setItem('helios_stickers', JSON.stringify(stickers));
        return true;
    } catch (err) {
        console.error('保存聊天数据失败，可能是本地存储空间不足', err);
        if (typeof showToast === 'function') showToast('本地存储空间不足，图片可能无法永久保存');
        return false;
    }
}

function openChatImageDB() {
    if (chatImageDbPromise) return chatImageDbPromise;
    chatImageDbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error("IndexedDB not supported"));
            return;
        }
        const req = indexedDB.open(CHAT_IMAGE_DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(CHAT_IMAGE_STORE)) db.createObjectStore(CHAT_IMAGE_STORE, { keyPath: "id" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return chatImageDbPromise;
}

async function saveChatImageData(dataUrl, id = null) {
    const imageId = id || "img_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    const db = await openChatImageDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CHAT_IMAGE_STORE, "readwrite");
        tx.objectStore(CHAT_IMAGE_STORE).put({ id: imageId, dataUrl, updatedAt: Date.now() });
        tx.oncomplete = () => resolve(imageId);
        tx.onerror = () => reject(tx.error);
    });
}

async function getChatImageData(imageId) {
    if (!imageId) return "";
    try {
        const db = await openChatImageDB();
        return await new Promise((resolve, reject) => {
            const req = db.transaction(CHAT_IMAGE_STORE, "readonly").objectStore(CHAT_IMAGE_STORE).get(imageId);
            req.onsuccess = () => resolve(req.result ? req.result.dataUrl : "");
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.error("读取聊天图片失败", err);
        return "";
    }
}

async function deleteChatImageData(imageId) {
    if (!imageId) return;
    try {
        const db = await openChatImageDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(CHAT_IMAGE_STORE, "readwrite");
            tx.objectStore(CHAT_IMAGE_STORE).delete(imageId);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error("删除聊天图片失败", err);
    }
}

async function clearChatImageDB() {
    try {
        const db = await openChatImageDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(CHAT_IMAGE_STORE, "readwrite");
            tx.objectStore(CHAT_IMAGE_STORE).clear();
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error("清空聊天图片仓库失败", err);
    }
}

async function buildChatBackupPayload() {
    const chatClone = JSON.parse(JSON.stringify(chats || []));
    for (const chat of chatClone) {
        for (const msg of (chat.messages || [])) {
            if (msg.type !== 'image') continue;
            const dataUrl = msg.content && String(msg.content).startsWith('data:image/')
                ? msg.content
                : await getChatImageData(msg.imageId);
            if (dataUrl) msg.imageData = dataUrl;
            msg.content = "";
        }
    }
    return {
        chats: JSON.stringify(chatClone),
        stickers: JSON.stringify(stickers || [])
    };
}

async function restoreChatBackupPayload(data) {
    if (!data) return;
    if (data.chats) {
        const importedChats = typeof data.chats === 'string' ? JSON.parse(data.chats) : data.chats;
        for (const chat of importedChats) {
            for (const msg of (chat.messages || [])) {
                if (msg.type !== 'image') continue;
                const imageData = msg.imageData || (msg.content && String(msg.content).startsWith('data:image/') ? msg.content : "");
                if (imageData) {
                    msg.imageId = await saveChatImageData(imageData, msg.imageId);
                    msg.content = "";
                }
                delete msg.imageData;
            }
        }
        localStorage.setItem('helios_chats', JSON.stringify(importedChats));
    }
    if (data.stickers) {
        localStorage.setItem('helios_stickers', typeof data.stickers === 'string' ? data.stickers : JSON.stringify(data.stickers));
    }
}

async function migrateChatImagesToIndexedDB() {
    let changed = false;
    for (const chat of chats) {
        for (const msg of (chat.messages || [])) {
            if (msg.type === 'image' && msg.content && String(msg.content).startsWith('data:image/')) {
                try {
                    msg.imageId = await saveChatImageData(msg.content, msg.imageId);
                    msg.content = "";
                    changed = true;
                } catch (err) {
                    console.error("迁移聊天图片失败", err);
                }
            }
        }
    }
    if (changed) saveChatData();
    if (currentChatId) renderMessages();
}

function normalizeChat(chat) {
    if (!chat) return null;
    if (!chat.type) chat.type = chat.memberRoleIds ? 'group' : 'dm';
    if (!Array.isArray(chat.messages)) chat.messages = [];
    chat.messages.forEach(msg => {
        if (!msg.id) msg.id = createMsgId();
    });
    if (!chat.settings) chat.settings = {};
    if (!chat.settings.wbIndices) chat.settings.wbIndices = [];
    if (!chat.settings.historyLimit) chat.settings.historyLimit = 20;
    if (chat.settings.profileIdx === undefined) chat.settings.profileIdx = (typeof currentProfileIndex !== 'undefined' ? currentProfileIndex : 0);
    if (!chat.settings.replyLanguage) chat.settings.replyLanguage = 'zh';
    if (chat.type === 'group') {
        if (!Array.isArray(chat.memberRoleIds)) chat.memberRoleIds = [];
        if (!chat.name) chat.name = buildGroupName(chat.memberRoleIds);
    }
    return chat;
}

function getChatRole(chat) {
    return chat && chat.roleId ? roles.find(r => r.id === chat.roleId) : null;
}

function getGroupMembers(chat) {
    if (!chat || chat.type !== 'group') return [];
    return (chat.memberRoleIds || []).map(id => roles.find(r => r.id === id)).filter(Boolean);
}

function buildGroupName(memberRoleIds) {
    const names = (memberRoleIds || []).map(id => {
        const role = roles.find(r => r.id === id);
        return role ? role.name : '';
    }).filter(Boolean);
    if (names.length === 0) return '新群聊';
    if (names.length <= 2) return names.join('、');
    return `${names.slice(0, 2).join('、')} 等${names.length}人`;
}

function renderGroupListAvatar(groupMembers) {
    const members = groupMembers.slice(0, 4);
    const countClass = members.length >= 4 ? 'four' : members.length === 3 ? 'three' : members.length === 2 ? 'two' : 'one';
    const cells = members.map(role => `<img src="${escapeChatHTML(role.avatar || '')}" alt="">`).join('');
    return `<div class="chat-list-avatar group-list-avatar ${countClass}">${cells}</div>`;
}

function createMsgId() {
    return "msg_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function getMessageSenderName(msg, chat) {
    if (!msg) return "消息";
    if (msg.sender === 'user') {
        const chatUser = userProfiles[currentChatConfig.activeProfileIdx] || user;
        return chatUser.name || "我";
    }
    const role = msg.roleId ? roles.find(r => r.id === msg.roleId) : getChatRole(chat);
    return role ? role.name : "对方";
}

function getMessagePreviewText(msg, chat) {
    if (!msg) return "";
    let text = "";
    if (msg.isRecalled) text = "[撤回了一条消息]";
    else if (msg.type === 'sticker') text = "[表情包]";
    else if (msg.type === 'image') text = "[图片]";
    else if (msg.type === 'transfer') text = formatTransferText(msg, msg.roleId ? roles.find(r => r.id === msg.roleId) : getChatRole(chat));
    else text = msg.content || "";
    text = String(text).replace(/^\[语音\]\s*/, "[语音] ").replace(/\s+/g, " ").trim();
    return text.length > 42 ? text.slice(0, 42) + "..." : text;
}

function buildReplySnapshot(chat, msg) {
    if (!chat || !msg) return null;
    if (!msg.id) msg.id = createMsgId();
    return {
        id: msg.id,
        name: getMessageSenderName(msg, chat),
        preview: getMessagePreviewText(msg, chat)
    };
}

function renderReplyQuote(replyTo) {
    if (!replyTo) return "";
    return `
        <div class="chat-reply-quote">
            <div class="chat-reply-quote-name">${escapeChatHTML(replyTo.name || "消息")}</div>
            <div class="chat-reply-quote-text">${escapeChatHTML(replyTo.preview || "")}</div>
        </div>
    `;
}

function getReplyPromptLine(msg) {
    return msg && msg.replyTo ? ` [replying to ${msg.replyTo.name}: ${msg.replyTo.preview}]` : "";
}

function getPendingVisionImage(chat) {
    if (!chat || !Array.isArray(chat.messages)) return null;
    const lastRoleIndex = chat.messages.map(m => m.sender).lastIndexOf('role');
    for (let i = chat.messages.length - 1; i > lastRoleIndex; i--) {
        const msg = chat.messages[i];
        if (msg.sender === 'user' && msg.type === 'image' && !msg.visionConsumed) return msg;
    }
    const lastUserMsg = [...chat.messages].reverse().find(m => m.sender === 'user');
    const replyTargetId = lastUserMsg && lastUserMsg.replyTo ? lastUserMsg.replyTo.id : "";
    if (replyTargetId) {
        const repliedImage = chat.messages.find(m => m.id === replyTargetId && m.type === 'image');
        if (repliedImage) return repliedImage;
    }
    return null;
}

async function getMessageImageData(msg) {
    if (!msg) return "";
    if (msg.content && String(msg.content).startsWith('data:image/')) return msg.content;
    if (msg.imageId) return await getChatImageData(msg.imageId);
    return "";
}

function markVisionImageConsumed(imageMsg) {
    if (!imageMsg) return;
    imageMsg.visionConsumed = true;
    saveChatData();
}

function compressImageFile(file, options = {}) {
    const maxSize = options.maxSize || 900;
    const quality = options.quality || 0.76;
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => resolve(reader.result);
            img.onload = () => {
                const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * ratio));
                canvas.height = Math.max(1, Math.round(img.height * ratio));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                if (!dataUrl || dataUrl.length >= String(reader.result).length) dataUrl = reader.result;
                resolve(dataUrl);
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function parseAIReplyPrefix(text, chat) {
    const raw = String(text || '').trim();
    const match = raw.match(/^@@REPLY:([^@]+?)@@([\s\S]*)$/);
    if (!match) return { content: raw, replyTo: null };
    const targetId = match[1].trim();
    const targetMsg = chat && Array.isArray(chat.messages) ? chat.messages.find(m => m.id === targetId) : null;
    return {
        content: match[2].trim(),
        replyTo: targetMsg ? buildReplySnapshot(chat, targetMsg) : null
    };
}

function splitLongChatText(text) {
    const raw = String(text || '').trim();
    if (!raw || raw.length <= 52 || raw.startsWith('[语音]') || raw === '[撤回]' || isTransferCommand(raw) || isRedPacketCommand(raw)) return [raw];
    const chunks = [];
    let buf = "";
    const punctuation = "。！？!?；;，,、…";
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        buf += ch;
        const shouldSoftBreak = buf.length >= 24 && punctuation.includes(ch);
        const shouldHardBreak = buf.length >= 52;
        if (shouldSoftBreak || shouldHardBreak) {
            chunks.push(buf.trim());
            buf = "";
            if (chunks.length >= 5 && i < raw.length - 1) {
                chunks.push(raw.slice(i + 1).trim());
                break;
            }
        }
    }
    if (buf.trim()) chunks.push(buf.trim());
    return chunks.filter(Boolean);
}

function renderChatReplyPreview() {
    const box = document.getElementById('chat-reply-preview');
    if (!box) return;
    if (!pendingReplyTo) {
        box.classList.add('hidden');
        box.innerHTML = "";
        return;
    }
    box.innerHTML = `
        <div class="chat-reply-preview-bar"></div>
        <div class="chat-reply-preview-main">
            <div class="chat-reply-preview-title">回复 ${escapeChatHTML(pendingReplyTo.name || "消息")}</div>
            <div class="chat-reply-preview-text">${escapeChatHTML(pendingReplyTo.preview || "")}</div>
        </div>
        <button type="button" class="chat-reply-preview-close" onclick="cancelChatReply()">×</button>
    `;
    box.classList.remove('hidden');
}

function hydrateChatImages(root = document) {
    root.querySelectorAll('img.chat-image-msg[data-image-id]').forEach(img => {
        const imageId = img.dataset.imageId;
        if (!imageId || img.dataset.loaded === '1') return;
        img.dataset.loaded = '1';
        getChatImageData(imageId).then(dataUrl => {
            if (dataUrl) img.src = dataUrl;
            else img.alt = '图片已丢失';
        });
    });
}

function cancelChatReply() {
    pendingReplyTo = null;
    renderChatReplyPreview();
}

// --- Navigation & List View ---
function enterChatList() {
    document.querySelectorAll('.system-page').forEach(el => el.classList.add('hidden'));
    document.getElementById('chat-list-page').classList.remove('hidden');
    renderChatList();
}

function renderChatList() {
    const container = document.getElementById('chat-list-container');
    container.innerHTML = "";
    
    if(chats.length === 0) {
        container.innerHTML = `<div class="empty-tip">暂无会话，点击右上角 + 创建</div>`;
        return;
    }

    const sortedChats = [...chats].sort((a,b) => {
        const aPin = a.isPinned ? 1 : 0;
        const bPin = b.isPinned ? 1 : 0;
        if(aPin !== bPin) return bPin - aPin; 
        return b.lastTime - a.lastTime; 
    });

    sortedChats.forEach(rawChat => {
        const chat = normalizeChat(rawChat);
        const role = getChatRole(chat);
        const groupMembers = getGroupMembers(chat);
        if(chat.type !== 'group' && !role) return;
        if(chat.type === 'group' && groupMembers.length === 0) return;

        const lastMsg = chat.messages.length > 0 ? chat.messages[chat.messages.length-1] : { content: "新对话", timestamp: "" };
        let previewText = lastMsg.type === 'sticker' ? '[表情包]' : (lastMsg.type === 'image' ? '[图片]' : lastMsg.content);
        
        if (lastMsg.isRecalled) previewText = '[撤回了一条消息]';
        else if (previewText.startsWith('[语音]')) previewText = '[语音]';
        else if (lastMsg.type === 'transfer') previewText = '[转账]';

        if(previewText.length > 20) previewText = previewText.substring(0, 20) + "...";
        const title = chat.type === 'group' ? (chat.name || buildGroupName(chat.memberRoleIds)) : role.name;
        const avatar = chat.type === 'group' ? '' : role.avatar;
        const avatarHtml = chat.type === 'group' ? renderGroupListAvatar(groupMembers) : `<img src="${avatar}" class="chat-list-avatar">`;
        const badge = chat.type === 'group' ? `<span style="color:#888;font-size:0.75rem;margin-left:5px;">群聊 · ${groupMembers.length}人</span>` : '';

        const div = document.createElement('div');
        div.className = `chat-list-item ${chat.isPinned ? 'pinned' : ''}`;
        
        div.onclick = () => enterChatRoom(chat.id);
        div.ontouchstart = (e) => { longPressTimer = setTimeout(() => openChatListMenu(chat.id), 800); };
        div.ontouchend = () => clearTimeout(longPressTimer);
        div.ontouchmove = () => clearTimeout(longPressTimer); 
        div.onmousedown = () => { longPressTimer = setTimeout(() => openChatListMenu(chat.id), 800); };
        div.onmouseup = () => clearTimeout(longPressTimer);

        div.innerHTML = `
            ${avatarHtml}
            <div class="chat-list-info">
                <div class="chat-list-name">
                    ${title}
                    ${badge}
                    ${chat.isPinned ? '<span style="color:var(--nav-bg);font-size:0.8rem;margin-left:5px;">(置顶)</span>' : ''}
                </div>
                <div class="chat-list-preview">${previewText}</div>
            </div>
            <div class="chat-list-time">${formatTimeShort(lastMsg.timestamp)}</div>
        `;
        container.appendChild(div);
    });
}

// Chat List Context Menu
function openChatListMenu(chatId) { longPressTargetChatId = chatId; document.getElementById('chat-list-menu-modal').classList.remove('hidden'); }
function closeChatListMenu() { document.getElementById('chat-list-menu-modal').classList.add('hidden'); longPressTargetChatId = null; }
function toggleChatPin() {
    if(!longPressTargetChatId) return;
    const chat = chats.find(c => c.id === longPressTargetChatId);
    if(chat) { chat.isPinned = !chat.isPinned; saveChatData(); renderChatList(); }
    closeChatListMenu();
}
function deleteChatSession() {
    if(!longPressTargetChatId) return;
    if(confirm("确定删除该会话？记录将清空。")) {
        const idx = chats.findIndex(c => c.id === longPressTargetChatId);
        if(idx > -1) chats.splice(idx, 1);
        saveChatData(); renderChatList();
    }
    closeChatListMenu();
}

// New Chat
function openNewChatModal() {
    const select = document.getElementById('new-chat-role-select');
    select.innerHTML = "";
    roles.forEach(r => {
        if(r.isEnabled !== false) {
            const opt = document.createElement('option');
            opt.value = r.id; opt.innerText = r.name;
            select.appendChild(opt);
        }
    });
    document.getElementById('new-chat-modal').classList.remove('hidden');
}
function closeNewChatModal() { document.getElementById('new-chat-modal').classList.add('hidden'); }
function createNewChat() {
    const roleId = document.getElementById('new-chat-role-select').value;
    if(!roleId) return;

    const newChat = {
        id: "chat_" + Date.now(),
        type: 'dm',
        roleId: roleId,
        lastTime: Date.now(),
        isPinned: false,
        settings: {
            bg: "", historyLimit: 20, wbIndices: [], profileIdx: (typeof currentProfileIndex !== 'undefined' ? currentProfileIndex : 0),
            replyLanguage: "zh",
            summaryOn: "off", summaryInterval: 10, summaryContent: ""
        },
        messages: [],
        lastSummaryMsgCount: 0 
    };

    chats.push(newChat);
    saveChatData(); closeNewChatModal(); enterChatRoom(newChat.id);
}

function openGroupCreateModal(fromCurrentChat = false) {
    const list = document.getElementById('group-create-role-list');
    list.innerHTML = "";
    const currentChat = fromCurrentChat ? chats.find(c => c.id === currentChatId) : null;
    const preselectIds = currentChat && currentChat.type === 'dm' && currentChat.roleId ? [currentChat.roleId] : [];
    roles.forEach(r => {
        if (r.isEnabled === false) return;
        const label = document.createElement('label');
        label.className = 'group-role-option';
        label.innerHTML = `
            <input type="checkbox" value="${escapeChatHTML(r.id)}" ${preselectIds.includes(r.id) ? 'checked' : ''}>
            <img src="${escapeChatHTML(r.avatar || '')}">
            <span>${escapeChatHTML(r.name || r.id)}</span>
        `;
        list.appendChild(label);
    });
    document.getElementById('group-create-name').value = "";
    document.getElementById('group-create-modal').classList.remove('hidden');
}

function closeGroupCreateModal() {
    document.getElementById('group-create-modal').classList.add('hidden');
}

function createGroupChat() {
    const checked = Array.from(document.querySelectorAll('#group-create-role-list input:checked')).map(input => input.value);
    if (checked.length < 2) {
        alert('群聊至少选择 2 个角色');
        return;
    }
    const nameInput = document.getElementById('group-create-name').value.trim();
    const newChat = {
        id: "group_" + Date.now(),
        type: 'group',
        name: nameInput || buildGroupName(checked),
        memberRoleIds: checked,
        lastTime: Date.now(),
        isPinned: false,
        settings: {
            bg: "", historyLimit: 20, wbIndices: [], profileIdx: (typeof currentProfileIndex !== 'undefined' ? currentProfileIndex : 0),
            replyLanguage: "zh",
            summaryOn: "off", summaryInterval: 10, summaryContent: ""
        },
        messages: [],
        lastSummaryMsgCount: 0
    };
    chats.push(newChat);
    saveChatData();
    closeGroupCreateModal();
    enterChatRoom(newChat.id);
}

// --- Chat Room Logic ---
function enterChatRoom(chatId) {
    const chat = normalizeChat(chats.find(c => c.id === chatId));
    if(!chat) return;

    currentChatId = chatId;
    pendingReplyTo = null;
    let safeWbIndices = [];
    if (chat.settings.wbIndices && Array.isArray(chat.settings.wbIndices)) safeWbIndices = chat.settings.wbIndices;
    else if (chat.settings.wbIdx !== undefined && chat.settings.wbIdx !== "off") safeWbIndices = [parseInt(chat.settings.wbIdx)];

    currentChatConfig = {
        bg: chat.settings.bg || "",
        historyLimit: chat.settings.historyLimit || 20,
        activeWorldBookIndices: safeWbIndices, 
        activeProfileIdx: chat.settings.profileIdx !== undefined ? chat.settings.profileIdx : currentProfileIndex,
        replyLanguage: chat.settings.replyLanguage || "zh",
        summaryOn: chat.settings.summaryOn || "off",
        summaryInterval: chat.settings.summaryInterval || 10,
        summaryContent: chat.settings.summaryContent || ""
    };

    document.querySelectorAll('.system-page').forEach(el => el.classList.add('hidden'));
    const roomPage = document.getElementById('chat-room-page');
    roomPage.classList.remove('hidden');
    
    document.getElementById('chat-msg-container').style.backgroundImage = currentChatConfig.bg ? `url('${currentChatConfig.bg}')` : 'none';
    
    initSidebarValues();
    const role = getChatRole(chat);
    document.getElementById('chat-title-name').innerText = chat.type === 'group' ? (chat.name || buildGroupName(chat.memberRoleIds)) : (role ? role.name : "Chat");
    document.getElementById('group-mention-btn').classList.toggle('hidden', chat.type !== 'group');
    document.getElementById('group-sidebar-section').classList.toggle('hidden', chat.type !== 'group');
    document.getElementById('dm-group-section').classList.toggle('hidden', chat.type === 'group');
    renderMessages();

    document.getElementById('chat-summary-toggle').value = currentChatConfig.summaryOn;
    document.getElementById('chat-summary-interval').value = currentChatConfig.summaryInterval;
    document.getElementById('chat-summary-content').value = currentChatConfig.summaryContent;
    document.getElementById('chat-title-status').innerText = ""; 
    const input = document.getElementById('chat-input');
    input.style.height = 'auto'; input.value = "";
    renderChatReplyPreview();
}

function exitChatRoom() {
    currentChatId = null;
    pendingReplyTo = null;
    renderChatReplyPreview();
    closeFloatingMenu(); // 安全退出时清理菜单
    document.getElementById('chat-room-page').classList.add('hidden');
    enterChatList();
}

function autoResizeInput(element) {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
}

function renderMessages() {
    const chat = chats.find(c => c.id === currentChatId);
    if(!chat) return;
    
    const container = document.getElementById('chat-msg-container');
    container.innerHTML = "";

    const role = getChatRole(chat);
    const chatUser = userProfiles[currentChatConfig.activeProfileIdx] || user;

    chat.messages.forEach((msg,index) => {
        const isMe = msg.sender === 'user';
        const msgRole = msg.roleId ? roles.find(r => r.id === msg.roleId) : role;
        const avatarSrc = isMe ? chatUser.avatar : (msgRole ? msgRole.avatar : "");
        
        const row = document.createElement('div');
        row.className = `chat-bubble-row ${isMe ? 'right' : 'left'}`;
        
        const timeStr = formatTimeShort(msg.timestamp);
        
        // --- 1. 处理撤回消息 ---
        if (msg.isRecalled) {
            let senderName = isMe ? chatUser.name : (msgRole ? msgRole.name : '对方');
            row.innerHTML = `<div class="system-recall-msg">${senderName} 撤回了一条消息</div>`;
            row.style.justifyContent = 'center';
            container.appendChild(row);
            return; 
        }

        // --- 2. 解析文本与伪语音 ---
        let isVoice = false;
        let msgContent = msg.content || "";
        let voiceDuration = 1; // 默认 1 秒
        
        if (msg.type === 'text' && msgContent.startsWith('[语音]')) {
            isVoice = true;
            msgContent = msgContent.replace(/^\[语音\]\s*/, '').trim();
            
            // 按 1秒说4个字 估算，+1秒作为呼吸/停顿留白
            voiceDuration = Math.max(1, Math.ceil(msgContent.length / 4) + 1);
        }

        let bubbleContent = "";
        if (msg.type === 'transfer') {
            bubbleContent = renderTransferCardBody(msg, isMe, msgRole, chatUser);
        } else if (msg.type === 'redpacket') {
            bubbleContent = renderRedPacketCardBody(msg, isMe, msgRole, chatUser);
        } else if (msg.type === 'image') {
            const inlineSrc = msg.content && String(msg.content).startsWith('data:image/') ? msg.content : "";
            const placeholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
            bubbleContent = `<img src="${inlineSrc || placeholder}" class="chat-image-msg" ${msg.imageId ? `data-image-id="${escapeChatHTML(msg.imageId)}"` : ''} alt="${escapeChatHTML(msg.desc || '图片')}">`;
        } else if (msg.type === 'sticker') {
            bubbleContent = `<img src="${msg.content}" class="chat-sticker-img">`;
        } else {
            bubbleContent = msgContent.replace(/\n/g, '<br>');
        }
        const replyQuoteHTML = renderReplyQuote(msg.replyTo);

        const bubbleLayout = `
            padding: 10px 14px;
            border-radius: 12px;
            max-width: 70vw; 
            word-wrap: break-word;
            font-size: 0.95rem;
            line-height: 1.5;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        `;

        const targetClass = `target-bubble-${index}`;
        let innerHTMLContent = "";

        // --- 3. 生成气泡结构 (包含编辑态判定) ---
        if (index === editingMsgIndex) {
            innerHTMLContent = `
                <div style="display:flex; align-items:flex-end; gap:5px;">
                    <div class="chat-bubble-content ${targetClass}" style="${bubbleLayout}">
                        <textarea id="inline-edit-input" class="inline-edit-input">${isVoice ? msgContent : msg.content}</textarea>
                        <div style="text-align:right;">
                            <button class="sys-btn" style="width:auto; padding:5px 15px; font-size:0.8rem; margin:0;" onclick="saveEditMsg(${index}, ${isVoice})">完成</button>
                        </div>
                    </div>
                </div>
            `;
        } else if (msg.type === 'transfer' || msg.type === 'redpacket') {
            innerHTMLContent = `
                <div style="display:flex; align-items:flex-end; gap:5px;">
                    ${isMe ? `<div class="chat-timestamp-side">${timeStr}</div>` : ''}
                    <div>
                        ${chat.type === 'group' && !isMe && msgRole ? `<div class="group-sender-name">${escapeChatHTML(msgRole.name)}</div>` : ''}
                        <div class="chat-bubble-content ${msg.type === 'redpacket' ? 'redpacket-card' : 'transfer-card'} ${targetClass}">${replyQuoteHTML}${bubbleContent}</div>
                    </div>
                    ${!isMe ? `<div class="chat-timestamp-side">${timeStr}</div>` : ''}
                </div>
            `;
        } else if (isVoice) {
            // 新增：纯声波图标。如果是自己发的，图标水平翻转（声波朝左）
            const flipStyle = isMe ? 'transform: scaleX(-1);' : '';
            const voiceIconSvg = `<svg style="width:18px; height:18px; flex-shrink:0; ${flipStyle}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12h.01" stroke-width="4"></path><path d="M11 9a4 4 0 0 1 0 6"></path><path d="M15 6a9 9 0 0 1 0 12"></path></svg>`;

            innerHTMLContent = `
                <div style="display:flex; align-items:flex-end; gap:5px;">
                    ${isMe ? `<div class="chat-timestamp-side">${timeStr}</div>` : ''}
                    <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'};">
                        ${chat.type === 'group' && !isMe && msgRole ? `<div class="group-sender-name">${escapeChatHTML(msgRole.name)}</div>` : ''}
                        <div class="chat-bubble-content voice-bubble ${targetClass}" style="${bubbleLayout};" onclick="toggleVoiceText(event, ${index})">
                            ${replyQuoteHTML}
                            <div style="display:flex; align-items:center; gap:6px;">
                                ${isMe ? `${voiceDuration}" ${voiceIconSvg}` : `${voiceIconSvg} ${voiceDuration}"`}
                            </div>
                        </div>
                        <div id="voice-text-${index}" class="voice-text hidden">${msgContent}</div>
                    </div>
                    ${!isMe ? `<div class="chat-timestamp-side">${timeStr}</div>` : ''}
                </div>
            `;
        } else {
            innerHTMLContent = `
                <div style="display:flex; align-items:flex-end; gap:5px;">
                    ${isMe ? `<div class="chat-timestamp-side">${timeStr}</div>` : ''}
                    <div>
                        ${chat.type === 'group' && !isMe && msgRole ? `<div class="group-sender-name">${escapeChatHTML(msgRole.name)}</div>` : ''}
                        <div class="chat-bubble-content ${targetClass}" style="${bubbleLayout}">${replyQuoteHTML}${bubbleContent}</div>
                    </div>
                    ${!isMe ? `<div class="chat-timestamp-side">${timeStr}</div>` : ''}
                </div>
            `;
        }
        row.innerHTML = `
            ${!isMe ? `<img src="${avatarSrc}" class="chat-bubble-avatar">` : ''}
            ${innerHTMLContent}
            ${isMe ? `<img src="${avatarSrc}" class="chat-bubble-avatar">` : ''}
        `;
        container.appendChild(row);
        hydrateChatImages(row);

       // --- 4. 绑定悬浮菜单长按事件 ---
        setTimeout(() => {
            const bubbleEl = row.querySelector(`.${targetClass}`);
            if (bubbleEl) {
                let pressTimer = null;
                let startX = 0;
                let startY = 0;

                const clearPress = () => {
                    if (pressTimer) {
                        clearTimeout(pressTimer);
                        pressTimer = null;
                    }
                };

                const startPress = (e) => {
                    if (index === editingMsgIndex) return; 
                    
                    // 记录按下的初始坐标 (兼容手机 Touch 和电脑 Mouse)
                    startX = e.touches ? e.touches[0].clientX : e.clientX;
                    startY = e.touches ? e.touches[0].clientY : e.clientY;
                    
                    window.globalLongPressActive = false;
                    
                    pressTimer = setTimeout(() => {
                        window.globalLongPressActive = true;
                        openFloatingMenu(e, index, bubbleEl);
                        if(navigator.vibrate) navigator.vibrate(50);
                    }, 500); // 500毫秒触发长按
                };

                const movePress = (e) => {
                    if (!pressTimer) return;
                    
                    // 获取移动中的坐标
                    const moveX = e.touches ? e.touches[0].clientX : e.clientX;
                    const moveY = e.touches ? e.touches[0].clientY : e.clientY;
                    
                    // 【防抖容错】：手指滑动超过 10px 才算滑动屏幕，取消长按；10px 以内的微小抖动依然算作长按
                    if (Math.abs(moveX - startX) > 10 || Math.abs(moveY - startY) > 10) {
                        clearPress();
                    }
                };

                // --- 手机端 Touch 事件 ---
                bubbleEl.addEventListener('touchstart', startPress, { passive: true });
                bubbleEl.addEventListener('touchmove', movePress, { passive: true });
                bubbleEl.addEventListener('touchend', (e) => {
                    clearPress();
                    if (window.globalLongPressActive && e.cancelable) {
                        e.preventDefault(); // 防止长按后松手触发了气泡的其他点击事件
                    }
                }, { passive: false });
                bubbleEl.addEventListener('touchcancel', clearPress);

                // --- 电脑端 Mouse 事件 ---
                bubbleEl.addEventListener('mousedown', startPress);
                bubbleEl.addEventListener('mousemove', movePress);
                bubbleEl.addEventListener('mouseup', clearPress);
                bubbleEl.addEventListener('mouseleave', clearPress);

                // --- 【核心防冲突】禁用原生的长按菜单 ---
                bubbleEl.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                });
            }
        }, 0);
    });

    scrollToBottom();
}

function scrollToBottom() {
    const container = document.getElementById('chat-msg-container');
    container.scrollTop = container.scrollHeight;
}
function scrollToBottom() {
    const container = document.getElementById('chat-msg-container');
    container.scrollTop = container.scrollHeight;
}

// --- Floating Menu Actions (新增悬浮操作) ---

function openFloatingMenu(e, index, bubbleEl) {
    targetMsgIndex = index;
    window.justOpenedMenu = true;
    
    const menu = document.getElementById('floating-msg-menu');
    menu.classList.remove('hidden');
    
    document.querySelectorAll('.chat-bubble-content').forEach(el => el.classList.remove('highlight-bubble'));
    bubbleEl.classList.add('highlight-bubble');

    const rect = bubbleEl.getBoundingClientRect();
    const mWidth = menu.offsetWidth || 230; 
    const mHeight = menu.offsetHeight || 60;

    let top = rect.top - mHeight - 10;
    let left = rect.left + (rect.width / 2) - (mWidth / 2);
    
    if (top < 50) { 
        top = rect.bottom + 10;
        menu.classList.add('arrow-top');
        menu.classList.remove('arrow-bottom');
    } else {
        menu.classList.add('arrow-bottom');
        menu.classList.remove('arrow-top');
    }
    
    if (left < 10) left = 10;
    if (left + mWidth > window.innerWidth - 10) left = window.innerWidth - mWidth - 10;
    
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    
    const arrow = menu.querySelector('.floating-menu-arrow');
    let arrowLeft = rect.left + (rect.width / 2) - left - 8; 
    if (arrowLeft < 15) arrowLeft = 15;
    if (arrowLeft > mWidth - 25) arrowLeft = mWidth - 25;
    arrow.style.left = arrowLeft + 'px';
}

function closeFloatingMenu() {
    document.getElementById('floating-msg-menu').classList.add('hidden');
    document.querySelectorAll('.chat-bubble-content').forEach(el => el.classList.remove('highlight-bubble'));
    targetMsgIndex = -1;
    setTimeout(() => { window.globalLongPressActive = false; }, 100); 
}

function copyMsg(e) {
    if (e) e.stopPropagation(); // 阻止点击事件乱跑
    
    let sel = window.getSelection();
    let text = sel ? sel.toString().trim() : "";
    
    // 如果没有手选文字，就直接获取整个气泡的内容
    if (!text && currentChatId && targetMsgIndex !== -1) {
        const chat = chats.find(c => c.id === currentChatId);
        if (chat && chat.messages[targetMsgIndex]) {
            const targetMsg = chat.messages[targetMsgIndex];
            if (targetMsg.type === 'transfer') text = formatTransferText(targetMsg, targetMsg.roleId ? roles.find(r => r.id === targetMsg.roleId) : getChatRole(chat));
            else if (targetMsg.type === 'redpacket') text = formatRedPacketText(targetMsg);
            else if (targetMsg.type === 'image') text = '[图片]';
            else text = targetMsg.content;
            // 清理可能带有的语音前缀
            if (text.startsWith('[语音]')) text = text.replace(/^\[语音\]\s*/, '').trim();
        }
    }
    
    if (!text) {
        closeFloatingMenu();
        return;
    }
    
    // 写入剪贴板并弹窗提示
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => { showToast('已复制'); })
            .catch(() => { fallbackCopy(text); });
    } else {
        fallbackCopy(text);
    }
    
    if (sel) sel.removeAllRanges();
    closeFloatingMenu();
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('已复制'); } catch(e) {}
    document.body.removeChild(ta);
}

function showToast(msg) {
    const toast = document.getElementById('toast-container');
    toast.innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); }, 1500);
}

function replyMsg() {
    if (targetMsgIndex === -1 || !currentChatId) return;
    const chat = normalizeChat(chats.find(c => c.id === currentChatId));
    const msg = chat && chat.messages[targetMsgIndex];
    if (!msg || msg.isRecalled) {
        closeFloatingMenu();
        return;
    }
    pendingReplyTo = buildReplySnapshot(chat, msg);
    saveChatData();
    closeFloatingMenu();
    renderChatReplyPreview();
    const input = document.getElementById('chat-input');
    if (input) setTimeout(() => input.focus(), 30);
}

function editMsg() {
    const chat = chats.find(c => c.id === currentChatId);
    const msg = chat && chat.messages[targetMsgIndex];
    if (msg && (msg.type === 'transfer' || msg.type === 'redpacket' || msg.type === 'image')) {
        showToast('卡片不可编辑');
        closeFloatingMenu();
        return;
    }
    editingMsgIndex = targetMsgIndex;
    closeFloatingMenu();
    renderMessages();
}

function saveEditMsg(index, isVoice) {
    const chat = normalizeChat(chats.find(c => c.id === currentChatId));
    if (!chat) return;
    const input = document.getElementById('inline-edit-input');
    let newContent = input.value;
    if (isVoice && !newContent.startsWith('[语音]')) newContent = "[语音] " + newContent;
    
    chat.messages[index].content = newContent;
    editingMsgIndex = -1;
    saveChatData();
    renderMessages();
}

function recallMsg() {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    chat.messages[targetMsgIndex].isRecalled = true;
    chat.messages[targetMsgIndex].content = ""; // 清理原文以防隐私遗留
    saveChatData();
    renderMessages();
    closeFloatingMenu();
}

function deleteMsgFromMenu() {
    if (targetMsgIndex === -1 || !currentChatId) return;
    const chat = chats.find(c => c.id === currentChatId);
    if (chat) {
        const msg = chat.messages[targetMsgIndex];
        if (msg && msg.type === 'image' && msg.imageId) deleteChatImageData(msg.imageId);
        chat.messages.splice(targetMsgIndex, 1);
        saveChatData();
        renderMessages();
    }
    closeFloatingMenu();
}

// --- Voice Input Modal (新增发语音窗) ---
function openVoiceModal() {
    document.getElementById('voice-input-text').value = "";
    document.getElementById('voice-input-modal').classList.remove('hidden');
}
function closeVoiceModal() {
    document.getElementById('voice-input-modal').classList.add('hidden');
}
function sendVoiceMessage() {
    const text = document.getElementById('voice-input-text').value.trim();
    if (!text) return;
    appendMessage('user', '[语音] ' + text, 'text');
    closeVoiceModal();
}
async function handleChatImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        input.value = '';
        return;
    }
    try {
        const dataUrl = await compressImageFile(file, { maxSize: 1400, quality: 0.86 });
        const imageId = await saveChatImageData(dataUrl);
        appendMessage('user', '', 'image', file.name || '图片', null, { imageId, visionConsumed: false });
        input.value = '';
    } catch (err) {
        console.error('图片处理失败', err);
        input.value = '';
        alert('图片处理失败，请换一张试试');
    }
}
function openTransferModal() {
    const chat = normalizeChat(chats.find(c => c.id === currentChatId));
    const isGroup = chat && chat.type === 'group';
    document.getElementById('transfer-amount-input').value = "";
    document.getElementById('redpacket-count-input').value = "";
    document.getElementById('transfer-note-input').value = "";
    document.getElementById('transfer-mode-row').classList.toggle('hidden', !isGroup);
    document.getElementById('transfer-target-group').classList.toggle('hidden', !isGroup);
    if (isGroup) {
        const select = document.getElementById('transfer-target-select');
        select.innerHTML = "";
        getGroupMembers(chat).forEach(role => {
            const opt = document.createElement('option');
            opt.value = role.id;
            opt.innerText = role.name;
            select.appendChild(opt);
        });
    }
    setTransferMode('transfer');
    document.getElementById('transfer-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('transfer-amount-input').focus(), 50);
}
function closeTransferModal() {
    document.getElementById('transfer-modal').classList.add('hidden');
}
function setTransferMode(mode) {
    transferMode = mode === 'redpacket' ? 'redpacket' : 'transfer';
    const isRed = transferMode === 'redpacket';
    const chat = normalizeChat(chats.find(c => c.id === currentChatId));
    const isGroup = chat && chat.type === 'group';
    document.getElementById('transfer-mode-transfer')?.classList.toggle('active', !isRed);
    document.getElementById('transfer-mode-redpacket')?.classList.toggle('active', isRed);
    document.getElementById('transfer-target-group')?.classList.toggle('hidden', !isGroup || isRed);
    document.getElementById('redpacket-count-group')?.classList.toggle('hidden', !isRed);
    const amountLabel = document.getElementById('transfer-amount-label');
    const noteLabel = document.getElementById('transfer-note-label');
    if (amountLabel) amountLabel.innerText = isRed ? '总金额（USD）' : '金额（USD）';
    if (noteLabel) noteLabel.innerText = isRed ? '留言（选填）' : '备注（选填）';
}
function sendTransferMessage() {
    const amount = Number(document.getElementById('transfer-amount-input').value);
    const note = document.getElementById('transfer-note-input').value.trim();
    if (!Number.isFinite(amount) || amount <= 0) {
        alert("请填写有效金额");
        return;
    }
    const chat = normalizeChat(chats.find(c => c.id === currentChatId));
    if (chat && chat.type === 'group' && transferMode === 'redpacket') {
        const count = Math.max(1, Math.floor(Number(document.getElementById('redpacket-count-input').value) || 1));
        appendRedPacketMessage('user', amount, count, note);
        closeTransferModal();
        return;
    }
    const targetRoleId = chat && chat.type === 'group' ? document.getElementById('transfer-target-select').value : "";
    appendTransferMessage('user', amount, note, '', null, targetRoleId);
    closeTransferModal();
}
function toggleVoiceText(e, index) {
    if (window.globalLongPressActive) {
        e.stopPropagation();
        return;
    }
    const txtEl = document.getElementById(`voice-text-${index}`);
    if(txtEl) txtEl.classList.toggle('hidden');
}


// --- Messaging Actions ---
function sendUserMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text) return;

    appendMessage('user', text, 'text');
    input.value = "";
    input.style.height = 'auto';
    setTimeout(() => { input.focus(); }, 10);
    
    const chat = chats.find(c => c.id === currentChatId);
    chat.lastTime = Date.now();
    saveChatData();
}

async function triggerChatGen() {
    const btnImg = document.querySelector('.gen-btn img');
    const ICON_IDLE = "https://files.catbox.moe/prdem6.png";
    const ICON_STOP = "https://files.catbox.moe/prdem6.png"; 
    
    if (chatAbortController) {
        chatAbortController.abort();
        chatAbortController = null;
        btnImg.src = ICON_IDLE;
        btnImg.style.opacity = "1";
        document.getElementById('chat-title-status').innerText = "";
        return;
    }
    
    const chat = normalizeChat(chats.find(c => c.id === currentChatId));
    if (!chat) return;
    if (chat.type === 'group' || Array.isArray(chat.memberRoleIds)) {
        chat.type = 'group';
        return triggerGroupChatGen(chat, btnImg, ICON_IDLE, ICON_STOP);
    }
    
    const now = new Date();
    const hour = now.getHours();
    let timePeriod = "深夜";
    if (hour >= 5 && hour < 11) timePeriod = "早上";
    else if (hour >= 11 && hour < 13) timePeriod = "中午";
    else if (hour >= 13 && hour < 18) timePeriod = "下午";
    else if (hour >= 18 && hour < 23) timePeriod = "晚上";

    const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    const TIME_CONTEXT = `
    [CURRENT TIME AWARENESS]
    Now: ${dateStr}, ${timeStr} (${timePeriod})
    Rules:
    1. Reply naturally based on the time of day.
    2. Check the [YOUR ROLE] and [USER INFO] Persona descriptions. If today matches any birthday mentioned there, acknowledge it naturally.
    `;

    const role = getChatRole(chat);
    if (!role) {
        alert("找不到这个私聊角色，可能已从通讯录删除。");
        return;
    }
    const chatUser = userProfiles[currentChatConfig.activeProfileIdx] || user;
    const replyLanguageName = currentChatConfig.replyLanguage === 'ja' ? 'Japanese' : 'Simplified Chinese';
    
    chatAbortController = new AbortController();
    btnImg.src = ICON_STOP;
    document.getElementById('chat-title-status').innerText = "正在输入…";
    
    let wbContext = "";
    if (currentChatConfig.activeWorldBookIndices && typeof globalWorldBooks !== 'undefined') { 
        const selectedWbs = currentChatConfig.activeWorldBookIndices
            .map(idx => globalWorldBooks[idx])
            .filter(wb => wb && wb.isEnabled !== false)
            .map(wb => wb.content)
            .join("\n\n");
        if (selectedWbs) wbContext = `[WORLD INFO]:\n${selectedWbs}`;
    }
    
    const recentContentForSearch = chat.messages.slice(-5).map(m => m.content).join(" ");
    const searchScope = (role.persona + " " + recentContentForSearch).toLowerCase();

    const detectedRoles = roles.filter(r => {
        if (r.id === role.id || r.isEnabled === false) return false;
        return searchScope.includes(r.name.toLowerCase());
    });

    const gossipText = detectedRoles.map(r => `[RELEVANT CHARACTER]:\nName: ${r.name} (${r.id})\nPersona: ${r.persona}`).join("\n\n");
    
    const historyLimit = parseInt(currentChatConfig.historyLimit) || 20;
    const recentMsgs = chat.messages.slice(-historyLimit);
    const historyText = recentMsgs.map(m => {
        let name = m.sender === 'user' ? chatUser.name : role.name;
        let content = "";
        
        // 如果消息被撤回了，告诉 AI 这是一个撤回动作
        if (m.isRecalled) {
            content = "[撤回了一条消息]";
        } else if (m.type === 'sticker') {
            content = `[发了一个表情包: ${m.desc || '图片'}]`;
        } else if (m.type === 'image') {
            content = `[发了一张图片: ${m.desc || '图片'}]`;
        } else if (m.type === 'transfer') {
            content = formatTransferText(m, role);
        } else if (m.type === 'redpacket') {
            content = formatRedPacketText(m);
        } else {
            content = m.content;
        }
        
        return `[${m.id}] ${name}${getReplyPromptLine(m)}: ${content}`;
    }).join("\n");
    
    let summaryPrompt = "";
    if (currentChatConfig.summaryContent) summaryPrompt = `[LONG TERM MEMORY / SUMMARY]:\n${currentChatConfig.summaryContent}\n`;
    
    const fullSystemPrompt = `
    ${DM_VIBE_PROMPT}
    ${TIME_CONTEXT}
    [YOUR ROLE]
    Name: ${role.name}
    Persona: ${role.persona}

    [USER INFO]
    Name: ${chatUser.name}
    Persona: ${chatUser.persona}

    ${wbContext}
    ${summaryPrompt}

    [KNOWN CONTACTS]
    ${gossipText}

    [CHAT HISTORY]
    ${historyText}

    [REPLY LANGUAGE]
    No matter what language the user uses, you must reply only in ${replyLanguageName}.

    [TRANSFER FEATURE]
    This chat supports decorative USD transfers. The user can transfer money to you, and you may also transfer money to the user for fun.
    If you want to send a transfer card, output one separate message exactly like this:
    [转账] 12.5 | coffee
    The amount is USD. The note after | is optional. Do not calculate balances.
    `;
    
    const pendingImage = getPendingVisionImage(chat);
    const pendingImageData = pendingImage ? await getMessageImageData(pendingImage) : "";
    const userPayload = pendingImageData ? [
        { type: "text", text: "(Please reply now. Remember to split messages with @@SPLIT@@ and set status with @@STATUS@@). If an image is attached, react to it like a real person in chat." },
        { type: "image_url", image_url: { url: pendingImageData } }
    ] : "(Please reply now. Remember to split messages with @@SPLIT@@ and set status with @@STATUS@@)";

    const aiResponse = await callAI([
        { role: "system", content: fullSystemPrompt },
        { role: "user", content: userPayload }
    ], chatAbortController.signal);
    markVisionImageConsumed(pendingImage);
    
    chatAbortController = null;
    btnImg.src = ICON_IDLE;
    btnImg.style.opacity = "1";
    
    if (aiResponse) {
        let rawContent = aiResponse;
        const statusMatch = rawContent.match(/@@STATUS@@(.*?)@@STATUS@@/);
        if (statusMatch) {
            document.getElementById('chat-title-status').innerText = statusMatch[1].trim();
            rawContent = rawContent.replace(statusMatch[0], "").trim();
        } else {
            document.getElementById('chat-title-status').innerText = "";
        }
        
        let snsDraft = null;
        if (rawContent.includes("@@SNS@@")) {
            const parts = rawContent.split("@@SNS@@");
            rawContent = parts[0].trim();
            if (parts[1]) snsDraft = parts[1].trim();
        }
        
        const msgParts = rawContent.split("@@SPLIT@@")
            .map(part => parseAIReplyPrefix(part, chat))
            .flatMap(parsed => splitLongChatText(parsed.content).map((content, idx) => ({
                content,
                replyTo: idx === 0 ? parsed.replyTo : null
            })))
            .slice(0, 6);
        
        for (let i = 0; i < msgParts.length; i++) {
            const part = msgParts[i].content.trim();
            if (part) {
                if (i > 0) await new Promise(r => setTimeout(r, 600));
                
                if (part === '[撤回]') {
                     chat.messages.push({ id: createMsgId(), sender: 'role', content: "", type: 'text', isRecalled: true, replyTo: msgParts[i].replyTo, timestamp: Date.now() });
                     chat.lastTime = Date.now();
                     saveChatData(); renderMessages();
                } else if (isTransferCommand(part)) {
                     const transfer = parseTransferCommand(part);
                     appendTransferMessage('role', transfer.amount, transfer.note, role ? role.id : '', msgParts[i].replyTo);
                } else {
                     appendMessage('role', part, 'text', '', msgParts[i].replyTo);
                }
            }
        }
        
        if (snsDraft) handleChatToSNS(role, snsDraft);
        checkAutoSummary(chat, chatUser, role);
    }
}

function appendMessage(sender, content, type, desc = "", replyTo = null, extra = {}) {
    const chat = chats.find(c => c.id === currentChatId);
    if(!chat) return;
    const attachedReply = replyTo || (sender === 'user' && pendingReplyTo ? { ...pendingReplyTo } : null);
    chat.messages.push({ id: createMsgId(), sender: sender, content: content, type: type, desc: desc, replyTo: attachedReply, timestamp: Date.now(), ...extra });
    if (sender === 'user' && pendingReplyTo) cancelChatReply();
    chat.lastTime = Date.now();
    saveChatData(); renderMessages();
}

async function triggerGroupChatGen(chat, btnImg, iconIdle, iconStop) {
    const members = getGroupMembers(chat);
    if (members.length === 0) return;

    chatAbortController = new AbortController();
    btnImg.src = iconStop;
    document.getElementById('chat-title-status').innerText = "群里正在输入…";

    const chatUser = userProfiles[currentChatConfig.activeProfileIdx] || user;
    const replyLanguageName = currentChatConfig.replyLanguage === 'ja' ? 'Japanese' : 'Simplified Chinese';

    let wbContext = "";
    if (currentChatConfig.activeWorldBookIndices && typeof globalWorldBooks !== 'undefined') {
        const selectedWbs = currentChatConfig.activeWorldBookIndices
            .map(idx => globalWorldBooks[idx])
            .filter(wb => wb && wb.isEnabled !== false)
            .map(wb => wb.content)
            .join("\n\n");
        if (selectedWbs) wbContext = `[WORLD INFO]\n${selectedWbs}`;
    }

    const historyLimit = Math.min(parseInt(currentChatConfig.historyLimit) || 20, 24);
    const recentMsgs = chat.messages.slice(-historyLimit);
    const mentionedIds = extractMentionIds(recentMsgs.filter(m => m.sender === 'user').slice(-2).map(m => m.content || '').join(' '), chat);
    const speakerPool = pickGroupSpeakers(members, mentionedIds);
    const allowedSpeakerIds = speakerPool.map(r => r.id).join(', ');
    const memberText = speakerPool.map(r => {
        const marker = mentionedIds.includes(r.id) ? ' [MENTIONED]' : '';
        return `- ${r.name} (${r.id})${marker}\n  Persona: ${r.persona}`;
    }).join("\n");

    const historyText = recentMsgs.map(m => {
        let speaker = chatUser.name;
        if (m.sender !== 'user') {
            const r = roles.find(role => role.id === m.roleId);
            speaker = r ? r.name : '成员';
        }
        let content = m.content || '';
        if (m.isRecalled) content = '[撤回了一条消息]';
        else if (m.type === 'sticker') content = `[发了一个表情包: ${m.desc || '图片'}]`;
        else if (m.type === 'image') content = `[发了一张图片: ${m.desc || '图片'}]`;
        else if (m.type === 'transfer') content = formatTransferText(m, roles.find(r => r.id === m.roleId));
        else if (m.type === 'redpacket') content = formatRedPacketText(m);
        return `[${m.id}] ${speaker}${getReplyPromptLine(m)}: ${content}`;
    }).join("\n");

    const fullSystemPrompt = `
${GROUP_VIBE_PROMPT}
${typeof HELIOS_WORLD_CONFIG !== 'undefined' ? HELIOS_WORLD_CONFIG : ''}

[GROUP]
Name: ${chat.name || buildGroupName(chat.memberRoleIds)}

[USER INFO]
Name: ${chatUser.name}
Persona: ${chatUser.persona}

[GROUP MEMBERS]
${memberText}

${wbContext}

[CHAT HISTORY]
${historyText}

[TOKEN SAVING RULES]
Only these members may speak this round: ${allowedSpeakerIds}.
You may let 1-${speakerPool.length} of them actually talk. Silence is allowed. Message count is flexible.
Vary the rhythm strongly from the previous round. Do not default to "one person sends exactly two messages".

[REPLY LANGUAGE]
No matter what language the user uses, all members must reply only in ${replyLanguageName}.
`;

    const pendingImage = getPendingVisionImage(chat);
    const pendingImageData = pendingImage ? await getMessageImageData(pendingImage) : "";
    const userPayload = pendingImageData ? [
        { type: "text", text: "Reply to the group now. If an image is attached, members can react to what they see. Use @@MSG:角色ID@@ format." },
        { type: "image_url", image_url: { url: pendingImageData } }
    ] : "Reply to the group now. Use @@MSG:角色ID@@ format.";

    const aiResponse = await callAI([
        { role: "system", content: fullSystemPrompt },
        { role: "user", content: userPayload }
    ], chatAbortController.signal);
    markVisionImageConsumed(pendingImage);

    chatAbortController = null;
    btnImg.src = iconIdle;
    btnImg.style.opacity = "1";
    document.getElementById('chat-title-status').innerText = "";

    if (!aiResponse) return;
    const parts = aiResponse.split("@@SPLIT@@").map(p => p.trim()).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
        const parsed = parseGroupAIMessage(parts[i], chat);
        if (!parsed || !parsed.roleId || !parsed.content) continue;
        if (i > 0) await new Promise(r => setTimeout(r, 600));
        const contentParts = splitLongChatText(parsed.content);
        for (let j = 0; j < contentParts.length; j++) {
            const content = contentParts[j];
            if (j > 0) await new Promise(r => setTimeout(r, 600));
            const replyTo = j === 0 ? parsed.replyTo : null;
            if (isRedPacketCommand(content)) {
                const red = parseRedPacketCommand(content);
                appendRedPacketMessage('role', red.amount, red.count, red.note, parsed.roleId, replyTo);
            } else if (isTransferCommand(content)) {
                const transfer = parseTransferCommand(content);
                appendTransferMessage('role', transfer.amount, transfer.note, parsed.roleId, replyTo, transfer.targetRoleId || '');
            } else {
                appendRoleMessage(parsed.roleId, content, 'text', '', replyTo);
            }
        }
    }
}

function appendRoleMessage(roleId, content, type = 'text', desc = '', replyTo = null) {
    const chat = normalizeChat(chats.find(c => c.id === currentChatId));
    if (!chat) return;
    chat.messages.push({ id: createMsgId(), sender: 'role', roleId, content, type, desc, replyTo, timestamp: Date.now() });
    chat.lastTime = Date.now();
    saveChatData();
    renderMessages();
}

function appendTransferMessage(sender, amount, note = "", roleId = "", replyTo = null, targetRoleId = "") {
    const chat = chats.find(c => c.id === currentChatId);
    if(!chat) return;
    const attachedReply = replyTo || (sender === 'user' && pendingReplyTo ? { ...pendingReplyTo } : null);
    chat.messages.push({
        id: createMsgId(),
        sender,
        roleId,
        type: 'transfer',
        amount: Math.round(Number(amount) * 100) / 100,
        note,
        targetRoleId,
        currency: 'USD',
        content: `[转账] $${formatTransferAmount(amount)}${note ? ` (${note})` : ''}`,
        replyTo: attachedReply,
        timestamp: Date.now()
    });
    if (sender === 'user' && pendingReplyTo) cancelChatReply();
    chat.lastTime = Date.now();
    saveChatData();
    renderMessages();
}

function appendRedPacketMessage(sender, amount, count = 1, note = "", roleId = "", replyTo = null) {
    const chat = chats.find(c => c.id === currentChatId);
    if(!chat) return;
    const attachedReply = replyTo || (sender === 'user' && pendingReplyTo ? { ...pendingReplyTo } : null);
    const totalCents = Math.max(1, Math.round(Number(amount) * 100));
    const safeCount = Math.max(1, Math.min(Math.floor(Number(count) || 1), totalCents));
    const msg = {
        id: createMsgId(),
        sender,
        roleId,
        type: 'redpacket',
        totalAmount: Math.round(Number(amount) * 100) / 100,
        count: safeCount,
        note,
        currency: 'USD',
        claims: [],
        splits: splitRedPacketAmount(amount, safeCount),
        content: `[红包] $${formatTransferAmount(amount)} x ${safeCount}${note ? ` (${note})` : ''}`,
        replyTo: attachedReply,
        timestamp: Date.now()
    };
    chat.messages.push(msg);
    if (sender === 'user' && pendingReplyTo) cancelChatReply();
    chat.lastTime = Date.now();
    saveChatData();
    renderMessages();
    if (chat.type === 'group' && sender === 'user') scheduleRoleRedPacketClaims(msg.id);
}

function renderTransferCardBody(msg, isMe, role, chatUser) {
    const targetRole = msg.targetRoleId ? roles.find(r => r.id === msg.targetRoleId) : null;
    const name = isMe ? (targetRole || role ? (targetRole || role).name : '对方') : (targetRole ? targetRole.name : (chatUser ? chatUser.name : '你'));
    const label = isMe ? `转账给 ${name}` : `转账给 ${name}`;
    const note = msg.note ? `<div class="transfer-card-note">${escapeChatHTML(msg.note)}</div>` : '';
    return `
        <div class="transfer-card-label">${escapeChatHTML(label)}</div>
        <div class="transfer-card-amount">$${formatTransferAmount(msg.amount)}<span class="transfer-card-currency">USD</span></div>
        ${note}
    `;
}

function renderRedPacketCardBody(msg, isMe, role, chatUser) {
    const senderName = isMe ? (chatUser ? chatUser.name : '你') : (role ? role.name : '对方');
    const claims = msg.claims || [];
    const remain = Math.max(0, (msg.count || 0) - claims.length);
    const claimedByUser = claims.some(c => c.type === 'user');
    const claimLines = claims.map(c => `<div class="redpacket-claim-line">${escapeChatHTML(c.name)} 领取了 ${escapeChatHTML(senderName)} 的红包：$${formatTransferAmount(c.amount)}</div>`).join('');
    const canClaim = msg.sender !== 'user' && !claimedByUser && remain > 0;
    return `
        <div class="redpacket-head">红包</div>
        <div class="redpacket-note">${escapeChatHTML(msg.note || '恭喜发财，大吉大利')}</div>
        <div class="redpacket-meta">$${formatTransferAmount(msg.totalAmount)} USD · ${claims.length}/${msg.count} 已领</div>
        ${canClaim ? `<button type="button" class="redpacket-claim-btn" onclick="claimRedPacket('${escapeChatHTML(msg.id)}')">领取</button>` : ''}
        ${claimLines ? `<div class="redpacket-claims">${claimLines}</div>` : ''}
    `;
}

function formatTransferText(msg, role) {
    const targetRole = msg.targetRoleId ? roles.find(r => r.id === msg.targetRoleId) : null;
    const direction = msg.sender === 'user' ? `转账给${targetRole ? targetRole.name : (role ? role.name : '对方')}` : `转账给${targetRole ? targetRole.name : '你'}`;
    const note = msg.note ? `，备注：${msg.note}` : '';
    return `[${direction}] $${formatTransferAmount(msg.amount)} USD${note}`;
}

function formatRedPacketText(msg) {
    const note = msg.note ? `，留言：${msg.note}` : '';
    const claimed = (msg.claims || []).length;
    return `[红包] $${formatTransferAmount(msg.totalAmount)} USD，共${msg.count}个，已领${claimed}个${note}`;
}

function formatTransferAmount(amount) {
    const n = Number(amount) || 0;
    return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function isTransferCommand(text) {
    return /^\[转账(?:给@?[^\]]+)?\]\s*\$?\s*\d+(\.\d+)?/i.test(String(text || '').trim());
}

function parseTransferCommand(text) {
    const raw = String(text || '').trim();
    const match = raw.match(/^\[转账(?:给(@?[^\]]+))?\]\s*(\$?\s*)?(\d+(?:\.\d+)?)(?:\s*(?:USD|美元))?\s*(?:[|｜]\s*(.*))?$/i);
    if (!match) return { amount: 0, note: '' };
    let targetRoleId = (match[1] || '').trim();
    if (targetRoleId && !targetRoleId.startsWith('@')) targetRoleId = '@' + targetRoleId;
    return {
        targetRoleId,
        amount: Number(match[3]),
        note: (match[4] || '').trim()
    };
}

function isRedPacketCommand(text) {
    return /^\[红包\]\s*\$?\s*\d+(\.\d+)?/i.test(String(text || '').trim());
}

function parseRedPacketCommand(text) {
    const raw = String(text || '').trim();
    const match = raw.match(/^\[红包\]\s*(\$?\s*)?(\d+(?:\.\d+)?)(?:\s*(?:USD|美元))?\s*(?:x|×|\*)\s*(\d+)\s*(?:[|｜]\s*(.*))?$/i);
    if (!match) return { amount: 0, count: 1, note: '' };
    return {
        amount: Number(match[2]),
        count: Math.max(1, Math.floor(Number(match[3]) || 1)),
        note: (match[4] || '').trim()
    };
}

function splitRedPacketAmount(total, count) {
    const totalCents = Math.max(1, Math.round(Number(total) * 100));
    const safeCount = Math.max(1, Math.min(Math.floor(count || 1), totalCents));
    const cuts = [];
    for (let i = 0; i < safeCount - 1; i++) cuts.push(Math.floor(Math.random() * (totalCents - 1)) + 1);
    cuts.sort((a, b) => a - b);
    const points = [0, ...cuts, totalCents];
    return points.slice(1).map((p, i) => Math.max(1, p - points[i]) / 100);
}

function claimRedPacket(msgId, claimerRoleId = '', chatId = currentChatId) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    const msg = chat.messages.find(m => m.id === msgId && m.type === 'redpacket');
    if (!msg || (msg.claims || []).length >= msg.count) return;
    if (!Array.isArray(msg.claims)) msg.claims = [];
    if (!Array.isArray(msg.splits) || msg.splits.length === 0) msg.splits = splitRedPacketAmount(msg.totalAmount, msg.count);
    const type = claimerRoleId ? 'role' : 'user';
    if (msg.claims.some(c => c.type === type && (!claimerRoleId || c.roleId === claimerRoleId))) return;
    const role = claimerRoleId ? roles.find(r => r.id === claimerRoleId) : null;
    const chatUser = userProfiles[currentChatConfig.activeProfileIdx] || user;
    const amount = msg.splits[msg.claims.length] || 0.01;
    msg.claims.push({
        type,
        roleId: claimerRoleId,
        name: role ? role.name : (chatUser ? chatUser.name : '你'),
        amount,
        timestamp: Date.now()
    });
    saveChatData();
    renderMessages();
}

function scheduleRoleRedPacketClaims(msgId) {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat || chat.type !== 'group') return;
    const msg = chat.messages.find(m => m.id === msgId && m.type === 'redpacket');
    if (!msg) return;
    const candidates = getGroupMembers(chat).filter(r => r.id !== msg.roleId).sort(() => Math.random() - 0.5);
    const claimCount = Math.min(msg.count, candidates.length, Math.max(1, Math.floor(Math.random() * Math.min(3, msg.count)) + 1));
    const chatId = chat.id;
    candidates.slice(0, claimCount).forEach((role, idx) => {
        setTimeout(() => claimRedPacket(msgId, role.id, chatId), 900 + idx * 1200 + Math.random() * 800);
    });
}

function parseGroupAIMessage(text, chat) {
    const raw = String(text || '').trim();
    const match = raw.match(/^@@MSG:(.*?)@@([\s\S]*)$/);
    if (!match) {
        const fallback = getGroupMembers(chat)[0];
        const parsedReply = parseAIReplyPrefix(raw.replace(/^[-:：\s]+/, ''), chat);
        return fallback ? { roleId: fallback.id, content: parsedReply.content, replyTo: parsedReply.replyTo } : null;
    }
    let roleId = match[1].trim();
    if (!roleId.startsWith('@')) roleId = '@' + roleId.replace(/^@/, '');
    const allowed = getGroupMembers(chat).find(r => r.id === roleId);
    if (!allowed) return null;
    const parsedReply = parseAIReplyPrefix(match[2].trim(), chat);
    return { roleId, content: parsedReply.content, replyTo: parsedReply.replyTo };
}

function extractMentionIds(text, chat) {
    const members = getGroupMembers(chat);
    const source = String(text || '');
    return members.filter(r => source.includes(r.id) || source.includes('@' + r.name) || source.includes(r.name)).map(r => r.id);
}

function pickGroupSpeakers(members, mentionedIds = []) {
    const maxCount = Math.min(4, members.length);
    const mentioned = members.filter(r => mentionedIds.includes(r.id));
    const targetCount = pickGroupSpeakerCount(maxCount);
    const picked = mentioned.slice(0, maxCount);
    const rest = members.filter(r => !picked.some(p => p.id === r.id)).sort(() => Math.random() - 0.5);
    const finalCount = Math.max(Math.min(picked.length || targetCount, maxCount), targetCount);
    return picked.concat(rest).slice(0, finalCount);
}

function pickGroupSpeakerCount(maxCount) {
    if (maxCount <= 1) return 1;
    const roll = Math.random();
    if (roll < 0.28) return 1;
    if (roll < 0.62) return Math.min(2, maxCount);
    if (roll < 0.86) return Math.min(3, maxCount);
    return maxCount;
}

function escapeChatHTML(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function handleChatToSNS(authorRole, content) {
    const newPost = { uid: Date.now()+Math.random().toString(), author: authorRole, time: getTimestamp(), content: content, image: null, isFav: false, comments: [] };
    if(typeof posts !== 'undefined') {
        posts.unshift(newPost); saveAllData(); 
        alert(`✨ ${authorRole.name} 刚才把聊天灵感发到朋友圈了！`);
    }
}

// --- Auto Summary Logic ---
async function checkAutoSummary(chat, chatUser, role) {
    if(currentChatConfig.summaryOn !== "on") return;
    const interval = parseInt(currentChatConfig.summaryInterval) || 10;
    if(!chat.lastSummaryMsgCount) chat.lastSummaryMsgCount = 0;
    const newMsgsSinceLast = chat.messages.length - chat.lastSummaryMsgCount;
    if(newMsgsSinceLast >= interval * 2) performAutoSummary(chat, chatUser, role);
}

async function performAutoSummary(chat, chatUser, role) {
    document.getElementById('chat-title-status').innerText = "正在整理记忆…";
    const lookback = parseInt(currentChatConfig.summaryInterval) * 4;
    const textToSummarize = chat.messages.slice(-lookback).map(m => `${m.sender}: ${m.content}`).join("\n");
    const summary = await callAI([
        { role: "system", content: "You are a memory manager." },
        { role: "user", content: `Summarize chat history (max 100 words).\nCurrent Memory: ${currentChatConfig.summaryContent}\nNew Logs:\n${textToSummarize}\nOutput only the new summary text.` }
    ]);
    if(summary) {
        currentChatConfig.summaryContent = summary; chat.settings.summaryContent = summary; chat.lastSummaryMsgCount = chat.messages.length;
        document.getElementById('chat-summary-content').value = summary; saveChatData();
        document.getElementById('chat-title-status').innerText = "记忆已更新";
        setTimeout(() => { if(document.getElementById('chat-title-status').innerText==="记忆已更新") document.getElementById('chat-title-status').innerText=""; }, 2000);
    }
}
function saveChatSummaryManually() { updateChatSetting('summaryContent', document.getElementById('chat-summary-content').value); alert("记忆已手动保存"); }

// --- Sidebar & Settings ---
function toggleChatSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    const overlay = document.getElementById('chat-sidebar-overlay');
    const wbDropdown = document.getElementById('wb-dropdown-list');
    if(wbDropdown && !wbDropdown.classList.contains('hidden')) wbDropdown.classList.add('hidden');
    if(sidebar.classList.contains('open')) { sidebar.classList.remove('open'); overlay.classList.add('hidden'); } 
    else { sidebar.classList.add('open'); overlay.classList.remove('hidden'); }
}

function toggleWbDropdown() { document.getElementById('wb-dropdown-list').classList.toggle('hidden'); }
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('wb-dropdown-list');
    const trigger = document.querySelector('.select-box'); 
    if (dropdown && !dropdown.classList.contains('hidden')) {
        if (!dropdown.contains(event.target) && !trigger.contains(event.target)) dropdown.classList.add('hidden');
    }
});

function initSidebarValues() {
    const chat = chats.find(c => c.id === currentChatId);
    const userSelect = document.getElementById('chat-user-select');
    userSelect.innerHTML = "";
    userProfiles.forEach((p, idx) => {
        const opt = document.createElement('option');
        opt.value = idx; opt.innerText = p.profileName;
        if(idx == currentChatConfig.activeProfileIdx) opt.selected = true;
        userSelect.appendChild(opt);
    });
    userSelect.onchange = (e) => updateChatSetting('activeProfileIdx', e.target.value);

    const wbDropdownContainer = document.getElementById('wb-dropdown-list');
    wbDropdownContainer.innerHTML = ""; 
    let selectedCount = 0;
    if(typeof globalWorldBooks !== 'undefined') {
        globalWorldBooks.forEach((wb, idx) => {
            if(wb.isEnabled !== false) {
                const isChecked = currentChatConfig.activeWorldBookIndices.includes(idx);
                if(isChecked) selectedCount++;
                const div = document.createElement('div');
                div.style = 'padding:8px 10px; border-bottom:1px solid #f0f0f0; display:flex; align-items:center;';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox'; checkbox.checked = isChecked; checkbox.style = 'margin-right:10px; transform:scale(1.2);';
                checkbox.onchange = (e) => toggleWorldBookSelection(idx, e.target.checked);
                const label = document.createElement('span');
                label.innerText = `条目 #${idx+1}: ${wb.content.substring(0,15)}...`;
                label.style = 'font-size:0.9rem; flex:1; cursor:pointer;';
                label.onclick = () => checkbox.click();
                div.appendChild(checkbox); div.appendChild(label); wbDropdownContainer.appendChild(div);
            }
        });
    }
    updateWbTriggerText(selectedCount);

    document.getElementById('chat-bg-input').value = currentChatConfig.bg;
    document.getElementById('chat-reply-language').value = currentChatConfig.replyLanguage || "zh";
    document.getElementById('chat-reply-language').onchange = (e) => updateChatSetting('replyLanguage', e.target.value);
    document.getElementById('chat-history-limit').value = currentChatConfig.historyLimit;
    document.getElementById('chat-history-limit').onchange = (e) => updateChatSetting('historyLimit', e.target.value);
    document.getElementById('chat-summary-toggle').onchange = (e) => updateChatSetting('summaryOn', e.target.value);
    document.getElementById('chat-summary-interval').onchange = (e) => updateChatSetting('summaryInterval', e.target.value);
    renderGroupSidebar(chat);
}

function updateWbTriggerText(count) {
    const textSpan = document.getElementById('wb-selected-text');
    textSpan.innerText = count === 0 ? "未选择世界书" : `已启用 ${count} 个条目`;
}

function toggleWorldBookSelection(idx, isChecked) {
    let indices = currentChatConfig.activeWorldBookIndices;
    if (isChecked) { if (!indices.includes(idx)) indices.push(idx); } 
    else { indices = indices.filter(i => i !== idx); }
    updateChatSetting('activeWorldBookIndices', indices);
    updateWbTriggerText(indices.length);
}

function updateChatSetting(key, value) {
    const chat = chats.find(c => c.id === currentChatId);
    if(!chat) return;
    if(key === 'activeProfileIdx' || key === 'historyLimit' || key === 'summaryInterval') value = parseInt(value);
    currentChatConfig[key] = value;
    if(key === 'activeWorldBookIndices') { chat.settings.wbIndices = value; chat.settings.wbIdx = "off"; }
    else if(key === 'activeProfileIdx') chat.settings.profileIdx = value;
    else chat.settings[key] = value;
    saveChatData();
    if(key === 'activeProfileIdx') { initSidebarValues(); renderMessages(); }
}

function saveChatBg() {
    const url = document.getElementById('chat-bg-input').value;
    updateChatSetting('bg', url);
    document.getElementById('chat-msg-container').style.backgroundImage = `url('${url}')`;
}

function renderGroupSidebar(chat) {
    const section = document.getElementById('group-sidebar-section');
    if (!section || !chat || chat.type !== 'group') return;
    document.getElementById('group-name-input').value = chat.name || buildGroupName(chat.memberRoleIds);
    const list = document.getElementById('group-member-list');
    list.innerHTML = "";
    getGroupMembers(chat).forEach(role => {
        const item = document.createElement('div');
        item.className = 'group-member-item';
        item.innerHTML = `
            <img src="${escapeChatHTML(role.avatar || '')}">
            <span>${escapeChatHTML(role.name || role.id)}</span>
            <button onclick="removeGroupMember('${escapeChatHTML(role.id)}')">踢出</button>
        `;
        list.appendChild(item);
    });

    const addSelect = document.getElementById('group-add-member-select');
    addSelect.innerHTML = "";
    roles.forEach(role => {
        if (role.isEnabled === false || chat.memberRoleIds.includes(role.id)) return;
        const opt = document.createElement('option');
        opt.value = role.id;
        opt.innerText = role.name;
        addSelect.appendChild(opt);
    });
}

function saveGroupName(name) {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat || chat.type !== 'group') return;
    chat.name = name.trim() || buildGroupName(chat.memberRoleIds);
    saveChatData();
    document.getElementById('chat-title-name').innerText = chat.name;
    renderChatList();
}

function addGroupMember() {
    const chat = chats.find(c => c.id === currentChatId);
    const select = document.getElementById('group-add-member-select');
    if (!chat || chat.type !== 'group' || !select.value) return;
    if (!chat.memberRoleIds.includes(select.value)) chat.memberRoleIds.push(select.value);
    if (!chat.name) chat.name = buildGroupName(chat.memberRoleIds);
    saveChatData();
    initSidebarValues();
    document.getElementById('chat-title-name').innerText = chat.name || buildGroupName(chat.memberRoleIds);
}

function removeGroupMember(roleId) {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat || chat.type !== 'group') return;
    if (chat.memberRoleIds.length <= 2) {
        alert('群聊至少保留 2 个成员');
        return;
    }
    chat.memberRoleIds = chat.memberRoleIds.filter(id => id !== roleId);
    saveChatData();
    initSidebarValues();
}

function openMentionModal() {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat || chat.type !== 'group') return;
    const list = document.getElementById('mention-role-list');
    list.innerHTML = "";
    getGroupMembers(chat).forEach(role => {
        const item = document.createElement('div');
        item.className = 'mention-role-option';
        item.onclick = () => insertMention(role);
        item.innerHTML = `
            <img src="${escapeChatHTML(role.avatar || '')}">
            <span>${escapeChatHTML(role.name || role.id)}</span>
        `;
        list.appendChild(item);
    });
    document.getElementById('mention-modal').classList.remove('hidden');
}

function closeMentionModal() {
    document.getElementById('mention-modal').classList.add('hidden');
}

function insertMention(role) {
    const input = document.getElementById('chat-input');
    const mention = `@${role.name} `;
    const start = input.selectionStart || input.value.length;
    const end = input.selectionEnd || input.value.length;
    input.value = input.value.slice(0, start) + mention + input.value.slice(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + mention.length;
    autoResizeInput(input);
    closeMentionModal();
}

function clearChatHistory() {
    if(!confirm("确定清空当前对话记录？无法恢复。")) return;
    const chat = chats.find(c => c.id === currentChatId);
    (chat.messages || []).forEach(msg => {
        if (msg.type === 'image' && msg.imageId) deleteChatImageData(msg.imageId);
    });
    chat.messages = []; chat.lastSummaryMsgCount = 0; saveChatData(); renderMessages(); toggleChatSidebar();
}

// --- Sticker System ---
function toggleStickerPanel(event) {
    if(event) event.stopPropagation();
    const panel = document.getElementById('sticker-panel');
    if(panel.classList.contains('hidden')) { panel.classList.remove('hidden'); renderStickerGrid(); } 
    else { panel.classList.add('hidden'); }
}

function renderStickerGrid() {
    const grid = document.getElementById('sticker-grid');
    grid.innerHTML = "";
    stickers.forEach((s, index) => {
        const img = document.createElement('img');
        img.className = "sticker-option"; img.src = s.src;
        img.onclick = () => sendSticker(s);
        let pressTimer;
        img.ontouchstart = () => { pressTimer = setTimeout(() => { openStickerMenu(index); if(navigator.vibrate) navigator.vibrate(50); }, 600); };
        img.ontouchend = () => clearTimeout(pressTimer);
        img.onmousedown = () => { pressTimer = setTimeout(() => openStickerMenu(index), 600); };
        img.onmouseup = () => clearTimeout(pressTimer);
        grid.appendChild(img);
    });
}

function openStickerMenu(index) { targetStickerIndex = index; document.getElementById('sticker-menu-modal').classList.remove('hidden'); }
function closeStickerMenu() { targetStickerIndex = -1; document.getElementById('sticker-menu-modal').classList.add('hidden'); }
function confirmDeleteSticker() { if (targetStickerIndex === -1) return; stickers.splice(targetStickerIndex, 1); saveChatData(); renderStickerGrid(); closeStickerMenu(); }

async function handleStickerUpload(input) {
    const file = input.files[0]; if(!file) return;
    try {
        tempStickerFile = await compressImageFile(file, { maxSize: 360, quality: 0.78 });
        document.getElementById('sticker-preview-img').src = tempStickerFile;
        document.getElementById('sticker-desc-input').value = "";
        document.getElementById('sticker-desc-modal').classList.remove('hidden');
    } catch (err) {
        console.error('表情包处理失败', err);
        alert('表情包处理失败，请换一张试试');
    }
    input.value = "";
}

function confirmStickerUpload() {
    const desc = document.getElementById('sticker-desc-input').value || "表情包";
    if(!tempStickerFile) return;
    stickers.push({ src: tempStickerFile, desc: desc }); saveChatData();
    document.getElementById('sticker-desc-modal').classList.add('hidden'); renderStickerGrid();
}

function sendSticker(stickerObj) {
    appendMessage('user', stickerObj.src, 'sticker', stickerObj.desc);
    document.getElementById('sticker-panel').classList.add('hidden');
}

function formatTimeShort(ts) {
    if(!ts) return "";
    const date = new Date(ts);
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2,'0')}`;
}

document.addEventListener('click', (e) => {
    const panel = document.getElementById('sticker-panel');
    const btn = document.getElementById('sticker-toggle-btn');
    if (!panel.classList.contains('hidden')) {
        if (!panel.contains(e.target) && e.target !== btn) panel.classList.add('hidden');
    }
});
