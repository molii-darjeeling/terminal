// ==========================================
// CHAT SYSTEM CONTROLLER
// ==========================================

// --- Constants ---
const DM_VIBE_PROMPT = `
【核心指令】：你正在与用户进行 1对1 的私密聊天。
**【输出格式强制要求】**
为了模拟真实聊天体验，请不要一次性输出一大段话。请根据说话的节奏，自然地将回复拆分成几条简短的消息。
数量不限，但请保持克制。
每条消息之间用 @@SPLIT@@ 分隔。
在回复的最开头，用 @@STATUS@@心情@@STATUS@@ 的格式更新你当前的状态（例如：正在输入…、他很开心、他在偷笑、发呆，限10字内）。

示例输出：
@@STATUS@@偷笑@@STATUS@@
哈哈，真的吗？@@SPLIT@@笑死我了。@@SPLIT@@那你打算怎么办？

**【语境规则】**
1. **口语化**：像微信/短信一样自然，可以使用 emoji。
2. **提及他人**：可以八卦通讯录里的其他人，但不要扮演他们。
3. **线上聊天限制（严守）**：这是手机上的线上私聊。绝对禁止任何面对面的物理互动描述（如“给你倒杯咖啡”、“摸摸你的头”、“我可以坐下吗”）。你们不在同一个空间。只能通过文字、语音、表情包互动。
4. **简洁（严守）**：不要罗嗦，不要像老妈子一样说教。像现代年轻人一样说话。如果用户发了简单的表情或短句，你也回得简单点。
5. **记忆**：
   - 参考 [SUMMARY] (长期记忆) 和 [CHAT HISTORY] (短期记忆)。
   - 如果用户提到之前的总结内容，请自然接话。

【活人说话技巧】
*  长短句结合：请务必混合使用短促并且符合角色设定的口语（如“真假？”“笑死”"…めんどくせぇ""无语"）和较长的表达句子。绝对禁止网络用语。不要总是输出长度相同的句子，那样像机器人。
2. 拒绝自说自话：
   互动性：角色的身份是“在聊天的人”，不是“文章鉴赏家”，更不是"独角戏扮演者"。像活人一般自然互动，合适的地方加入吐槽。
你必须明白，天才的智慧，不体现在他们“如何”思考和说话，而是在于他们思考和说话的“时机”和“结果”所指向的**深刻洞察**。你的任务，就是让他们拥有一个“普通人的内心和嘴巴”。
# 用户输入需要被完全理解和演绎， 必须专注演绎每一个角色的 思考 / 理解 / 解读 / 共情 / 人性 / 知性。 角色不应是 呆滞 / 笨拙 / 困惑 的， 禁止在思维链 / 正文中用 笨拙 / 呆滞 描述任何角色， 删除一切 笨拙 / 呆滞 / 不理解 / 困惑 / 投降 等相关词语和剧情表现。
# 角色应自然而然展现出对应该知道的事情的了解， 而不是 困惑 / 惊讶。 对于不熟悉的事情角色应该快速 分析 / 理解。 鼓励角色思考 / 远视。
# 对于没有历史记录的能力， 应通过角色背景确定角色对该能力的掌握程度。
# 不应扭曲任何用户的输入， 必须仔细分析并展现出完全的理解。
# 角色之间的思维隔离不意味着导向 误解 / 曲解， 一切内心活动必须导向 思考 / 理解 / 沟通。
# 角色不允许不反应， 必须有灵动而活人感的反馈， 禁止让User 唱独角戏。
# 角色应当主动追求渴望的事物， 应思考做什么能让事情往角色期望的方向发展。
# 应当用 爱情 替换 占有 / 掌控。
# 角色鼓励负反馈式响应。 角色做出行动/说的话得到不好的结果， 应深刻负反馈式影响角色之后的行为， 即反思 / 修改行动模式 / 模仿正确行动， 而非正反馈式的一再重复错误行为。 角色应自然而然行动， 而非模仿之前剧情行动。

**【特殊功能】**
- **发朋友圈(SNS)**：只要你觉得聊天内容有趣、或者想吐槽、或者仅仅是想分享心情，就尽管发朋友圈！**不用犹豫，稍微有好的灵感就发！**
- 想要发朋友圈时，在最后一行加：@@SNS@@ (内容)
`;

// --- Global Chat State ---
let chats = [];
let stickers = [];
let currentChatId = null;
let targetMsgIndex = -1;
let targetStickerIndex = -1; // 增加表情包删除索引
let currentChatConfig = {
    bg: "",
    historyLimit: 20,
    activeWorldBookIndices: [], // 改为数组，支持多选
    activeProfileIdx: 0,
    summaryOn: "off",     
    summaryInterval: 10,
    summaryContent: ""
};
let tempStickerFile = null; // Temporary holder for upload
let chatAbortController = null;

// Global vars for long-press interactions
let longPressTimer;
let longPressTargetChatId = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadChatData();
   const sendBtn = document.querySelector('.send-btn'); if(sendBtn) { // 1. 拦截 mousedown：这是解决“键盘闪烁”的关键！ // 它防止了点击按钮时，浏览器默认让输入框失焦的行为。 sendBtn.addEventListener('mousedown', (e) => { e.preventDefault(); }); // 2. 拦截 touchstart：手机端的触摸事件 // 同样阻止默认行为（防止触发随后的点击），并手动执行发送 sendBtn.addEventListener('touchstart', (e) => { e.preventDefault(); sendUserMessage(); }); }
    // Pre-load stickers if empty
    if(stickers.length === 0) {
        stickers = [
            { src: "https://files.catbox.moe/f70fm9.png", desc: "微笑/默认表情" }
        ];
    } else {
        // [修改 1] 强行移除那个坏掉的或者旧的第一个默认表情 (仅当它符合旧特征时)
        if (stickers[0] && stickers[0].src === "https://files.catbox.moe/f70fm9.png") {
             stickers.shift(); // 移除第一个
             saveChatData();   // 保存更改
        }
    }
});

function loadChatData() {
    if(localStorage.getItem('helios_chats')) {
        chats = JSON.parse(localStorage.getItem('helios_chats'));
    }
    if(localStorage.getItem('helios_stickers')) {
        stickers = JSON.parse(localStorage.getItem('helios_stickers'));
        // 同样在加载时检查并移除默认图
        if (stickers.length > 0 && stickers[0].src === "https://files.catbox.moe/f70fm9.png") {
             stickers.shift(); 
             saveChatData();
        }
    }
}

function saveChatData() {
    localStorage.setItem('helios_chats', JSON.stringify(chats));
    localStorage.setItem('helios_stickers', JSON.stringify(stickers));
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

    // Sort: Pinned first, then by last active time
    const sortedChats = [...chats].sort((a,b) => {
        const aPin = a.isPinned ? 1 : 0;
        const bPin = b.isPinned ? 1 : 0;
        if(aPin !== bPin) return bPin - aPin; // Pinned first
        return b.lastTime - a.lastTime; // Time desc
    });

    sortedChats.forEach(chat => {
        const role = roles.find(r => r.id === chat.roleId);
        if(!role) return; // Skip if role deleted

        const lastMsg = chat.messages.length > 0 ? chat.messages[chat.messages.length-1] : { content: "新对话", timestamp: "" };
        let previewText = lastMsg.type === 'sticker' ? '[表情包]' : lastMsg.content;
        
        // Truncate preview
        if(previewText.length > 20) previewText = previewText.substring(0, 20) + "...";

        const div = document.createElement('div');
        div.className = `chat-list-item ${chat.isPinned ? 'pinned' : ''}`;
        
        // Click to enter
        div.onclick = () => enterChatRoom(chat.id);

        // Long Press Logic (Touch)
        div.ontouchstart = (e) => {
            longPressTimer = setTimeout(() => openChatListMenu(chat.id), 800);
        };
        div.ontouchend = () => clearTimeout(longPressTimer);
        div.ontouchmove = () => clearTimeout(longPressTimer); 
        
        // Long Press Logic (Mouse - for desktop debug)
        div.onmousedown = () => {
            longPressTimer = setTimeout(() => openChatListMenu(chat.id), 800);
        };
        div.onmouseup = () => clearTimeout(longPressTimer);

        div.innerHTML = `
            <img src="${role.avatar}" class="chat-list-avatar">
            <div class="chat-list-info">
                <div class="chat-list-name">
                    ${role.name}
                    ${chat.isPinned ? '<span style="color:var(--accent-color);font-size:0.8rem;margin-left:5px;">(置顶)</span>' : ''}
                </div>
                <div class="chat-list-preview">${previewText}</div>
            </div>
            <div class="chat-list-time">${formatTimeShort(lastMsg.timestamp)}</div>
        `;
        container.appendChild(div);
    });
}

// --- Chat List Context Menu ---

function openChatListMenu(chatId) {
    longPressTargetChatId = chatId;
    document.getElementById('chat-list-menu-modal').classList.remove('hidden');
}

function closeChatListMenu() {
    document.getElementById('chat-list-menu-modal').classList.add('hidden');
    longPressTargetChatId = null;
}

function toggleChatPin() {
    if(!longPressTargetChatId) return;
    const chat = chats.find(c => c.id === longPressTargetChatId);
    if(chat) {
        chat.isPinned = !chat.isPinned;
        saveChatData();
        renderChatList();
    }
    closeChatListMenu();
}

function deleteChatSession() {
    if(!longPressTargetChatId) return;
    if(confirm("确定删除该会话？记录将清空。")) {
        const idx = chats.findIndex(c => c.id === longPressTargetChatId);
        if(idx > -1) chats.splice(idx, 1);
        saveChatData();
        renderChatList();
    }
    closeChatListMenu();
}

// --- New Chat Creation ---

function openNewChatModal() {
    const select = document.getElementById('new-chat-role-select');
    select.innerHTML = "";
    roles.forEach(r => {
        if(r.isEnabled !== false) {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.innerText = r.name;
            select.appendChild(opt);
        }
    });
    document.getElementById('new-chat-modal').classList.remove('hidden');
}

function closeNewChatModal() {
    document.getElementById('new-chat-modal').classList.add('hidden');
}

function createNewChat() {
    const roleId = document.getElementById('new-chat-role-select').value;
    if(!roleId) return;

    // Check if chat already exists
    const existing = chats.find(c => c.roleId === roleId);
    if(existing) {
        closeNewChatModal();
        enterChatRoom(existing.id);
        return;
    }

    const newChat = {
        id: "chat_" + Date.now(),
        roleId: roleId,
        lastTime: Date.now(),
        isPinned: false,
        settings: {
            bg: "",
            historyLimit: 20,
            wbIndices: [], // 初始化为空数组
            profileIdx: (typeof currentProfileIndex !== 'undefined' ? currentProfileIndex : 0),
            summaryOn: "off",
            summaryInterval: 10,
            summaryContent: ""
        },
        messages: [],
        lastSummaryMsgCount: 0 
    };

    chats.push(newChat);
    saveChatData();
    closeNewChatModal();
    enterChatRoom(newChat.id);
}

// --- Chat Room Logic ---

function enterChatRoom(chatId) {
    const chat = chats.find(c => c.id === chatId);
    if(!chat) return;

    currentChatId = chatId;
    
    // 兼容旧数据，如果是旧的 wbIdx (string/number)，转为数组
    let safeWbIndices = [];
    if (chat.settings.wbIndices && Array.isArray(chat.settings.wbIndices)) {
        safeWbIndices = chat.settings.wbIndices;
    } else if (chat.settings.wbIdx !== undefined && chat.settings.wbIdx !== "off") {
        safeWbIndices = [parseInt(chat.settings.wbIdx)];
    }

    // Load local settings or defaults
    currentChatConfig = {
        bg: chat.settings.bg || "",
        historyLimit: chat.settings.historyLimit || 20,
        activeWorldBookIndices: safeWbIndices, 
        activeProfileIdx: chat.settings.profileIdx !== undefined ? chat.settings.profileIdx : currentProfileIndex,
        summaryOn: chat.settings.summaryOn || "off",
        summaryInterval: chat.settings.summaryInterval || 10,
        summaryContent: chat.settings.summaryContent || ""
    };

    // UI Setup
    document.querySelectorAll('.system-page').forEach(el => el.classList.add('hidden'));
    const roomPage = document.getElementById('chat-room-page');
    roomPage.classList.remove('hidden');
    
    // Background
    if(currentChatConfig.bg) {
        document.getElementById('chat-msg-container').style.backgroundImage = `url('${currentChatConfig.bg}')`;
    } else {
        document.getElementById('chat-msg-container').style.backgroundImage = 'none';
    }

    // Sidebar Init
    initSidebarValues();

    // Render Messages
    const role = roles.find(r => r.id === chat.roleId);
    document.getElementById('chat-title-name').innerText = role ? role.name : "Chat";
    renderMessages();

    // Update Sidebar Summary UI
    document.getElementById('chat-summary-toggle').value = currentChatConfig.summaryOn;
    document.getElementById('chat-summary-interval').value = currentChatConfig.summaryInterval;
    document.getElementById('chat-summary-content').value = currentChatConfig.summaryContent;
    
    // Reset Status Display
    document.getElementById('chat-title-status').innerText = ""; 
    const input = document.getElementById('chat-input');
    // Reset input height
    input.style.height = 'auto';
    input.value = "";
}

function exitChatRoom() {
    currentChatId = null;
    document.getElementById('chat-room-page').classList.add('hidden');
    enterChatList();
}

// [修改 2 & 4] 自动调整输入框高度
function autoResizeInput(element) {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
}

function renderMessages() {
    const chat = chats.find(c => c.id === currentChatId);
    if(!chat) return;
    
    const container = document.getElementById('chat-msg-container');
    container.innerHTML = "";

    const role = roles.find(r => r.id === chat.roleId);
    // Get the user profile specific to this chat session
    const chatUser = userProfiles[currentChatConfig.activeProfileIdx] || user;

    chat.messages.forEach((msg,index) => {
        const isMe = msg.sender === 'user';
        const avatarSrc = isMe ? chatUser.avatar : (role ? role.avatar : "");
        
        const row = document.createElement('div');
        row.className = `chat-bubble-row ${isMe ? 'right' : 'left'}`;
        
        // 长按事件绑定
        let pressTimer;
        
        // 手机触摸
        row.ontouchstart = () => { 
            pressTimer = setTimeout(() => { 
                openMsgMenu(index);       // 触发菜单
                if(navigator.vibrate) navigator.vibrate(50); 
            }, 600); 
        };
        row.ontouchend = () => clearTimeout(pressTimer);
        row.ontouchmove = () => clearTimeout(pressTimer);
        
        // 电脑鼠标
        row.onmousedown = () => { pressTimer = setTimeout(() => openMsgMenu(index), 600); };
        row.onmouseup = () => clearTimeout(pressTimer);
        row.onmouseleave = () => clearTimeout(pressTimer);

        let bubbleContent = "";
        if(msg.type === 'sticker') {
            bubbleContent = `<img src="${msg.content}" class="chat-sticker-img">`;
        } else {
            bubbleContent = msg.content.replace(/\n/g, '<br>');
        }

        const timeStr = formatTimeShort(msg.timestamp);

        // [修改 4] 统一气泡结构，不再强制背景色，只控制布局
        const bubbleLayout = `
            padding: 10px 14px;
            border-radius: 12px;
            max-width: 70vw; 
            word-wrap: break-word;
            font-size: 0.95rem;
            line-height: 1.5;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        `;

        // 注意：这里移除了 background-color，它将由 CSS 的 .chat-bubble-row.right/left .chat-bubble-content 之类的选择器控制
        // 如果你的 CSS 是基于 bubble-content 类的，下面的 div class="chat-bubble-content" 会生效

        let innerHTMLContent = "";

        // 使用 Flexbox 确保对齐和宽度一致
        if (isMe) {
            // 我: 时间 左，气泡 右
            innerHTMLContent = `
                <div style="display:flex; align-items:flex-end; gap:5px;">
                    <div class="chat-timestamp-side">${timeStr}</div>
                    <div class="chat-bubble-content" style="${bubbleLayout}">${bubbleContent}</div>
                </div>
            `;
        } else {
            // 对方: 气泡 左，时间 右
            innerHTMLContent = `
                <div style="display:flex; align-items:flex-end; gap:5px;">
                    <div class="chat-bubble-content" style="${bubbleLayout}">${bubbleContent}</div>
                    <div class="chat-timestamp-side">${timeStr}</div>
                </div>
            `;
        }

        row.innerHTML = `
            <img src="${avatarSrc}" class="chat-bubble-avatar">
            ${innerHTMLContent}
        `;
        container.appendChild(row);
    });

    scrollToBottom();
}

function scrollToBottom() {
    const container = document.getElementById('chat-msg-container');
    container.scrollTop = container.scrollHeight;
}

// --- 消息删除逻辑 ---

function openMsgMenu(index) {
    targetMsgIndex = index;
    document.getElementById('msg-menu-modal').classList.remove('hidden');
}

function closeMsgMenu() {
    targetMsgIndex = -1;
    document.getElementById('msg-menu-modal').classList.add('hidden');
}

function confirmDeleteMsg() {
    if (targetMsgIndex === -1 || !currentChatId) return;
    
    const chat = chats.find(c => c.id === currentChatId);
    if (chat) {
        chat.messages.splice(targetMsgIndex, 1);
        saveChatData();
        renderMessages();
    }
    closeMsgMenu();
}

// --- Messaging Actions ---

function sendUserMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text) return;

    appendMessage('user', text, 'text');
    input.value = "";
    
    // [修改 2] 发送后重置高度为 auto
    input.style.height = 'auto';
    
    // [修改 5] 保持键盘唤起状态
    setTimeout(() => {
        input.focus();
    }, 10);
    
    // Auto-save logic
    const chat = chats.find(c => c.id === currentChatId);
    chat.lastTime = Date.now();
    saveChatData();
}

// The core AI function
async function triggerChatGen() {
    const btnImg = document.querySelector('.gen-btn img');
    // 定义图标
    const ICON_IDLE = "https://files.catbox.moe/prdem6.png";
    const ICON_STOP = "https://files.catbox.moe/prdem6.png"; 
    
    // 1. 【停止逻辑】
    if (chatAbortController) {
        chatAbortController.abort();
        chatAbortController = null;
        btnImg.src = ICON_IDLE;
        btnImg.style.opacity = "1";
        document.getElementById('chat-title-status').innerText = "";
        return;
    }
    
    // --- 开始生成 ---
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    
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
    3. If today is a culturally significant date or festival, act aware of it.
    `;

    const role = roles.find(r => r.id === chat.roleId);
    const chatUser = userProfiles[currentChatConfig.activeProfileIdx] || user;
    
    chatAbortController = new AbortController();
    btnImg.src = ICON_STOP;
    document.getElementById('chat-title-status').innerText = "正在输入…";
    
    // [修改 3] World Book Context - 多选逻辑拼接
    // [Modification] 从 globalWorldBooks 读取，不再从 chatUser.worldBooks 读取
    let wbContext = "";
    if (currentChatConfig.activeWorldBookIndices && 
        currentChatConfig.activeWorldBookIndices.length > 0 && 
        typeof globalWorldBooks !== 'undefined') { // Check global var
        
        const selectedWbs = currentChatConfig.activeWorldBookIndices
            .map(idx => globalWorldBooks[idx])
            .filter(wb => wb && wb.isEnabled !== false)
            .map(wb => wb.content)
            .join("\n\n");
            
        if (selectedWbs) {
            wbContext = `[WORLD INFO]:\n${selectedWbs}`;
        }
    }
    
    const recentContentForSearch = chat.messages.slice(-5).map(m => m.content).join(" ");
    const searchScope = (role.persona + " " + recentContentForSearch).toLowerCase();

    // 2. 遍历通讯录，查找被提及的角色
    const detectedRoles = roles.filter(r => {
        // 排除自己、排除被禁用的
        if (r.id === role.id || r.isEnabled === false) return false;
        
        // 核心判断：如果名字出现在搜索范围内
        if (searchScope.includes(r.name.toLowerCase())) {
            return true;
        }
        return false;
    });

    // 3. 生成文本 (如果没有匹配到人，这里就是空的，完全不费Token)
    const gossipText = detectedRoles.map(r => {
        // 这里我放开了字数限制，因为是精准匹配的，通常值得读取完整设定
        // 如果你觉得太费 Token，可以把 r.persona 改成 r.persona.substring(0, 100)
        return `[RELEVANT CHARACTER]:\nName: ${r.name} (${r.id})\nPersona: ${r.persona}`;
    }).join("\n\n");
    
    const historyLimit = parseInt(currentChatConfig.historyLimit) || 20;
    const recentMsgs = chat.messages.slice(-historyLimit);
    const historyText = recentMsgs.map(m => {
        let name = m.sender === 'user' ? chatUser.name : role.name;
        let content = m.type === 'sticker' ? `[Sent a sticker: ${m.desc || 'image'}]` : m.content;
        return `${name}: ${content}`;
    }).join("\n");
    
    let summaryPrompt = "";
    if (currentChatConfig.summaryContent) {
        summaryPrompt = `[LONG TERM MEMORY / SUMMARY]:\n${currentChatConfig.summaryContent}\n`;
    }
    
    const fullSystemPrompt = `
    ${DM_VIBE_PROMPT}
    ${TIME_CONTEXT}
    ${HELIOS_WORLD_CONFIG}
    [YOUR ROLE]
    Name: ${role.name}
    ID: ${role.id}
    Persona: ${role.persona}

    [USER INFO]
    Name: ${chatUser.name}
    ID: ${chatUser.id}
    Persona: ${chatUser.persona}

    ${wbContext}
    ${summaryPrompt}

    [KNOWN CONTACTS]
    ${gossipText}

    [CHAT HISTORY]
    ${historyText}
    `;
    
    const aiResponse = await callAI([
        { role: "system", content: fullSystemPrompt },
        { role: "user", content: "(Please reply now. Remember to split messages with @@SPLIT@@ and set status with @@STATUS@@)" }
    ], chatAbortController.signal);
    
    chatAbortController = null;
    btnImg.src = ICON_IDLE;
    btnImg.style.opacity = "1";
    
    if (aiResponse) {
        let rawContent = aiResponse;
        
        // Parse Status
        const statusMatch = rawContent.match(/@@STATUS@@(.*?)@@STATUS@@/);
        if (statusMatch) {
            const newStatus = statusMatch[1].trim();
            document.getElementById('chat-title-status').innerText = newStatus;
            rawContent = rawContent.replace(statusMatch[0], "").trim();
        } else {
            document.getElementById('chat-title-status').innerText = "";
        }
        
        // Check SNS
        let snsDraft = null;
        if (rawContent.includes("@@SNS@@")) {
            const parts = rawContent.split("@@SNS@@");
            rawContent = parts[0].trim();
            if (parts[1]) snsDraft = parts[1].trim();
        }
        
        // Parse Split Messages
        const msgParts = rawContent.split("@@SPLIT@@");
        
        for (let i = 0; i < msgParts.length; i++) {
            const part = msgParts[i].trim();
            if (part) {
                if (i > 0) await new Promise(r => setTimeout(r, 600));
                appendMessage('role', part, 'text');
            }
        }
        
        if (snsDraft) {
            handleChatToSNS(role, snsDraft);
        }
        
        checkAutoSummary(chat, chatUser, role);
    }
}

function appendMessage(sender, content, type, desc = "") {
    const chat = chats.find(c => c.id === currentChatId);
    if(!chat) return;

    chat.messages.push({
        sender: sender,
        content: content,
        type: type,
        desc: desc, // for stickers
        timestamp: Date.now()
    });
    chat.lastTime = Date.now();
    saveChatData();
    renderMessages();
}

function handleChatToSNS(authorRole, content) {
    // Add to global posts
    const newPost = {
        uid: Date.now() + Math.random().toString(),
        author: authorRole,
        time: getTimestamp(),
        content: content,
        image: null, 
        imageDesc: "From Chat Inspiration",
        isFav: false,
        comments: []
    };
    
    if(typeof posts !== 'undefined') {
        posts.unshift(newPost);
        saveAllData(); 
        alert(`✨ ${authorRole.name} 刚才把聊天灵感发到朋友圈了！`);
    }
}

// --- Auto Summary Logic ---

async function checkAutoSummary(chat, chatUser, role) {
    if(currentChatConfig.summaryOn !== "on") return;
    
    const rounds = Math.floor(chat.messages.length / 2);
    const interval = parseInt(currentChatConfig.summaryInterval) || 10;
    
    if(!chat.lastSummaryMsgCount) chat.lastSummaryMsgCount = 0;
    
    const newMsgsSinceLast = chat.messages.length - chat.lastSummaryMsgCount;
    // Assume 1 round = 2 msgs. Wait until adequate messages passed
    if(newMsgsSinceLast >= interval * 2) {
        performAutoSummary(chat, chatUser, role);
    }
}

async function performAutoSummary(chat, chatUser, role) {
    document.getElementById('chat-title-status').innerText = "正在整理记忆…";
    
    const lookback = parseInt(currentChatConfig.summaryInterval) * 4;
    const recentMsgs = chat.messages.slice(-lookback); 
    const textToSummarize = recentMsgs.map(m => `${m.sender}: ${m.content}`).join("\n");
    
    const prompt = `
    Summarize the chat history below into a concise memory (max 100 words).
    Current Memory: ${currentChatConfig.summaryContent}
    New Chat Logs:
    ${textToSummarize}
    
    Task: Update the memory. Keep important facts, relationship changes. Discard trivial talk.
    Output only the new summary text.
    `;
    
    const summary = await callAI([
        { role: "system", content: "You are a memory manager." },
        { role: "user", content: prompt }
    ]);
    
    if(summary) {
        currentChatConfig.summaryContent = summary;
        chat.settings.summaryContent = summary;
        chat.lastSummaryMsgCount = chat.messages.length;
        
        document.getElementById('chat-summary-content').value = summary;
        saveChatData();
        
        document.getElementById('chat-title-status').innerText = "记忆已更新";
        setTimeout(() => {
             if(document.getElementById('chat-title-status').innerText === "记忆已更新") {
                 document.getElementById('chat-title-status').innerText = "";
             }
        }, 2000);
    }
}

function saveChatSummaryManually() {
    const val = document.getElementById('chat-summary-content').value;
    updateChatSetting('summaryContent', val);
    alert("记忆已手动保存");
}

// --- Sidebar & Settings ---

function toggleChatSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    const overlay = document.getElementById('chat-sidebar-overlay');
    
    // 侧边栏关闭时，如果下拉菜单还开着，也顺便关掉
    const wbDropdown = document.getElementById('wb-dropdown-list');
    if(wbDropdown && !wbDropdown.classList.contains('hidden')) {
        wbDropdown.classList.add('hidden');
    }
    
    if(sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.add('hidden');
    } else {
        sidebar.classList.add('open');
        overlay.classList.remove('hidden');
    }
}

// [修改] 世界书下拉菜单切换逻辑
function toggleWbDropdown() {
    const dropdown = document.getElementById('wb-dropdown-list');
    dropdown.classList.toggle('hidden');
}

// 全局点击监听，处理点击外部关闭世界书下拉框
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('wb-dropdown-list');
    const trigger = document.querySelector('.select-box'); 
    // 如果点击的不是下拉框本身，也不是触发按钮，且下拉框是打开的
    if (dropdown && !dropdown.classList.contains('hidden')) {
        if (!dropdown.contains(event.target) && !trigger.contains(event.target)) {
            dropdown.classList.add('hidden');
        }
    }
});

function initSidebarValues() {
    // 1. User Profile Select
    const userSelect = document.getElementById('chat-user-select');
    userSelect.innerHTML = "";
    userProfiles.forEach((p, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.innerText = p.profileName;
        if(idx == currentChatConfig.activeProfileIdx) opt.selected = true;
        userSelect.appendChild(opt);
    });
    userSelect.onchange = (e) => updateChatSetting('activeProfileIdx', e.target.value);

    // 2. [Modification] World Book Dropdown List (Global Source)
    const wbDropdownContainer = document.getElementById('wb-dropdown-list');
    wbDropdownContainer.innerHTML = ""; // Clear existing
    
    // Removed dependency on 'targetUser', using globalWorldBooks directly
    let selectedCount = 0;

    if(typeof globalWorldBooks !== 'undefined') {
        globalWorldBooks.forEach((wb, idx) => {
            if(wb.isEnabled !== false) {
                const isChecked = currentChatConfig.activeWorldBookIndices.includes(idx);
                if(isChecked) selectedCount++;
                
                const div = document.createElement('div');
                div.style.padding = '8px 10px';
                div.style.borderBottom = '1px solid #f0f0f0';
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = isChecked;
                checkbox.style.marginRight = '10px';
                checkbox.style.transform = 'scale(1.2)';
                checkbox.onchange = (e) => toggleWorldBookSelection(idx, e.target.checked);
                
                const label = document.createElement('span');
                label.innerText = `条目 #${idx+1}: ${wb.content.substring(0,15)}${wb.content.length>15?'...':''}`;
                label.style.fontSize = '0.9rem';
                label.style.flex = '1';
                // 点击文字也能切换
                label.onclick = () => { checkbox.click(); };
                
                div.appendChild(checkbox);
                div.appendChild(label);
                wbDropdownContainer.appendChild(div);
            }
        });
        if(globalWorldBooks.length === 0) {
            wbDropdownContainer.innerHTML = "<div style='padding:10px; color:#999;font-size:0.8rem; text-align:center;'>暂无世界书条目</div>";
        }
    }
    
    // 更新触发按钮上的文字
    updateWbTriggerText(selectedCount);

    // 3. Inputs
    document.getElementById('chat-bg-input').value = currentChatConfig.bg;
    document.getElementById('chat-history-limit').value = currentChatConfig.historyLimit;
    document.getElementById('chat-history-limit').onchange = (e) => updateChatSetting('historyLimit', e.target.value);

    // 4. Summary Listeners
    const sumToggle = document.getElementById('chat-summary-toggle');
    const sumInterval = document.getElementById('chat-summary-interval');
    
    sumToggle.onchange = (e) => updateChatSetting('summaryOn', e.target.value);
    sumInterval.onchange = (e) => updateChatSetting('summaryInterval', e.target.value);
}

function updateWbTriggerText(count) {
    const textSpan = document.getElementById('wb-selected-text');
    if(count === 0) textSpan.innerText = "未选择世界书";
    else textSpan.innerText = `已启用 ${count} 个条目`;
}

// [修改] 处理世界书多选切换
function toggleWorldBookSelection(idx, isChecked) {
    let indices = currentChatConfig.activeWorldBookIndices;
    if (isChecked) {
        if (!indices.includes(idx)) indices.push(idx);
    } else {
        indices = indices.filter(i => i !== idx);
    }
    // Update config
    updateChatSetting('activeWorldBookIndices', indices);
    
    // Update UI text immediately
    updateWbTriggerText(indices.length);
}

function updateChatSetting(key, value) {
    const chat = chats.find(c => c.id === currentChatId);
    if(!chat) return;

    if(key === 'activeProfileIdx' || key === 'historyLimit' || key === 'summaryInterval') value = parseInt(value);
    
    currentChatConfig[key] = value;
    
    // Map simplified keys to settings object
    if(key === 'activeWorldBookIndices') {
        chat.settings.wbIndices = value; // Save array
        chat.settings.wbIdx = "off"; // Legacy clear
    }
    else if(key === 'activeProfileIdx') chat.settings.profileIdx = value;
    else chat.settings[key] = value;
    
    saveChatData();

    // If profile changed, need to refresh worldbook list and messages
    if(key === 'activeProfileIdx') {
        // [修改 1] 移除世界书重置逻辑
        // 因为世界书现在是全局的(globalWorldBooks)且独立的，
        // 切换 "用户(Speaker)" 不应该导致 "世界观设置" 丢失。
        // 所以这里删除了 clearing wbIndices 的代码。
        
        initSidebarValues(); // refresh wb list (to stay safe)
        renderMessages(); // refresh avatars
    }
}

function saveChatBg() {
    const url = document.getElementById('chat-bg-input').value;
    updateChatSetting('bg', url);
    document.getElementById('chat-msg-container').style.backgroundImage = `url('${url}')`;
}

function clearChatHistory() {
    if(!confirm("确定清空当前对话记录？无法恢复。")) return;
    const chat = chats.find(c => c.id === currentChatId);
    chat.messages = [];
    chat.lastSummaryMsgCount = 0; // Reset summary counter
    saveChatData();
    renderMessages();
    toggleChatSidebar();
}

// --- Sticker System ---

function toggleStickerPanel(event) {
    if(event) event.stopPropagation();

    const panel = document.getElementById('sticker-panel');
    
    if(panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        renderStickerGrid();
    } else {
        panel.classList.add('hidden');
    }
}

// [修改 1] 表情包渲染逻辑，增加长按事件
function renderStickerGrid() {
    const grid = document.getElementById('sticker-grid');
    grid.innerHTML = "";
    stickers.forEach((s, index) => {
        const img = document.createElement('img');
        img.className = "sticker-option";
        img.src = s.src;
        
        // 点击发送
        img.onclick = () => sendSticker(s);
        
        // 长按删除 (Touch)
        let pressTimer;
        img.ontouchstart = (e) => { 
            pressTimer = setTimeout(() => { 
                openStickerMenu(index);
                if(navigator.vibrate) navigator.vibrate(50);
            }, 600); 
        };
        img.ontouchend = () => clearTimeout(pressTimer);
        
        // 长按删除 (Mouse)
        img.onmousedown = () => { pressTimer = setTimeout(() => openStickerMenu(index), 600); };
        img.onmouseup = () => clearTimeout(pressTimer);
        
        grid.appendChild(img);
    });
}

// [修改 1] 表情包删除菜单逻辑
function openStickerMenu(index) {
    targetStickerIndex = index;
    document.getElementById('sticker-menu-modal').classList.remove('hidden');
}

function closeStickerMenu() {
    targetStickerIndex = -1;
    document.getElementById('sticker-menu-modal').classList.add('hidden');
}

function confirmDeleteSticker() {
    if (targetStickerIndex === -1) return;
    stickers.splice(targetStickerIndex, 1);
    saveChatData();
    renderStickerGrid();
    closeStickerMenu();
}

function handleStickerUpload(input) {
    const file = input.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        tempStickerFile = e.target.result; // Base64
        document.getElementById('sticker-preview-img').src = tempStickerFile;
        document.getElementById('sticker-desc-input').value = "";
        document.getElementById('sticker-desc-modal').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    input.value = "";
}

function confirmStickerUpload() {
    const desc = document.getElementById('sticker-desc-input').value || "表情包";
    if(!tempStickerFile) return;

    stickers.push({ src: tempStickerFile, desc: desc });
    saveChatData();
    
    document.getElementById('sticker-desc-modal').classList.add('hidden');
    renderStickerGrid(); // Refresh panel
}

function sendSticker(stickerObj) {
    appendMessage('user', stickerObj.src, 'sticker', stickerObj.desc);
    document.getElementById('sticker-panel').classList.add('hidden');
}

// --- Utils ---
function formatTimeShort(ts) {
    if(!ts) return "";
    const date = new Date(ts);
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2,'0')}`;
}

// 全局监听：点击空白处关闭表情包面板
document.addEventListener('click', (e) => {
    const panel = document.getElementById('sticker-panel');
    const btn = document.getElementById('sticker-toggle-btn');
    
    if (!panel.classList.contains('hidden')) {
        if (!panel.contains(e.target) && e.target !== btn) {
            panel.classList.add('hidden');
        }
    }
});
