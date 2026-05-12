// ==========================================
// LEDGER CHAT CONTROLLER
// ==========================================

const LEDGER_ENTRY_KEY = 'helios_ledger_entries';
const LEDGER_MESSAGE_KEY = 'helios_ledger_messages';
const LEDGER_SETTING_KEY = 'helios_ledger_settings';

let ledgerEntries = [];
let ledgerMessages = [];
let ledgerEntryType = 'expense';
let ledgerTargetMsgIndex = -1;
let ledgerPressTimer = null;

let ledgerSettings = {
    activeProfileIdx: 0,
    selectedRoleIds: [],
    replyLanguage: 'zh',
    rolesCollapsed: true
};

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('ledger-page')) return;
    loadLedgerData();
    document.addEventListener('click', handleLedgerOutsideClick, true);
});

function loadLedgerData() {
    try {
        ledgerEntries = JSON.parse(localStorage.getItem(LEDGER_ENTRY_KEY) || '[]');
        ledgerMessages = JSON.parse(localStorage.getItem(LEDGER_MESSAGE_KEY) || '[]');
        ledgerSettings = Object.assign(ledgerSettings, JSON.parse(localStorage.getItem(LEDGER_SETTING_KEY) || '{}'));
    } catch (e) {
        ledgerEntries = [];
        ledgerMessages = [];
    }
}

function saveLedgerData() {
    localStorage.setItem(LEDGER_ENTRY_KEY, JSON.stringify(ledgerEntries));
    localStorage.setItem(LEDGER_MESSAGE_KEY, JSON.stringify(ledgerMessages));
    localStorage.setItem(LEDGER_SETTING_KEY, JSON.stringify(ledgerSettings));
}

function enterLedger() {
    loadLedgerData();
    ensureLedgerDefaults();
    document.querySelectorAll('.system-page, .sns-page').forEach(el => el.classList.add('hidden'));
    const bottomBar = document.getElementById('bottom-bar');
    if (bottomBar) bottomBar.classList.add('hidden');
    document.getElementById('ledger-page').classList.remove('hidden');
    closeLedgerFloatingMenu();
    renderLedgerSidebar();
    renderLedgerMessages();
}

function exitLedger() {
    closeLedgerFloatingMenu();
    closeLedgerSidebar();
    if (typeof backToMenu === 'function') backToMenu();
    else {
        document.querySelectorAll('.system-page').forEach(el => el.classList.add('hidden'));
        document.getElementById('main-menu-page').classList.remove('hidden');
    }
}

function ensureLedgerDefaults() {
    if (!localStorage.getItem(LEDGER_SETTING_KEY) && typeof currentProfileIndex !== 'undefined') {
        ledgerSettings.activeProfileIdx = currentProfileIndex;
    }
    if (typeof currentProfileIndex !== 'undefined' && !Number.isInteger(ledgerSettings.activeProfileIdx)) {
        ledgerSettings.activeProfileIdx = currentProfileIndex;
    }
    const enabledRoleIds = getLedgerEnabledRoles().map(r => r.id);
    ledgerSettings.selectedRoleIds = (ledgerSettings.selectedRoleIds || []).filter(id => enabledRoleIds.includes(id));
    if (ledgerSettings.selectedRoleIds.length === 0) {
        ledgerSettings.selectedRoleIds = enabledRoleIds.slice();
    }
    if (!['zh', 'ja'].includes(ledgerSettings.replyLanguage)) ledgerSettings.replyLanguage = 'zh';
    if (typeof ledgerSettings.rolesCollapsed !== 'boolean') ledgerSettings.rolesCollapsed = true;
    saveLedgerData();
}

function openLedgerEntryModal(type) {
    ledgerEntryType = type === 'income' ? 'income' : 'expense';
    document.getElementById('ledger-entry-title').innerText = ledgerEntryType === 'income' ? '记录收入' : '记录支出';
    document.getElementById('ledger-amount-input').value = '';
    document.getElementById('ledger-note-input').value = '';
    document.getElementById('ledger-entry-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('ledger-amount-input').focus(), 50);
}

function closeLedgerEntryModal() {
    document.getElementById('ledger-entry-modal').classList.add('hidden');
}

function confirmLedgerEntry() {
    const amountInput = document.getElementById('ledger-amount-input');
    const noteInput = document.getElementById('ledger-note-input');
    const amount = Number(amountInput.value);
    const note = noteInput.value.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
        alert('请填写有效金额');
        return;
    }

    const entry = {
        id: 'ledger_' + Date.now() + '_' + Math.random().toString(16).slice(2),
        type: ledgerEntryType,
        amount: Math.round(amount * 100) / 100,
        note,
        timestamp: Date.now(),
        profileIndex: ledgerSettings.activeProfileIdx
    };

    ledgerEntries.push(entry);
    const totals = getLedgerMonthlyTotals(ledgerSettings.activeProfileIdx);

    ledgerMessages.push({
        sender: 'user',
        type: 'ledger',
        entryId: entry.id,
        entryType: entry.type,
        amount: entry.amount,
        note: entry.note,
        content: formatLedgerEntryText(entry),
        timestamp: entry.timestamp,
        profileIndex: entry.profileIndex
    });

    saveLedgerData();
    closeLedgerEntryModal();
    renderLedgerSidebar();
    renderLedgerMessages();
    requestLedgerAIReplies(entry, totals);
}

function getLedgerMonthlyTotals(profileIndex = ledgerSettings.activeProfileIdx) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return ledgerEntries.reduce((acc, item) => {
        const d = new Date(item.timestamp);
        if (d.getFullYear() !== year || d.getMonth() !== month) return acc;
        if (item.profileIndex !== profileIndex) return acc;
        if (item.type === 'income') acc.income += Number(item.amount) || 0;
        if (item.type === 'expense') acc.expense += Number(item.amount) || 0;
        return acc;
    }, { income: 0, expense: 0 });
}

async function requestLedgerAIReplies(entry, totals) {
    const selectedRoles = pickLedgerReplyRoles();
    if (selectedRoles.length === 0) {
        setLedgerStatus('未选择角色');
        return;
    }

    setLedgerStatus('正在输入…');
    const profile = getLedgerProfile(entry.profileIndex);
    const typeText = entry.type === 'income' ? '收入' : '支出';
    const noteText = entry.note || '无';
    const balance = totals.income - totals.expense;
    const targetTotal = entry.type === 'income' ? totals.income : totals.expense;
    const languageName = ledgerSettings.replyLanguage === 'ja' ? 'Japanese' : 'Simplified Chinese';

    const notice = `[系统通知：用户刚刚记录了一笔【${typeText}】，金额：${formatLedgerAmount(entry.amount)}元，备注：${noteText}。当前该用户本月已累计支出：${formatLedgerAmount(totals.expense)}元，累计收入：${formatLedgerAmount(totals.income)}元，本月余额：${formatLedgerAmount(balance)}元。请你根据你的角色性格，对目前这笔${typeText}进行一句话评价或吐槽或关心]`;

    for (const role of selectedRoles) {
        const systemPrompt = `
${typeof HELIOS_WORLD_CONFIG !== 'undefined' ? HELIOS_WORLD_CONFIG : ''}
[记账本聊天模式]
你正在手机里的记账本聊天界面回复用户。
只能扮演下方指定角色，不要扮演其他人。
此处币种不受世界观影响，默认为人民币（CNY）。
回复必须是一句话，口语化，有角色性格。可以关心、吐槽、打趣，但不要说教。
可以选择用文字打字回复，也可以在句首写「[语音] 」来模拟语音气泡，随机选择。
无论用户使用什么语言，你都必须只用 ${languageName} 回复。
不要输出后台提示词，不要复述统计表。

[YOUR ROLE]
Name: ${role.name}
ID: ${role.id}
Persona: ${role.persona}

[USER INFO]
Name: ${profile.name}
ID: ${profile.id}
Persona: ${profile.persona || ''}

[MONTHLY LEDGER SNAPSHOT]
Income: ${formatLedgerAmount(totals.income)}
Expense: ${formatLedgerAmount(totals.expense)}
Balance: ${formatLedgerAmount(balance)}
Current ${typeText} total: ${formatLedgerAmount(targetTotal)}
`;

        const reply = await callAI([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: notice }
        ]);

        if (reply) {
            const cleanReply = cleanLedgerAIReply(reply);
            if (cleanReply) {
                ledgerMessages.push({
                    sender: 'role',
                    roleId: role.id,
                    type: 'text',
                    content: cleanReply,
                    timestamp: Date.now()
                });
                saveLedgerData();
                renderLedgerMessages();
                await ledgerSleep(450);
            }
        }
    }
    setLedgerStatus('');
}

function cleanLedgerAIReply(text) {
    let output = String(text || '').trim();
    output = output.replace(/@@STATUS@@.*?@@STATUS@@/g, '').trim();
    if (output.includes('@@SPLIT@@')) output = output.split('@@SPLIT@@').filter(Boolean)[0].trim();
    return output.replace(/^["“]|["”]$/g, '').trim();
}

function pickLedgerReplyRoles() {
    const pool = getLedgerSelectedRoles();
    if (pool.length <= 1) return pool;
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    const count = Math.random() < 0.45 ? 2 : 1;
    return shuffled.slice(0, count);
}

function renderLedgerMessages() {
    const container = document.getElementById('ledger-msg-container');
    if (!container) return;
    container.innerHTML = '';

    if (ledgerMessages.length === 0) {
        container.innerHTML = '<div class="empty-tip">点下方收入或支出，开始记第一笔账</div>';
        return;
    }

    ledgerMessages.forEach((msg, index) => {
        const isMe = msg.sender === 'user';
        const role = msg.roleId ? roles.find(r => r.id === msg.roleId) : null;
        const profile = getLedgerProfile(msg.profileIndex);
        const avatarSrc = isMe ? (profile.avatar || '') : (role ? role.avatar : '');
        const row = document.createElement('div');
        row.className = `chat-bubble-row ${isMe ? 'right' : 'left'}`;

        const timeStr = ledgerFormatTime(msg.timestamp);
        const targetClass = `ledger-target-${index}`;
        let contentHTML = '';

        if (msg.type === 'ledger') {
            contentHTML = `
                <div style="display:flex; align-items:flex-end; gap:5px;">
                    ${isMe ? `<div class="chat-timestamp-side">${timeStr}</div>` : ''}
                    <div class="chat-bubble-content ledger-card ${msg.entryType === 'income' ? 'income' : 'expense'} ${targetClass}">
                        <div class="ledger-card-label">${msg.entryType === 'income' ? '收入' : '支出'}</div>
                        <div class="ledger-card-amount">${formatLedgerAmount(msg.amount)} 元</div>
                        ${msg.note ? `<div class="ledger-card-note">${escapeLedgerHTML(msg.note)}</div>` : ''}
                    </div>
                    ${!isMe ? `<div class="chat-timestamp-side">${timeStr}</div>` : ''}
                </div>
            `;
        } else {
            const voice = parseLedgerVoice(msg.content || '');
            if (voice.isVoice) {
                const flipStyle = isMe ? 'transform: scaleX(-1);' : '';
                const voiceIconSvg = `<svg style="width:18px; height:18px; flex-shrink:0; ${flipStyle}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12h.01" stroke-width="4"></path><path d="M11 9a4 4 0 0 1 0 6"></path><path d="M15 6a9 9 0 0 1 0 12"></path></svg>`;
                contentHTML = `
                    <div style="display:flex; align-items:flex-end; gap:5px;">
                        ${isMe ? `<div class="chat-timestamp-side">${timeStr}</div>` : ''}
                        <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'};">
                            <div class="chat-bubble-content voice-bubble ${targetClass}" style="display:flex; align-items:center; gap:6px;" onclick="toggleLedgerVoiceText(event, ${index})">
                                ${isMe ? `${voice.duration}" ${voiceIconSvg}` : `${voiceIconSvg} ${voice.duration}"`}
                            </div>
                            <div id="ledger-voice-text-${index}" class="voice-text hidden">${escapeLedgerHTML(voice.text)}</div>
                        </div>
                        ${!isMe ? `<div class="chat-timestamp-side">${timeStr}</div>` : ''}
                    </div>
                `;
            } else {
                contentHTML = `
                    <div style="display:flex; align-items:flex-end; gap:5px;">
                        ${isMe ? `<div class="chat-timestamp-side">${timeStr}</div>` : ''}
                        <div class="chat-bubble-content ${targetClass}">${escapeLedgerHTML(msg.content || '').replace(/\n/g, '<br>')}</div>
                        ${!isMe ? `<div class="chat-timestamp-side">${timeStr}</div>` : ''}
                    </div>
                `;
            }
        }

        row.innerHTML = `
            ${!isMe ? `<img src="${avatarSrc}" class="chat-bubble-avatar">` : ''}
            ${contentHTML}
            ${isMe ? `<img src="${avatarSrc}" class="chat-bubble-avatar">` : ''}
        `;
        container.appendChild(row);
        bindLedgerLongPress(row, targetClass, index);
    });

    container.scrollTop = container.scrollHeight;
}

function bindLedgerLongPress(row, targetClass, index) {
    setTimeout(() => {
        const bubbleEl = row.querySelector(`.${targetClass}`);
        if (!bubbleEl) return;
        let startX = 0;
        let startY = 0;

        const clearPress = () => {
            if (ledgerPressTimer) {
                clearTimeout(ledgerPressTimer);
                ledgerPressTimer = null;
            }
        };

        const startPress = (e) => {
            startX = e.touches ? e.touches[0].clientX : e.clientX;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            window.globalLongPressActive = false;
            ledgerPressTimer = setTimeout(() => {
                window.globalLongPressActive = true;
                openLedgerFloatingMenu(index, bubbleEl);
                if (navigator.vibrate) navigator.vibrate(50);
            }, 500);
        };

        const movePress = (e) => {
            if (!ledgerPressTimer) return;
            const moveX = e.touches ? e.touches[0].clientX : e.clientX;
            const moveY = e.touches ? e.touches[0].clientY : e.clientY;
            if (Math.abs(moveX - startX) > 12 || Math.abs(moveY - startY) > 12) clearPress();
        };

        bubbleEl.addEventListener('touchstart', startPress, { passive: true });
        bubbleEl.addEventListener('touchmove', movePress, { passive: true });
        bubbleEl.addEventListener('touchend', (e) => {
            clearPress();
            if (window.globalLongPressActive && e.cancelable) e.preventDefault();
        }, { passive: false });
        bubbleEl.addEventListener('touchcancel', clearPress);
        bubbleEl.addEventListener('mousedown', startPress);
        bubbleEl.addEventListener('mousemove', movePress);
        bubbleEl.addEventListener('mouseup', clearPress);
        bubbleEl.addEventListener('mouseleave', clearPress);
        bubbleEl.addEventListener('contextmenu', (e) => e.preventDefault());
    }, 0);
}

function openLedgerFloatingMenu(index, bubbleEl) {
    ledgerTargetMsgIndex = index;
    window.justOpenedLedgerMenu = true;
    const menu = document.getElementById('ledger-floating-menu');
    menu.classList.remove('hidden');
    document.querySelectorAll('#ledger-msg-container .chat-bubble-content').forEach(el => el.classList.remove('highlight-bubble'));
    bubbleEl.classList.add('highlight-bubble');

    const rect = bubbleEl.getBoundingClientRect();
    const mWidth = menu.offsetWidth || 150;
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

function closeLedgerFloatingMenu() {
    const menu = document.getElementById('ledger-floating-menu');
    if (menu) menu.classList.add('hidden');
    document.querySelectorAll('#ledger-msg-container .chat-bubble-content').forEach(el => el.classList.remove('highlight-bubble'));
    ledgerTargetMsgIndex = -1;
    setTimeout(() => { window.globalLongPressActive = false; }, 100);
}

function copyLedgerMsg(e) {
    if (e) e.stopPropagation();
    const msg = ledgerMessages[ledgerTargetMsgIndex];
    if (!msg) return closeLedgerFloatingMenu();
    const text = msg.type === 'ledger' ? formatLedgerEntryText(msg) : String(msg.content || '').replace(/^\[语音\]\s*/, '');
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => showLedgerToast('已复制')).catch(() => ledgerFallbackCopy(text));
    } else {
        ledgerFallbackCopy(text);
    }
    closeLedgerFloatingMenu();
}

function deleteLedgerMsgFromMenu() {
    if (ledgerTargetMsgIndex === -1) return;
    const msg = ledgerMessages[ledgerTargetMsgIndex];
    if (msg && msg.entryId) {
        ledgerEntries = ledgerEntries.filter(entry => entry.id !== msg.entryId);
    }
    ledgerMessages.splice(ledgerTargetMsgIndex, 1);
    saveLedgerData();
    renderLedgerSidebar();
    renderLedgerMessages();
    closeLedgerFloatingMenu();
}

function handleLedgerOutsideClick(e) {
    if (window.justOpenedLedgerMenu) {
        window.justOpenedLedgerMenu = false;
        return;
    }
    const menu = document.getElementById('ledger-floating-menu');
    if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target)) closeLedgerFloatingMenu();
}

function toggleLedgerVoiceText(e, index) {
    if (window.globalLongPressActive) {
        e.stopPropagation();
        return;
    }
    const el = document.getElementById(`ledger-voice-text-${index}`);
    if (el) el.classList.toggle('hidden');
}

function toggleLedgerSidebar() {
    const sidebar = document.getElementById('ledger-sidebar');
    const overlay = document.getElementById('ledger-sidebar-overlay');
    if (sidebar.classList.contains('open')) closeLedgerSidebar();
    else {
        renderLedgerSidebar();
        sidebar.classList.add('open');
        overlay.classList.remove('hidden');
    }
}

function closeLedgerSidebar() {
    const sidebar = document.getElementById('ledger-sidebar');
    const overlay = document.getElementById('ledger-sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.add('hidden');
}

function renderLedgerSidebar() {
    renderLedgerUserSelect();
    renderLedgerLanguageSelect();
    renderLedgerRoleList();
    renderLedgerStats();
}

function renderLedgerUserSelect() {
    const select = document.getElementById('ledger-user-select');
    if (!select) return;
    select.innerHTML = '';
    const profiles = Array.isArray(userProfiles) && userProfiles.length ? userProfiles : [user];
    if (ledgerSettings.activeProfileIdx >= profiles.length) ledgerSettings.activeProfileIdx = 0;
    profiles.forEach((profile, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.innerText = profile.profileName || profile.name || `档案 ${idx + 1}`;
        if (idx === ledgerSettings.activeProfileIdx) opt.selected = true;
        select.appendChild(opt);
    });
    select.onchange = (e) => {
        ledgerSettings.activeProfileIdx = parseInt(e.target.value, 10) || 0;
        saveLedgerData();
        renderLedgerStats();
        renderLedgerMessages();
    };
}

function renderLedgerRoleList() {
    const box = document.getElementById('ledger-role-list');
    if (!box) return;
    box.innerHTML = '';
    box.classList.toggle('collapsed', ledgerSettings.rolesCollapsed);
    const toggle = document.getElementById('ledger-role-toggle');
    if (toggle) toggle.innerText = ledgerSettings.rolesCollapsed ? '▶' : '▼';
    const enabledRoles = getLedgerEnabledRoles();
    if (enabledRoles.length === 0) {
        box.innerHTML = '<div class="empty-tip" style="margin-top:10px;">通讯录暂无可用角色</div>';
        return;
    }
    enabledRoles.forEach(role => {
        const label = document.createElement('label');
        label.className = 'ledger-role-option';
        label.innerHTML = `
            <input type="checkbox" value="${escapeLedgerHTML(role.id)}" ${ledgerSettings.selectedRoleIds.includes(role.id) ? 'checked' : ''}>
            <img src="${escapeLedgerHTML(role.avatar || '')}">
            <span>${escapeLedgerHTML(role.name || role.id)}</span>
        `;
        const input = label.querySelector('input');
        input.onchange = () => {
            if (input.checked) {
                if (!ledgerSettings.selectedRoleIds.includes(role.id)) ledgerSettings.selectedRoleIds.push(role.id);
            } else {
                ledgerSettings.selectedRoleIds = ledgerSettings.selectedRoleIds.filter(id => id !== role.id);
            }
            saveLedgerData();
        };
        box.appendChild(label);
    });
}

function renderLedgerLanguageSelect() {
    const select = document.getElementById('ledger-reply-language');
    if (!select) return;
    select.value = ledgerSettings.replyLanguage || 'zh';
    select.onchange = (e) => {
        ledgerSettings.replyLanguage = e.target.value;
        saveLedgerData();
    };
}

function toggleLedgerRolePanel() {
    ledgerSettings.rolesCollapsed = !ledgerSettings.rolesCollapsed;
    saveLedgerData();
    renderLedgerRoleList();
}

function renderLedgerStats() {
    const card = document.getElementById('ledger-stats-card');
    if (!card) return;
    const totals = getLedgerMonthlyTotals(ledgerSettings.activeProfileIdx);
    const balance = totals.income - totals.expense;
    card.innerHTML = `
        <div>本月收入：<strong>${formatLedgerAmount(totals.income)}</strong> 元</div>
        <div>本月支出：<strong>${formatLedgerAmount(totals.expense)}</strong> 元</div>
        <div>本月余额：<strong>${formatLedgerAmount(balance)}</strong> 元</div>
    `;
}

function clearLedgerData() {
    if (!confirm('确定清空记账本？账目和聊天记录都会删除。')) return;
    ledgerEntries = [];
    ledgerMessages = [];
    saveLedgerData();
    renderLedgerSidebar();
    renderLedgerMessages();
    closeLedgerSidebar();
}

function getLedgerEnabledRoles() {
    if (!Array.isArray(roles)) return [];
    return roles.filter(r => r && r.isEnabled !== false);
}

function getLedgerSelectedRoles() {
    const ids = ledgerSettings.selectedRoleIds || [];
    return getLedgerEnabledRoles().filter(r => ids.includes(r.id));
}

function getLedgerProfile(index) {
    if (Array.isArray(userProfiles) && userProfiles[index]) return userProfiles[index];
    return typeof user !== 'undefined' ? user : { name: 'User', id: '@user', avatar: '', persona: '' };
}

function formatLedgerEntryText(item) {
    const typeText = (item.entryType || item.type) === 'income' ? '收入' : '支出';
    const note = item.note ? ` (${item.note})` : '';
    return `[${typeText}] ${formatLedgerAmount(item.amount)}元${note}`;
}

function formatLedgerAmount(amount) {
    const n = Number(amount) || 0;
    return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function ledgerFormatTime(ts) {
    if (!ts) return '';
    const date = new Date(ts);
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function parseLedgerVoice(content) {
    const raw = String(content || '');
    const isVoice = raw.startsWith('[语音]');
    const text = isVoice ? raw.replace(/^\[语音\]\s*/, '').trim() : raw;
    return {
        isVoice,
        text,
        duration: Math.max(1, Math.ceil(text.length / 4) + 1)
    };
}

function escapeLedgerHTML(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setLedgerStatus(text) {
    const el = document.getElementById('ledger-title-status');
    if (el) el.innerText = text;
}

function ledgerSleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function ledgerFallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showLedgerToast('已复制');
    } catch (e) {}
    document.body.removeChild(ta);
}

function showLedgerToast(msg) {
    if (typeof showToast === 'function') {
        showToast(msg);
        return;
    }
    const toast = document.getElementById('toast-container');
    if (toast) {
        toast.innerText = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 1500);
    }
}
