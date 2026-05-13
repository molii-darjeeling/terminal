// --- SNS Core Logic ---
let snsSettings = { language: 'zh' };

function loadSnsSettings() {
    try {
        snsSettings = Object.assign(snsSettings, JSON.parse(localStorage.getItem('helios_sns_settings') || '{}'));
    } catch (e) {}
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('sns-settings-menu');
    if (!menu || menu.classList.contains('hidden')) return;
    if (!menu.contains(e.target) && !e.target.closest('.sns-menu-btn')) menu.classList.add('hidden');
});

function saveSnsSettings() {
    localStorage.setItem('helios_sns_settings', JSON.stringify(snsSettings));
}

function getSnsLanguageName() {
    return snsSettings.language === 'ja' ? 'Japanese' : 'Simplified Chinese';
}

function enterSNS() {
    loadSnsSettings();
    document.querySelectorAll('.system-page').forEach(el => el.classList.add('hidden'));
    document.getElementById('feed-page').classList.remove('hidden');
    document.getElementById('bottom-bar').classList.remove('hidden');
    document.getElementById('btn-post-trigger').classList.remove('hidden');
    document.getElementById('btn-back-trigger').classList.add('hidden');
    applyUserInfoToSNS();
    initSnsMenu();
    renderFeed();
    document.getElementById('feed-container').scrollTop = 0;
}

function initSnsMenu() {
    const select = document.getElementById('sns-language-select');
    if (select) select.value = snsSettings.language || 'zh';
}

function toggleSnsMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('sns-settings-menu');
    if (!menu) return;
    menu.classList.toggle('hidden');
    initSnsMenu();
}

function setSnsLanguage(value) {
    snsSettings.language = value || 'zh';
    saveSnsSettings();
}

function clearUnfavPosts() {
    if (!confirm("确定清空所有未收藏的朋友圈动态吗？收藏的帖子会保留。")) return;
    posts = posts.filter(p => p.isFav);
    currentPostId = null;
    saveAllData();
    document.getElementById('sns-settings-menu')?.classList.add('hidden');
    renderFeed();
    if (typeof showToast === 'function') showToast('已清空未收藏动态');
    else alert('已清空未收藏动态');
}

function exitSNS() {
    document.getElementById('feed-page').classList.add('hidden');
    document.getElementById('detail-page').classList.add('hidden');
    document.getElementById('bottom-bar').classList.add('hidden');
    showSystemPage('main-menu-page');
}

function applyUserInfoToSNS() {
    const navAvatar = document.getElementById('nav-avatar-1');
    const navName = document.getElementById('nav-name-1');
    const navId = document.getElementById('nav-id-1');
    
    // 简单的防空判断，防止页面元素未加载时报错
    if(navAvatar) navAvatar.src = user.avatar;
    if(navName) navName.innerText = user.name;
    if(navId) navId.innerText = user.id;
}

function getWorldContext() {
    // [修改] 不再读取 user.worldBooks，改为读取全局 globalWorldBooks
    if (typeof globalWorldBooks === 'undefined' || !globalWorldBooks || globalWorldBooks.length === 0) return "";
    
    // Only use Enabled entries
    const text = globalWorldBooks
        .filter(w => w.isEnabled !== false)
        .map(w => w.content)
        .filter(t => t).join("\n");
    
    if (!text) return "";
    return `[WORLD SETTING / CURRENT EVENTS]:\n${text}`;
}

function getDetailedDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return now.toLocaleDateString('en-US', options);
}

async function generateMultiPosts() {
    const enabledRoles = roles.filter(r => r.isEnabled !== false);
    if(enabledRoles.length === 0) { alert("请先在通讯录启用至少一个角色"); return; }
    
    document.getElementById('loading').classList.remove('hidden');
    const randomAuthor = enabledRoles[Math.floor(Math.random() * enabledRoles.length)];
    
    await generateAIPostWithChain(randomAuthor, enabledRoles);
    
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('feed-container').scrollTop = 0;
    saveAllData();
}

async function generateAIPostWithChain(authorRole, allEnabledRoles) {
    const worldInfo = getWorldContext();
    const languageName = getSnsLanguageName();
    const now = new Date();
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}`;
    const fullDate = getDetailedDate();
    
    let friends = [];
    let strangers = [];

    allEnabledRoles.forEach(r => {
        if (r.id === authorRole.id) return;
        if (authorRole.persona.includes(r.name)) {
            friends.push(r);
        } else {
            strangers.push(r);
        }
    });

    friends.sort(() => Math.random() - 0.5);
    strangers.sort(() => Math.random() - 0.5);

    let selectedCommenters = [...friends];
    const remainingSlots = 4 - selectedCommenters.length;
    if (remainingSlots > 0) {
        selectedCommenters = selectedCommenters.concat(strangers.slice(0, remainingSlots));
    } else {
        selectedCommenters = selectedCommenters.slice(0, 4);
    }

    const commentersInfo = selectedCommenters.map(r => `${r.name} (${r.id}): ${r.persona}`).join("\n");

    // 注意：这里使用了 data.js 中定义的 HUMAN_VIBE_PROMPT
    const sysPrompt = `
    ${HUMAN_VIBE_PROMPT}
    ${HELIOS_WORLD_CONFIG}
    [CURRENT ACTOR]
    Name: ${authorRole.name}
    ID: ${authorRole.id}
    Persona: ${authorRole.persona}
    [ENVIRONMENT]
    Date: ${fullDate}
    Time: ${timeString}
    ${worldInfo}
    Current User Info: ${user.name} (${user.id}) Persona: ${user.persona}
    [POTENTIAL COMMENTERS]
    ${commentersInfo}
    [LANGUAGE]
    Write the post and comments only in ${languageName}.

    [TASK]
    1. Write a short SNS post (max 100 chars) as the Current Actor.
    2. If date implies holiday or matches a birthday (in Persona or User Info), you may react to it.
    3. ALSO, simulate 1 to 3 immediate comments from the Potential Commenters list.
    
    [OUTPUT FORMAT - NO JSON]
    Please output using the following EXACT SEPARATORS.
    
    @@POST@@
    (Write post content here)
    @@IMG@@
    (请用中文简短描述画面内容。如果不生成图片，请输出 "No Image")
    @@COM@@
    @commenter_id (Write comment content here)
    @@COM@@
    @another_id (Write another comment...)
    `;
    
    const contentRaw = await callAI([
        {role: "system", content: sysPrompt},
        {role: "user", content: "Please generate the SNS content following the format."}
    ]);
    if(!contentRaw) return;

    let postContent = "...";
    const postParts = contentRaw.split("@@POST@@");
    if(postParts.length > 1) {
        postContent = postParts[1].split("@@")[0].trim();
    }

    let imgDesc = "Image";
    const imgParts = contentRaw.split("@@IMG@@");
    if(imgParts.length > 1) {
        imgDesc = imgParts[1].split("@@")[0].trim();
    }

    let extractedComments = [];
    const comParts = contentRaw.split("@@COM@@");
    for(let i=1; i<comParts.length; i++) {
        let line = comParts[i].trim();
        if(!line) continue;
        
        const firstSpaceIndex = line.indexOf(' ');
        if(firstSpaceIndex !== -1) {
            const idStr = line.substring(0, firstSpaceIndex).trim();
            const textStr = line.substring(firstSpaceIndex).trim();
            
            // Fixed: Strict parsing first
            let commenter = roles.find(r => r.id === idStr);
            if (!commenter) {
                 commenter = roles.find(r => idStr.startsWith(r.id)); // Fallback
            }

            if(commenter) {
                extractedComments.push({
                    commenter_id: commenter.id,
                    content: textStr
                });
            }
        }
    }

    const newPost = {
        uid: Date.now() + Math.random().toString(),
        author: authorRole,
        time: getTimestamp(),
        content: postContent,
        image: null, 
        imageDesc: imgDesc, 
        isFav: false,
        comments: []
    };

    posts.unshift(newPost);
    renderFeed();

    if (extractedComments.length > 0) {
        for (let c of extractedComments) {
            const commenter = roles.find(r => r.id === c.commenter_id);
            if (commenter) {
                const delay = Math.floor(Math.random() * 2000) + 500;
                await new Promise(r => setTimeout(r, delay));
                addCommentToPost(newPost, {
                    author: commenter,
                    time: getTimestamp(),
                    content: c.content,
                    replyTo: null
                });
            }
        }
    }
}

async function summonBatchComments() {
    const post = posts.find(p => p.uid === currentPostId);
    if(!post) return;
    if(generatingPostIds.has(post.uid)) { alert("AI 正在思考中，请稍后..."); return; }
    await summonBatchCommentsForPost(post);
}

async function summonBatchCommentsForPost(post) {
    generatingPostIds.add(post.uid);
    updateDetailStatus(post.uid);

    const now = new Date();
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}`;
    const fullDate = getDetailedDate();
    const worldInfo = getWorldContext();
    const userInfo = `User: ${user.name} (${user.id}), Persona: ${user.persona}`;
    const threadCtx = getThreadContext(post);
    const languageName = getSnsLanguageName();
    
    const enabledRoles = roles.filter(r => r.isEnabled !== false);
    
    const existingParticipantIds = new Set(post.comments.map(c => c.author.id));
    existingParticipantIds.add(post.author.id);

    let activeRoles = enabledRoles.filter(r => existingParticipantIds.has(r.id));
    
    if (activeRoles.length < 4) {
        const candidates = enabledRoles.filter(r => !existingParticipantIds.has(r.id));
        
        let friends = [];
        let strangers = [];
        
        candidates.forEach(r => {
            if (post.author.persona.includes(r.name)) friends.push(r);
            else strangers.push(r);
        });

        friends.sort(() => Math.random() - 0.5);
        strangers.sort(() => Math.random() - 0.5);

        let slotsNeeded = 4 - activeRoles.length;
        let pickFromFriends = friends.slice(0, slotsNeeded);
        activeRoles = activeRoles.concat(pickFromFriends);
        
        slotsNeeded = 4 - activeRoles.length;
        if (slotsNeeded > 0) {
            activeRoles = activeRoles.concat(strangers.slice(0, slotsNeeded));
        }
    }

    const availableRolesStr = activeRoles.map(r => `${r.name} (${r.id}): ${r.persona}`).join("\n");

    const sysPrompt = `
    ${HUMAN_VIBE_PROMPT}
    ${HELIOS_WORLD_CONFIG}
    [ENVIRONMENT]
    Date: ${fullDate}
    Time: ${timeString}
    ${worldInfo}
    [USER DATA]
    ${userInfo}
    [THREAD HISTORY]
    ${threadCtx}
    [AVAILABLE ACTORS]
    ${availableRolesStr}
    [LANGUAGE]
    Write all comments only in ${languageName}.
    [TASK]
    Decide how many characters (randomly 1 to 3) will comment now.
    
    [OUTPUT FORMAT - NO JSON]
    Output comments strictly using this separator:
    
    @@COM@@
    @role_id Comment content here
    @@COM@@
    @role_id Comment content here
    `;
    
    const rawOutput = await callAI([
        {role: "system", content: sysPrompt},
        {role: "user", content: "Please generate comments now."}
    ]);
    
    if (rawOutput) {
        const parts = rawOutput.split("@@COM@@");
        for (let i = 1; i < parts.length; i++) {
            let line = parts[i].trim();
            if(!line) continue;

            const firstSpaceIndex = line.indexOf(' ');
            if(firstSpaceIndex !== -1) {
                const idStr = line.substring(0, firstSpaceIndex).trim();
                let textStr = line.substring(firstSpaceIndex).trim();
                
                // --- 核心修复：更严格的角色匹配，防止张冠李戴 ---
                
                // 1. 尝试全匹配
                let roleObj = roles.find(r => r.id === idStr);
                // 2. 如果没找到，尝试匹配开头 (以防 AI 输出 @id: 或 @id )
                if (!roleObj) roleObj = roles.find(r => idStr.startsWith(r.id));

                // 3. 检查是否是 User 或 楼主
                if(!roleObj && user.id === idStr) roleObj = user;
                if(!roleObj && post.author.id === idStr) roleObj = post.author;

                if(roleObj) {
                    if (textStr.startsWith(post.author.id)) {
                         textStr = textStr.replace(post.author.id, "").trim();
                    }
                    
                    const delay = Math.floor(Math.random() * 2000) + 1000;
                    await new Promise(r => setTimeout(r, delay));

                    addCommentToPost(post, {
                        author: roleObj,
                        time: getTimestamp(),
                        content: textStr,
                        replyTo: null
                    });
                }
            }
        }
    }

    generatingPostIds.delete(post.uid);
    updateDetailStatus(post.uid);
    saveAllData();
}

async function submitUserPost() {
    const text = document.getElementById('upost-text').value;
    const img = document.getElementById('upost-img').value;
    const desc = document.getElementById('upost-desc').value;

    if(!text && !img && !desc) { alert("写点什么吧"); return; }
    closeUserPostModal();

    let finalImageDesc = desc;
    if(!finalImageDesc && !img) finalImageDesc = null; 

    const newPost = {
        uid: Date.now() + Math.random().toString(),
        author: user,
        time: getTimestamp(),
        content: text,
        image: img || null, 
        imageDesc: finalImageDesc || "Image",
        isFav: false,
        comments: []
    };

    posts.unshift(newPost);
    renderFeed();
    saveAllData();
    await summonBatchCommentsForPost(newPost);
}

function openReplyModal() {
    const post = posts.find(p => p.uid === currentPostId);
    if(!post) return;
    const select = document.getElementById('reply-target-select');
    select.innerHTML = "";
    
    const opOption = document.createElement('option');
    opOption.value = post.author.id;
    opOption.innerText = `楼主: ${post.author.name}`;
    select.appendChild(opOption);

    const inThreadIds = new Set(post.comments.map(c => c.author.id));
    const enabledRoles = roles.filter(r => r.isEnabled !== false);

    enabledRoles.forEach(r => {
        if(r.id === user.id || r.id === post.author.id) return;
        const opt = document.createElement('option');
        opt.value = r.id;
        if (inThreadIds.has(r.id)) {
            opt.innerText = `↪ 回复: ${r.name}`; 
        } else {
            opt.innerText = `📡 召唤: ${r.name}`; 
        }
        select.appendChild(opt);
    });

    document.getElementById('reply-text').value = "";
    document.getElementById('reply-modal').classList.remove('hidden');
}
function closeReplyModal() { document.getElementById('reply-modal').classList.add('hidden'); }

async function submitReply() {
    const text = document.getElementById('reply-text').value;
    const targetId = document.getElementById('reply-target-select').value;
    if(!text) return;
    closeReplyModal();

    const post = posts.find(p => p.uid === currentPostId);
    let contentText = text;
    const isReplyToOP = (targetId === post.author.id);
    if(!isReplyToOP) contentText = `${targetId} ${text}`;

    addCommentToPost(post, { author: user, time: getTimestamp(), content: contentText, replyTo: null });
    saveAllData();

    let targetRole = roles.find(r => r.id === targetId);
    if(!targetRole && targetId === post.author.id) targetRole = post.author;

    if(targetRole && targetRole.id !== user.id && targetId !== post.author.id) {
        await triggerTargetedAIReply(post.uid, text, targetRole);
    } else {
        await summonBatchCommentsForPost(post);
    }
}

async function triggerTargetedAIReply(postUID, userText, targetRole) {
    generatingPostIds.add(postUID);
    updateDetailStatus(postUID);
    const post = posts.find(p => p.uid === postUID);
    if(!post) return;

    const threadCtx = getThreadContext(post);
    const languageName = getSnsLanguageName();
    const sysPrompt = `
    ${HUMAN_VIBE_PROMPT}
    ${HELIOS_WORLD_CONFIG}
    [ROLE]
    You are ${targetRole.name} (${targetRole.id}).
    Persona: ${targetRole.persona}
    [USER INFO]
    Name: ${user.name}
    ID: ${user.id}
    Persona: ${user.persona}
    [CONTEXT]
    ${getThreadContext(post)}
    [LANGUAGE]
    Reply only in ${languageName}.
    [EVENT]
    User (${user.id}) just said to YOU: "${userText}"
    [TASK]
    Reply specifically to the user.
    Check User Persona: If today matches User's birthday, mention it warmly.
    Since the User is NOT the OP (unless User is OP), usually you should start with @${user.id}.
    If User IS the OP, do not use @.
    `;
    
    await new Promise(r => setTimeout(r, 1500));
    const aiReply = await callAI([
        {role: "system", content: sysPrompt},
        {role: "user", content: "Reply to the user now."}
    ]);
    
    if(aiReply) {
        const currentP = posts.find(p => p.uid === postUID);
        if(currentP) {
             addCommentToPost(currentP, { author: targetRole, time: getTimestamp(), content: aiReply });
        }
    }
    generatingPostIds.delete(postUID);
    updateDetailStatus(postUID);
    saveAllData();
}

function getThreadContext(post) {
    const header = `[Main Post by ${post.author.name} (${post.author.id})]: "${post.content}"\n[Image Context]: ${post.imageDesc || "None"}`;
    const history = post.comments.slice(-30).map(c => `[Comment by ${c.author.name} (${c.author.id})]: "${c.content}"`).join("\n");
    return `${header}\n${history || "[No comments yet]"}`;
}

function addCommentToPost(post, commentObj) {
    post.comments.push(commentObj);
    if(currentPostId === post.uid) renderComments(post);
    renderFeed(); 
}

function updateDetailStatus(uid) {
    if(currentPostId !== uid) return;
    const el = document.getElementById('detail-gen-status');
    el.innerText = generatingPostIds.has(uid) ? "AI 正在输入..." : "";
}

// --- Render UI ---
function renderFeed() {
    const container = document.getElementById('feed-container');
    // Guard clause for safety if page not loaded
    if(!container) return;
    
    container.innerHTML = "";
    let displayPosts = isFavFilterOn ? posts.filter(p => p.isFav) : posts;

    if(displayPosts.length === 0) {
        container.innerHTML = `<div class="empty-tip">${isFavFilterOn ? "没有收藏" : "暂无动态"}</div>`;
        return;
    }
    displayPosts.forEach(post => {
        let mediaHtml = "";
        if(post.image && post.image.startsWith('http')) {
            mediaHtml = `<img src="${post.image}">`;
        } else {
            mediaHtml = `<div class="card-media-text">${post.imageDesc || "Image"}</div>`;
        }
        const starClass = post.isFav ? "star-icon star-active" : "star-icon";
        const div = document.createElement('div');
        div.className = "post-wrapper";
        div.innerHTML = `
            <div class="post-meta-outside">
                <img src="${post.author.avatar}" class="avatar">
                <span class="meta-name">${post.author.name}</span>
                <span class="meta-id">${post.author.id}</span>
                <span class="meta-time">${post.time}</span>
                <span class="action-dots post-action-dots" onclick="openActionMenu('post', '${post.uid}', -1)">···</span>
            </div>
            <div class="sns-card" onclick="openDetail('${post.uid}')">
                <div class="card-media">${mediaHtml}</div>
                <div class="card-body">${post.content}</div>
            </div>
            <div class="post-footer-row">
                <div class="footer-icons">
                    <span onclick="toggleLikeInFeed(event, '${post.uid}')">♥</span>
                    <span class="${starClass}" onclick="toggleFavInFeed(event, '${post.uid}')">★</span>
                    <span class="comment-count-badge">💬 ${post.comments.length}</span>
                </div>
                <div class="skew-btn" onclick="openDetail('${post.uid}')">
                    <span>查看评论</span>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function openDetail(uid) {
    const post = posts.find(p => p.uid === uid);
    if(!post) return;
    currentPostId = uid;
    document.getElementById('feed-page').classList.add('hidden');
    document.getElementById('detail-page').classList.remove('hidden');
    document.getElementById('btn-back-trigger').classList.remove('hidden');
    document.getElementById('btn-post-trigger').classList.add('hidden');
    document.getElementById('p2-avatar').src = post.author.avatar;
    document.getElementById('p2-name').innerText = post.author.name;
    document.getElementById('p2-id').innerText = post.author.id;
    document.getElementById('detail-time-display').innerText = post.time;
    document.getElementById('card-body').innerText = post.content;
    
    const mediaDiv = document.getElementById('card-media');
    if(post.image && post.image.startsWith('http')) {
        mediaDiv.innerHTML = `<img src="${post.image}">`;
    } else {
        mediaDiv.innerHTML = `<div class="card-media-text">${post.imageDesc || "Image"}</div>`;
    }
    updateDetailIcons(post);
    updateDetailStatus(uid);
    renderComments(post);
}

function renderComments(post) {
    const container = document.getElementById('comments-container');
    container.innerHTML = "";
    post.comments.forEach((c, index) => {
        const div = document.createElement('div');
        div.className = "comment-item";
        let contentHtml = c.content.replace(/(@\w+)/g, '<span class="reply-highlight">$1</span>');
        div.innerHTML = `
            <div class="comment-header">
                <div class="c-left">
                    <img src="${c.author.avatar}" class="avatar">
                    <span class="c-name">${c.author.name}</span>
                    <span class="c-id">${c.author.id}</span>
                </div>
                <div class="c-right">
                    <span class="c-time">${c.time}</span>
                    <span class="action-dots" onclick="openActionMenu('comment', '${post.uid}', ${index})">···</span>
                </div>
            </div>
            <div class="comment-bubble-row">
                <div class="comment-bubble">${contentHtml}</div>
                <div class="comment-heart" onclick="toggleHeart(this)">♥</div>
            </div>
        `;
        container.appendChild(div);
    });
}

function updateDetailIcons(post) {
    const starBtn = document.getElementById('detail-star-btn');
    if(post.isFav) starBtn.classList.add('star-active');
    else starBtn.classList.remove('star-active');
    document.getElementById('detail-heart-btn').classList.remove('active-icon');
}

function openUserPostModal() {
    document.getElementById('upost-text').value = "";
    document.getElementById('upost-img').value = "";
    document.getElementById('upost-desc').value = "";
    document.getElementById('user-post-modal').classList.remove('hidden');
}
function closeUserPostModal() { document.getElementById('user-post-modal').classList.add('hidden'); }
function openActionMenu(type, uid, idx) {
    actionTarget = { type, uid, commentIndex: idx };
    document.getElementById('action-menu-modal').classList.remove('hidden');
}
function closeActionMenu() { document.getElementById('action-menu-modal').classList.add('hidden'); }
function handleDeleteAction() {
    if(!confirm("确定要删除吗？")) return;
    const { type, uid, commentIndex } = actionTarget;
    if(type === 'post') {
        const idx = posts.findIndex(p => p.uid === uid);
        if(idx > -1) posts.splice(idx, 1);
        if(currentPostId === uid) goBack();
        renderFeed();
    } else if(type === 'comment') {
        const post = posts.find(p => p.uid === uid);
        if(post) post.comments.splice(commentIndex, 1);
        if(currentPostId === uid) renderComments(post);
    }
    saveAllData();
    closeActionMenu();
}
function handleEditAction() {
    const { type, uid, commentIndex } = actionTarget;
    let currentContent = "";
    const post = posts.find(p => p.uid === uid);
    if(type === 'post') currentContent = post.content;
    else if(type === 'comment') currentContent = post.comments[commentIndex].content;
    document.getElementById('edit-text-input').value = currentContent;
    closeActionMenu();
    document.getElementById('edit-content-modal').classList.remove('hidden');
}
function closeEditModal() { document.getElementById('edit-content-modal').classList.add('hidden'); }
function saveEditContent() {
    const newContent = document.getElementById('edit-text-input').value;
    const { type, uid, commentIndex } = actionTarget;
    const post = posts.find(p => p.uid === uid);
    if(type === 'post') {
        post.content = newContent;
        if(currentPostId === uid) document.getElementById('card-body').innerText = newContent;
    } else if(type === 'comment') {
        post.comments[commentIndex].content = newContent;
        if(currentPostId === uid) renderComments(post);
    }
    saveAllData();
    renderFeed();
    closeEditModal();
}
function toggleFavFilter() {
    isFavFilterOn = !isFavFilterOn;
    document.getElementById('fav-filter-btn').classList.toggle('active');
    renderFeed();
}
function toggleLikeInFeed(e) { e.stopPropagation(); e.target.classList.toggle('active-icon'); }
function toggleFavInFeed(e, uid) {
    e.stopPropagation();
    const post = posts.find(p => p.uid === uid);
    if(post) { post.isFav = !post.isFav; renderFeed(); saveAllData(); }
}
function toggleFavCurrent() {
    const post = posts.find(p => p.uid === currentPostId);
    if(post) { post.isFav = !post.isFav; updateDetailIcons(post); saveAllData(); }
}
function toggleLikeCurrent() { document.getElementById('detail-heart-btn').classList.toggle('active-icon'); }
function goBack() {
    currentPostId = null;
    document.getElementById('detail-page').classList.add('hidden');
    document.getElementById('feed-page').classList.remove('hidden');
    document.getElementById('btn-back-trigger').classList.add('hidden');
    document.getElementById('btn-post-trigger').classList.remove('hidden');
    renderFeed();
}
function toggleHeart(el) { el.classList.toggle('active-icon'); }
