
// ==========================================
// CHAT SYSTEM CONTROLLER
// ==========================================

// --- Constants ---
const DM_VIBE_PROMPT = `
【核心指令】：你正在与用户进行 1对1 的私密聊天。
**【输出格式强制要求】**
为了模拟真实聊天体验，请不要一次性输出一大段话。请将你的回复拆分成 1 到 6 条简短的消息。
每条消息之间用 @@SPLIT@@ 分隔。
在回复的最开头，用 @@STATUS@@心情@@STATUS@@ 的格式更新你当前的状态（例如：正在输入…、开心、偷笑、发呆，限10字内）。

示例输出：
@@STATUS@@偷笑@@STATUS@@
哈哈，真的吗？@@SPLIT@@笑死我了。@@SPLIT@@那你打算怎么办？

**【语境规则】**
1. **口语化**：像微信/短信一样自然，可以使用 emoji。
2. **提及他人**：可以八卦通讯录里的其他人，但不要扮演他们。
3. **记忆**：
   - 参考 [SUMMARY] (长期记忆) 和 [CHAT HISTORY] (短期记忆)。
   - 如果用户提到之前的总结内容，请自然接话。
【活人说话技巧】
*  长短句结合：请务必混合使用短促并且符合角色设定的口语（如“真假？”“笑死”"…めんどくせぇ""无语"）和较长的表达句子。绝对禁止网络用语。不要总是输出长度相同的句子，那样像机器人。
2. 拒绝自说自话：
   互动性：角色的身份是“在聊天的人”，不是“文章鉴赏家”，更不是"独角戏扮演者"。像活人一般自然互动，合适的地方加入吐槽。
你必须明白，天才的智慧，不体现在他们“如何”思考和说话，而是在于他们思考和说话的“时机”和“结果”所指向的**深刻洞察**。你的任务，就是让他们拥有一个“普通人的内心和嘴巴”。

**【特殊功能】**
- 想要发朋友圈(SNS)时，在最后一行加：@@SNS@@ (内容)
`;

// --- Global Chat State ---
let chats = [];
let stickers = [];
let currentChatId = null;
let targetMsgIndex = -1; 
let currentChatConfig = {
    bg: "",
    historyLimit: 20,
    activeWorldBookIdx: -1, // -1 means off
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
    // Pre-load stickers if empty
    if(stickers.length === 0) {
        stickers = [
            { src: "https://files.catbox.moe/f70fm9.png", desc: "微笑/默认表情" }
        ];
    }
});

function loadChatData() {
    if(localStorage.getItem('helios_chats')) {
        chats = JSON.parse(localStorage.getItem('helios_chats'));
    }
    if(localStorage.getItem('helios_stickers')) {
        stickers = JSON.parse(localStorage.getItem('helios_stickers'));
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
            wbIdx: "off",
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
    // Load local settings or defaults
    currentChatConfig = {
        bg: chat.settings.bg || "",
        historyLimit: chat.settings.historyLimit || 20,
        activeWorldBookIdx: chat.settings.wbIdx !== undefined ? chat.settings.wbIdx : "off",
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
    const input = document.getElementById('chat-input'); // 先重置一下 input.style.height = 'auto'; // 绑定输入事件 input.oninput = function() { this.style.height = 'auto'; // 先缩回去，防止删除文字时不回缩 this.style.height = (this.scrollHeight) + 'px'; // 再根据内容撑开 };
}

function exitChatRoom() {
    currentChatId = null;
    document.getElementById('chat-room-page').classList.add('hidden');
    enterChatList();
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
        // 长按事件绑定 (手机 & 电脑调试)
        let pressTimer;
        
        // 手机触摸
        row.ontouchstart = () => { 
            pressTimer = setTimeout(() => { 
                openMsgMenu(index);       // 触发菜单
                if(navigator.vibrate) navigator.vibrate(50); // 震动反馈
            }, 600); // 600毫秒视为长按
        };
        row.ontouchend = () => clearTimeout(pressTimer);
        row.ontouchmove = () => clearTimeout(pressTimer);
        
        // 电脑鼠标 (方便你在电脑上测试)
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

// --- 新的布局逻辑 ---
// role (Left): 头像 -> [气泡 + 时间]
// user (Right): [时间 + 气泡] <- 头像 (因为外层 CSS .right 是 row-reverse)

let innerHTMLContent = "";

if (isMe) {
    // 我发的消息：时间在左，气泡在右 (Flex Row)
    innerHTMLContent = `
                <div style="display:flex; align-items:flex-end; max-width:100%;">
                    <div class="chat-timestamp-side">${timeStr}</div>
                    <div class="chat-bubble-content">${bubbleContent}</div>
                </div>
            `;
} else {
    // 对方消息：气泡在左，时间在右
    innerHTMLContent = `
                <div style="display:flex; align-items:flex-end; max-width:100%;">
                    <div class="chat-bubble-content">${bubbleContent}</div>
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
// search: function scrollToBottom() { ... }

// --- [新增] 消息删除逻辑 ---

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
        // 删除指定索引的消息
        chat.messages.splice(targetMsgIndex, 1);
        saveChatData(); // 保存
        renderMessages(); // 重新渲染界面
    }
    closeMsgMenu();
}
// --- [新增] 消息删除菜单逻辑 --- function openMsgMenu(index) { targetMsgIndex = index; document.getElementById('msg-menu-modal').classList.remove('hidden'); } function closeMsgMenu() { targetMsgIndex = -1; document.getElementById('msg-menu-modal').classList.add('hidden'); } function confirmDeleteMsg() { if (targetMsgIndex === -1 || !currentChatId) return; const chat = chats.find(c => c.id === currentChatId); if (chat) { // 删除数组中对应索引的消息 chat.messages.splice(targetMsgIndex, 1); saveChatData(); // 保存更改 renderMessages(); // 刷新界面 } closeMsgMenu(); }
// --- Messaging Actions ---

function sendUserMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text) return;

    appendMessage('user', text, 'text');
    input.value = "";
    input.style.height = 'auto';
    
    // Auto-save logic
    const chat = chats.find(c => c.id === currentChatId);
    chat.lastTime = Date.now();
    saveChatData();
}

// The core AI function
async function triggerChatGen() {
    const btnImg = document.querySelector('.gen-btn img');
    // 定义图标：正常态(你的原图)，停止态(用一个通用图标或 emoji 图片)
    // 这里的停止图标我暂时用了一个红色的方形图标，你可以换成你喜欢的暂停图
    const ICON_IDLE = "https://files.catbox.moe/prdem6.png";
    const ICON_STOP = "https://files.catbox.moe/prdem6.png"; // 这是一个红色的停止方块图标
    
    // 1. 【停止逻辑】如果正在生成，点击则停止
    if (chatAbortController) {
        chatAbortController.abort(); // 发送停止信号
        chatAbortController = null;
        
        // 恢复 UI
        btnImg.src = ICON_IDLE;
        btnImg.style.opacity = "1";
        document.getElementById('chat-title-status').innerText = "";
        return;
    }
    
    // --- 开始正常生成逻辑 ---
    
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    
    // ============================================
    // [TIME AWARENESS LOGIC ADDED HERE]
    // ============================================
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
    1. Reply naturally based on the time of day (e.g., don't say "Good Morning" at night).
    2. Check the [YOUR ROLE] and [USER INFO] Persona descriptions. If today matches any birthday mentioned there, acknowledge it naturally.
    3. If today is a culturally significant date or festival, act aware of it, but do not force a mention unless relevant.
    `;
    // ============================================

    const role = roles.find(r => r.id === chat.roleId);
    const chatUser = userProfiles[currentChatConfig.activeProfileIdx] || user;
    
    // UI 反馈：切换为停止图标，显示状态
    chatAbortController = new AbortController(); // 创建控制器
    btnImg.src = ICON_STOP; // 切换图标
    document.getElementById('chat-title-status').innerText = "正在输入…";
    
    // (中间的 Context 构建代码保持不变，为了节省篇幅，这里省略中间的构建部分...)
    // ... 请保留你原来的 WorldBook, Gossip, History, Summary 代码 ...
    // ... 必须要保留原本的 fullSystemPrompt 构建代码 ...
    
    // 为了方便你复制，这里只写变更的核心部分：AI调用部分
    
    // ↓↓↓↓↓↓ 这一块是构建 prompt 的代码，请确保你原来的代码还在 ↓↓↓↓↓↓
    // 如果你不知道怎么保留，请告诉我，我把完整的再发一遍。
    // 假设你这里已经有了 fullSystemPrompt 变量
    
    // 1. Context Building (请保持原样)
    let wbContext = "";
    if (currentChatConfig.activeWorldBookIdx !== "off" && chatUser.worldBooks) {
        const wbItem = chatUser.worldBooks[currentChatConfig.activeWorldBookIdx];
        if (wbItem) wbContext = `[WORLD INFO]: ${wbItem.content}`;
    }
    
    const otherRoles = roles.filter(r => r.id !== role.id && r.isEnabled !== false);
    const gossipRoles = otherRoles.sort(() => 0.5 - Math.random()).slice(0, 5);
    const gossipText = gossipRoles.map(r => `${r.name} (${r.id}): ${r.persona.substring(0, 50)}...`).join("\n");
    
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
    // ↑↑↑↑↑↑ (Prompt构建结束) ↑↑↑↑↑↑
    
    // 3. Call AI (这里是修改重点：传入 signal)
    const aiResponse = await callAI([
        { role: "system", content: fullSystemPrompt },
        { role: "user", content: "(Please reply now. Remember to split messages with @@SPLIT@@ and set status with @@STATUS@@)" }
    ], chatAbortController.signal); // <--- 传入 signal
    
    // 生成结束后的清理工作
    chatAbortController = null;
    btnImg.src = ICON_IDLE; // 恢复图标
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
    
    // Calculate total messages / 2 (approx rounds)
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
    
    // Get context (Interval * 4 messages to be safe)
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
        // Update State
        currentChatConfig.summaryContent = summary;
        chat.settings.summaryContent = summary;
        chat.lastSummaryMsgCount = chat.messages.length;
        
        // UI Update
        document.getElementById('chat-summary-content').value = summary;
        saveChatData();
        
        document.getElementById('chat-title-status').innerText = "记忆已更新";
        setTimeout(() => {
             // If status hasn't changed by another process, clear it
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
    
    if(sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.add('hidden');
    } else {
        sidebar.classList.add('open');
        overlay.classList.remove('hidden');
    }
}

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

    // 2. World Book Select (Based on ACTIVE USER PROFILE)
    const wbSelect = document.getElementById('chat-world-select');
    wbSelect.innerHTML = `<option value="off">不启用</option>`;
    
    const targetUser = userProfiles[currentChatConfig.activeProfileIdx] || user;
    if(targetUser.worldBooks) {
        targetUser.worldBooks.forEach((wb, idx) => {
            if(wb.isEnabled !== false) {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.innerText = `条目 #${idx+1} (${wb.content.substring(0,10)}...)`;
                if(idx == currentChatConfig.activeWorldBookIdx) opt.selected = true;
                wbSelect.appendChild(opt);
            }
        });
    }
    wbSelect.onchange = (e) => updateChatSetting('activeWorldBookIdx', e.target.value);

    // 3. Inputs
    document.getElementById('chat-bg-input').value = currentChatConfig.bg;
    document.getElementById('chat-history-limit').value = currentChatConfig.historyLimit;

    // 4. Summary Listeners
    const sumToggle = document.getElementById('chat-summary-toggle');
    const sumInterval = document.getElementById('chat-summary-interval');
    
    sumToggle.onchange = (e) => updateChatSetting('summaryOn', e.target.value);
    sumInterval.onchange = (e) => updateChatSetting('summaryInterval', e.target.value);
}

function updateChatSetting(key, value) {
    const chat = chats.find(c => c.id === currentChatId);
    if(!chat) return;

    if(key === 'activeProfileIdx' || key === 'historyLimit' || key === 'summaryInterval') value = parseInt(value);
    
    currentChatConfig[key] = value;
    
    // Map simplified keys to settings object
    if(key === 'activeWorldBookIdx') chat.settings.wbIdx = value;
    else if(key === 'activeProfileIdx') chat.settings.profileIdx = value;
    else chat.settings[key] = value;
    
    saveChatData();

    // If profile changed, need to refresh worldbook list and messages
    if(key === 'activeProfileIdx') {
        initSidebarValues(); // refresh wb list
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

// 修改这个函数，接收 event
function toggleStickerPanel(event) {
    if(event) event.stopPropagation(); // 阻止冒泡

    const panel = document.getElementById('sticker-panel');
    
    if(panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        renderStickerGrid();
    } else {
        panel.classList.add('hidden');
    }
}

function renderStickerGrid() {
    const grid = document.getElementById('sticker-grid');
    grid.innerHTML = "";
    stickers.forEach(s => {
        const img = document.createElement('img');
        img.className = "sticker-option";
        img.src = s.src;
        img.onclick = () => sendSticker(s);
        grid.appendChild(img);
    });
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
    const btn = document.getElementById('sticker-toggle-btn'); // 刚才HTML里加的ID
    
    // 如果面板是打开的
    if (!panel.classList.contains('hidden')) {
        // 且点击的目标既不是面板内部，也不是按钮本身
        if (!panel.contains(e.target) && e.target !== btn) {
            panel.classList.add('hidden');
        }
    }
});
