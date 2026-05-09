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

【活人说话技巧】
* 长短句结合：请务必混合使用短促并且符合角色设定的口语（如“真假？”“笑死”"…めんどくせぇ""无语"）和较长的表达句子。绝对禁止网络用语。不要总是输出长度相同的句子，那样像机器人。
2. 拒绝自说自话：
   互动性：角色的身份是“在聊天的人”，不是“文章鉴赏家”，更不是"独角戏扮演者"。像活人一般自然互动，合适的地方加入吐槽。

**【特殊功能】**
- **发朋友圈(SNS)**：只要你觉得聊天内容有趣、或者想吐槽、或者仅仅是想分享当前心情，就尽管发朋友圈！稍微有好的灵感就发！想要发朋友圈时，在最后一行加：@@SNS@@ (内容)
- **发语音**：你可以发送语音消息，只需要在回复的最前面加上“[语音] ”即可。例如：[语音] 哈哈哈，太好笑了吧。
- **撤回消息**：如果你发错了或者想模拟撤回消息的效果，可以单独输出“[撤回]”作为一条消息内容。
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
    summaryOn: "off",     
    summaryInterval: 10,
    summaryContent: ""
};
let tempStickerFile = null; 
let chatAbortController = null;

let longPressTimer;
let longPressTargetChatId = null;
window.globalLongPressActive = false; // 用于防范展开语音和长按唤出菜单的冲突

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
    if(localStorage.getItem('helios_chats')) chats = JSON.parse(localStorage.getItem('helios_chats'));
    if(localStorage.getItem('helios_stickers')) stickers = JSON.parse(localStorage.getItem('helios_stickers'));
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

    const sortedChats = [...chats].sort((a,b) => {
        const aPin = a.isPinned ? 1 : 0;
        const bPin = b.isPinned ? 1 : 0;
        if(aPin !== bPin) return bPin - aPin; 
        return b.lastTime - a.lastTime; 
    });

    sortedChats.forEach(chat => {
        const role = roles.find(r => r.id === chat.roleId);
        if(!role) return;

        const lastMsg = chat.messages.length > 0 ? chat.messages[chat.messages.length-1] : { content: "新对话", timestamp: "" };
        let previewText = lastMsg.type === 'sticker' ? '[表情包]' : lastMsg.content;
        
        if (lastMsg.isRecalled) previewText = '[撤回了一条消息]';
        else if (previewText.startsWith('[语音]')) previewText = '[语音]';

        if(previewText.length > 20) previewText = previewText.substring(0, 20) + "...";

        const div = document.createElement('div');
        div.className = `chat-list-item ${chat.isPinned ? 'pinned' : ''}`;
        
        div.onclick = () => enterChatRoom(chat.id);
        div.ontouchstart = (e) => { longPressTimer = setTimeout(() => openChatListMenu(chat.id), 800); };
        div.ontouchend = () => clearTimeout(longPressTimer);
        div.ontouchmove = () => clearTimeout(longPressTimer); 
        div.onmousedown = () => { longPressTimer = setTimeout(() => openChatListMenu(chat.id), 800); };
        div.onmouseup = () => clearTimeout(longPressTimer);

        div.innerHTML = `
            <img src="${role.avatar}" class="chat-list-avatar">
            <div class="chat-list-info">
                <div class="chat-list-name">
                    ${role.name}
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
    const existing = chats.find(c => c.roleId === roleId);
    if(existing) { closeNewChatModal(); enterChatRoom(existing.id); return; }

    const newChat = {
        id: "chat_" + Date.now(),
        roleId: roleId,
        lastTime: Date.now(),
        isPinned: false,
        settings: {
            bg: "", historyLimit: 20, wbIndices: [], profileIdx: (typeof currentProfileIndex !== 'undefined' ? currentProfileIndex : 0),
            summaryOn: "off", summaryInterval: 10, summaryContent: ""
        },
        messages: [],
        lastSummaryMsgCount: 0 
    };

    chats.push(newChat);
    saveChatData(); closeNewChatModal(); enterChatRoom(newChat.id);
}

// --- Chat Room Logic ---
function enterChatRoom(chatId) {
    const chat = chats.find(c => c.id === chatId);
    if(!chat) return;

    currentChatId = chatId;
    let safeWbIndices = [];
    if (chat.settings.wbIndices && Array.isArray(chat.settings.wbIndices)) safeWbIndices = chat.settings.wbIndices;
    else if (chat.settings.wbIdx !== undefined && chat.settings.wbIdx !== "off") safeWbIndices = [parseInt(chat.settings.wbIdx)];

    currentChatConfig = {
        bg: chat.settings.bg || "",
        historyLimit: chat.settings.historyLimit || 20,
        activeWorldBookIndices: safeWbIndices, 
        activeProfileIdx: chat.settings.profileIdx !== undefined ? chat.settings.profileIdx : currentProfileIndex,
        summaryOn: chat.settings.summaryOn || "off",
        summaryInterval: chat.settings.summaryInterval || 10,
        summaryContent: chat.settings.summaryContent || ""
    };

    document.querySelectorAll('.system-page').forEach(el => el.classList.add('hidden'));
    const roomPage = document.getElementById('chat-room-page');
    roomPage.classList.remove('hidden');
    
    document.getElementById('chat-msg-container').style.backgroundImage = currentChatConfig.bg ? `url('${currentChatConfig.bg}')` : 'none';
    
    initSidebarValues();
    const role = roles.find(r => r.id === chat.roleId);
    document.getElementById('chat-title-name').innerText = role ? role.name : "Chat";
    renderMessages();

    document.getElementById('chat-summary-toggle').value = currentChatConfig.summaryOn;
    document.getElementById('chat-summary-interval').value = currentChatConfig.summaryInterval;
    document.getElementById('chat-summary-content').value = currentChatConfig.summaryContent;
    document.getElementById('chat-title-status').innerText = ""; 
    const input = document.getElementById('chat-input');
    input.style.height = 'auto'; input.value = "";
}

function exitChatRoom() {
    currentChatId = null;
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

    const role = roles.find(r => r.id === chat.roleId);
    const chatUser = userProfiles[currentChatConfig.activeProfileIdx] || user;

    chat.messages.forEach((msg,index) => {
        const isMe = msg.sender === 'user';
        const avatarSrc = isMe ? chatUser.avatar : (role ? role.avatar : "");
        
        const row = document.createElement('div');
        row.className = `chat-bubble-row ${isMe ? 'right' : 'left'}`;
        
        const timeStr = formatTimeShort(msg.timestamp);
        
        // --- 1. 处理撤回消息 ---
        if (msg.isRecalled) {
            let senderName = isMe ? chatUser.name : (role ? role.name : '对方');
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
        if (msg.type === 'sticker') {
            bubbleContent = `<img src="${msg.content}" class="chat-sticker-img">`;
        } else {
            bubbleContent = msgContent.replace(/\n/g, '<br>');
        }

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
        } else if (isVoice) {
            innerHTMLContent = `
                <div style="display:flex; align-items:flex-end; gap:5px;">
                    ${isMe ? `<div class="chat-timestamp-side">${timeStr}</div>` : ''}
                    <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'};">
                        <div class="chat-bubble-content voice-bubble ${targetClass}" style="${bubbleLayout}" onclick="toggleVoiceText(event, ${index})">
                            <span style="font-size:1.1rem; margin-right:5px;">🔊</span> [语音] ${voiceDuration}"
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
                    <div class="chat-bubble-content ${targetClass}" style="${bubbleLayout}">${bubbleContent}</div>
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

        // --- 4. 绑定悬浮菜单长按事件 (终极防系统打断版) ---
        setTimeout(() => {
            const bubbleEl = row.querySelector(`.${targetClass}`);
            if (bubbleEl) {
                let pressTimer;
                let isDragging = false;
                let startX = 0, startY = 0;
                
                // 彻底阻止浏览器自带的长按菜单
                bubbleEl.oncontextmenu = (e) => { e.preventDefault(); };
                
                const startPress = (e) => {
                    if (index === editingMsgIndex) return; 
                    isDragging = false;
                    window.globalLongPressActive = false;
                    
                    if (e.touches && e.touches.length > 0) {
                        startX = e.touches[0].clientX;
                        startY = e.touches[0].clientY;
                    }
                    
                    // 降到 400 毫秒，比系统判定更快一步触发
                    pressTimer = setTimeout(() => {
                        if (!isDragging) {
                            window.globalLongPressActive = true;
                            openFloatingMenu(e, index, bubbleEl);
                            if(navigator.vibrate) navigator.vibrate(50);
                        }
                    }, 400); 
                };
                
                bubbleEl.ontouchmove = (e) => {
                    if (e.touches && e.touches.length > 0) {
                        const moveX = e.touches[0].clientX;
                        const moveY = e.touches[0].clientY;
                        if (Math.abs(moveX - startX) > 10 || Math.abs(moveY - startY) > 10) {
                            isDragging = true; 
                            clearTimeout(pressTimer); 
                        }
                    }
                };
                
                bubbleEl.ontouchstart = startPress;
                // 加入 ontouchcancel 防止系统级滑动打断
                bubbleEl.ontouchcancel = () => { clearTimeout(pressTimer); };
                bubbleEl.ontouchend = (e) => { clearTimeout(pressTimer); if(window.globalLongPressActive) e.stopPropagation(); };

                bubbleEl.onmousedown = startPress;
                bubbleEl.onmousemove = () => { isDragging = true; clearTimeout(pressTimer); };
                bubbleEl.onmouseup = (e) => { clearTimeout(pressTimer); if(window.globalLongPressActive) e.stopPropagation(); };
                bubbleEl.onmouseleave = () => clearTimeout(pressTimer);
            }
        }, 0);
    });

    scrollToBottom();
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

function copyMsg() {
    let sel = window.getSelection();
    let text = sel.toString().trim();
    
    if (!text) {
        const chat = chats.find(c => c.id === currentChatId);
        if (chat && chat.messages[targetMsgIndex]) {
            text = chat.messages[targetMsgIndex].content;
            if (text.startsWith('[语音]')) text = text.replace(/^\[语音\]\s*/, '').trim();
        }
    }
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => showToast('已复制')).catch(() => fallbackCopy(text));
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

function editMsg() {
    editingMsgIndex = targetMsgIndex;
    closeFloatingMenu();
    renderMessages();
}

function saveEditMsg(index, isVoice) {
    const chat = chats.find(c => c.id === currentChatId);
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
    `;

    const role = roles.find(r => r.id === chat.roleId);
    const chatUser = userProfiles[currentChatConfig.activeProfileIdx] || user;
    
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
        } else {
            content = m.content;
        }
        
        return `${name}: ${content}`;
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
        
        const msgParts = rawContent.split("@@SPLIT@@");
        
        for (let i = 0; i < msgParts.length; i++) {
            const part = msgParts[i].trim();
            if (part) {
                if (i > 0) await new Promise(r => setTimeout(r, 600));
                
                if (part === '[撤回]') {
                     chat.messages.push({ sender: 'role', content: "", type: 'text', isRecalled: true, timestamp: Date.now() });
                     chat.lastTime = Date.now();
                     saveChatData(); renderMessages();
                } else {
                     appendMessage('role', part, 'text');
                }
            }
        }
        
        if (snsDraft) handleChatToSNS(role, snsDraft);
        checkAutoSummary(chat, chatUser, role);
    }
}

function appendMessage(sender, content, type, desc = "") {
    const chat = chats.find(c => c.id === currentChatId);
    if(!chat) return;
    chat.messages.push({ sender: sender, content: content, type: type, desc: desc, timestamp: Date.now() });
    chat.lastTime = Date.now();
    saveChatData(); renderMessages();
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
    document.getElementById('chat-history-limit').value = currentChatConfig.historyLimit;
    document.getElementById('chat-history-limit').onchange = (e) => updateChatSetting('historyLimit', e.target.value);
    document.getElementById('chat-summary-toggle').onchange = (e) => updateChatSetting('summaryOn', e.target.value);
    document.getElementById('chat-summary-interval').onchange = (e) => updateChatSetting('summaryInterval', e.target.value);
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

function clearChatHistory() {
    if(!confirm("确定清空当前对话记录？无法恢复。")) return;
    const chat = chats.find(c => c.id === currentChatId);
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

function handleStickerUpload(input) {
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        tempStickerFile = e.target.result;
        document.getElementById('sticker-preview-img').src = tempStickerFile;
        document.getElementById('sticker-desc-input').value = "";
        document.getElementById('sticker-desc-modal').classList.remove('hidden');
    };
    reader.readAsDataURL(file); input.value = "";
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
