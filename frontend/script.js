const API_URL = '/api';
let isLogin = true;
let token = localStorage.getItem('familyhub_token');
let currentUser = localStorage.getItem('familyhub_user');

let editingPostId = null;
let deletingPostId = null;
let currentChatUserId = null;
let messagesPollingInterval = null;
let editingMessageId = null;
let deletingMessageId = null;
let myUserId = null;

let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingTimerInterval = null;
let isRecording = false;

let onlineStatusInterval = null;

const userAvatarsCache = {};

const savedTheme = localStorage.getItem('familyhub_theme') || 'default';
setTheme(savedTheme, false);

if (token) { showMainApp(); }

// ===== БОКОВОЕ МЕНЮ =====
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('active');
    document.getElementById('hamburger-btn').classList.toggle('active');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
    document.getElementById('hamburger-btn').classList.remove('active');
}

// ===== LIGHTBOX =====
function openLightbox(imageSrc, caption) {
    document.getElementById('lightbox-img').src = imageSrc;
    document.getElementById('lightbox-caption').textContent = caption || '';
    document.getElementById('lightbox').classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeLightbox(event) {
    if (event.target.id === 'lightbox' || event.target.classList.contains('lightbox-close')) {
        document.getElementById('lightbox').classList.remove('active');
        document.body.style.overflow = '';
    }
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        document.getElementById('lightbox').classList.remove('active');
        document.body.style.overflow = '';
        closeEditModal();
        closeDeleteModal();
        closeNewChatModal();
        closeEditMessageModal();
        closeDeleteMessageModal();
        closeEditProfileModal();
        closeAddFriendModal();
    }
});

// ===== МОДАЛКИ ПОСТОВ =====
function openEditModal(postId, title, content) {
    editingPostId = postId;
    document.getElementById('edit-title').value = title;
    document.getElementById('edit-content').value = content;
    document.getElementById('edit-modal').classList.add('active');
}
function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('active');
    editingPostId = null;
}
function openDeleteModal(postId) {
    deletingPostId = postId;
    document.getElementById('delete-modal').classList.add('active');
}
function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('active');
    deletingPostId = null;
}
async function saveEdit() {
    const title = document.getElementById('edit-title').value.trim();
    const content = document.getElementById('edit-content').value.trim();
    if (!title || !content) { alert('Заполните заголовок и текст'); return; }
    try {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        const res = await fetch(API_URL + '/posts/' + editingPostId, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });
        if (res.ok) {
            closeEditModal();
            loadPosts();
            if (document.getElementById('page-profile').classList.contains('active')) loadMyPosts();
        } else {
            const data = await res.json();
            alert(formatError(data));
        }
    } catch (e) { alert('Ошибка: ' + e.message); }
}
async function confirmDelete() {
    try {
        const res = await fetch(API_URL + '/posts/' + deletingPostId, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok || res.status === 204) {
            closeDeleteModal();
            loadPosts();
            if (document.getElementById('page-profile').classList.contains('active')) loadMyPosts();
        } else {
            const data = await res.json();
            alert(formatError(data));
        }
    } catch (e) { alert('Ошибка: ' + e.message); }
}

// ===== НОВЫЙ ЧАТ =====
async function openNewChatModal() {
    const modal = document.getElementById('new-chat-modal');
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Загрузка...</p>';
    modal.classList.add('active');

    try {
        const res = await fetch(API_URL + '/messages/users', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const users = await res.json();
        if (users.length === 0) {
            usersList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Нет других пользователей</p>';
            return;
        }
        usersList.innerHTML = users.map(function(user) {
            const initial = user.username[0].toUpperCase();
            const avatarHtml = userAvatarsCache[user.id]
                ? '<img src="/' + userAvatarsCache[user.id].replace(/\\/g, '/') + '">'
                : initial;
            return '<div class="user-list-item" onclick="startChat(' + user.id + ')">' +
                '<div class="chat-avatar">' + avatarHtml + '</div>' +
                '<div class="chat-info"><div class="chat-name">' + escapeHtml(user.username) + '</div></div>' +
            '</div>';
        }).join('');
    } catch (e) {
        usersList.innerHTML = '<p style="color: #e74c3c; text-align: center; padding: 20px;">Ошибка загрузки</p>';
    }
}
function closeNewChatModal() {
    document.getElementById('new-chat-modal').classList.remove('active');
}
function startChat(userId) {
    closeNewChatModal();
    openChat(userId);
}

// ===== МОДАЛКИ СООБЩЕНИЙ =====
function openEditMessageModal(messageId, text) {
    editingMessageId = messageId;
    document.getElementById('edit-message-text').value = text;
    document.getElementById('edit-message-modal').classList.add('active');
}
function closeEditMessageModal() {
    document.getElementById('edit-message-modal').classList.remove('active');
    editingMessageId = null;
}
function openDeleteMessageModal(messageId) {
    deletingMessageId = messageId;
    document.getElementById('delete-message-modal').classList.add('active');
}
function closeDeleteMessageModal() {
    document.getElementById('delete-message-modal').classList.remove('active');
    deletingMessageId = null;
}
async function saveEditMessage() {
    const text = document.getElementById('edit-message-text').value.trim();
    if (!text) { alert('Сообщение не может быть пустым'); return; }
    try {
        const res = await fetch(API_URL + '/messages/' + editingMessageId, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        });
        if (res.ok) {
            closeEditMessageModal();
            if (currentChatUserId) refreshMessages(currentChatUserId);
        } else {
            const data = await res.json();
            alert(formatError(data));
        }
    } catch (e) { alert('Ошибка: ' + e.message); }
}
async function confirmDeleteMessage() {
    try {
        const res = await fetch(API_URL + '/messages/' + deletingMessageId, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) {
            closeDeleteMessageModal();
            if (currentChatUserId) {
                refreshMessages(currentChatUserId);
                loadChats();
            }
        } else {
            const data = await res.json();
            alert(formatError(data));
        }
    } catch (e) { alert('Ошибка: ' + e.message); }
}

// ===== ГОЛОСОВЫЕ СООБЩЕНИЯ =====
async function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = function(event) {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = function() {
            stream.getTracks().forEach(track => track.stop());
            sendVoiceMessage();
        };

        mediaRecorder.start();
        isRecording = true;
        recordingStartTime = Date.now();

        showRecordingIndicator();
        recordingTimerInterval = setInterval(updateRecordingTimer, 1000);

        const micBtn = document.getElementById('mic-btn');
        if (micBtn) micBtn.classList.add('recording');
    } catch (err) {
        alert('Не удалось получить доступ к микрофону: ' + err.message);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    isRecording = false;
    clearInterval(recordingTimerInterval);
    hideRecordingIndicator();

    const micBtn = document.getElementById('mic-btn');
    if (micBtn) micBtn.classList.remove('recording');
}

function showRecordingIndicator() {
    let container = document.getElementById('recording-indicator');
    if (!container) {
        container = document.createElement('div');
        container.id = 'recording-indicator';
        container.className = 'recording-indicator';
        container.innerHTML = '<div class="rec-dot"></div><span class="rec-timer" id="rec-timer">0:00</span><button onclick="stopRecording()">Отправить</button><button onclick="cancelRecording()" style="background: #999;">Отмена</button>';
        const chatArea = document.getElementById('chat-area');
        if (chatArea) {
            const inputArea = chatArea.querySelector('.message-input-area');
            if (inputArea) {
                chatArea.insertBefore(container, inputArea);
            }
        }
    }
}

function hideRecordingIndicator() {
    const container = document.getElementById('recording-indicator');
    if (container) container.remove();
}

function updateRecordingTimer() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timerEl = document.getElementById('rec-timer');
    if (timerEl) {
        timerEl.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    }
}

function cancelRecording() {
    audioChunks = [];
    stopRecording();
}

async function sendVoiceMessage() {
    if (audioChunks.length === 0) return;

    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const file = new File([audioBlob], 'voice_message.webm', { type: 'audio/webm' });

    try {
        const formData = new FormData();
        formData.append('text', '🎙️ Голосовое сообщение');
        formData.append('attachment', file);

        const res = await fetch(API_URL + '/messages/send?receiver_id=' + currentChatUserId, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });

        if (res.ok) {
            refreshMessages(currentChatUserId);
            loadChats();
        } else {
            const data = await res.json();
            alert(formatError(data));
        }
    } catch (e) {
        alert('Ошибка отправки: ' + e.message);
    }
}

// ===== АВАТАРКИ И ОБЛОЖКИ =====
async function uploadAvatar() {
    const input = document.getElementById('avatar-input');
    if (!input.files[0]) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const avatarImg = document.getElementById('avatar-image');
        const avatarInitial = document.getElementById('avatar-initial');
        avatarImg.src = e.target.result;
        avatarImg.style.display = 'block';
        avatarInitial.style.display = 'none';
    };
    reader.readAsDataURL(input.files[0]);

    try {
        const formData = new FormData();
        formData.append('avatar', input.files[0]);

        const res = await fetch(API_URL + '/users/avatar', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            userAvatarsCache[myUserId] = data.avatar_path;
            displayAvatar(data.avatar_path);
            updateSidebarAvatar();
            alert('✅ Аватар обновлён!');
        } else {
            const data = await res.json();
            alert(formatError(data));
            loadProfile();
        }
    } catch (e) {
        alert('Ошибка: ' + e.message);
        loadProfile();
    }
}

async function uploadCover() {
    const input = document.getElementById('cover-input');
    if (!input.files[0]) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const coverImg = document.getElementById('cover-image');
        coverImg.src = e.target.result;
        coverImg.style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);

    try {
        const formData = new FormData();
        formData.append('cover', input.files[0]);

        const res = await fetch(API_URL + '/users/cover', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });

        if (res.ok) {
            // Принудительно обновляем обложку с cache-busting
            displayCover(coverPath);  // или передай путь из ответа сервера
            alert('✅ Обложка обновлена!');
        } else {
            const data = await res.json();
            alert(formatError(data));
            loadProfile();
        }
    } catch (e) {
        alert('Ошибка: ' + e.message);
        loadProfile();
    }
}

function displayAvatar(avatarPath) {
    const avatarImg = document.getElementById('avatar-image');
    const avatarInitial = document.getElementById('avatar-initial');

    if (avatarPath) {
        const normalizedPath = avatarPath.replace(/\\/g, '/');
        // Добавляем timestamp чтобы избежать кэширования
        avatarImg.src = '/' + normalizedPath + '?t=' + Date.now();
        avatarImg.style.display = 'block';
        avatarInitial.style.display = 'none';
    } else {
        avatarImg.style.display = 'none';
        avatarInitial.style.display = 'block';
    }
}

function displayCover(coverPath) {
    const coverImg = document.getElementById('cover-image');

    if (coverPath) {
        const normalizedPath = coverPath.replace(/\\/g, '/');
        // Добавляем timestamp чтобы избежать кэширования
        coverImg.src = '/' + normalizedPath + '?t=' + Date.now();
        coverImg.style.display = 'block';
    } else {
        coverImg.style.display = 'none';
    }
}

function updateSidebarAvatar() {
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    if (userAvatarsCache[myUserId]) {
        const normalizedPath = userAvatarsCache[myUserId].replace(/\\/g, '/');
        // Добавляем timestamp
        sidebarAvatar.innerHTML = '<img src="/' + normalizedPath + '?t=' + Date.now() + '">';
    } else {
        sidebarAvatar.textContent = '👤';
    }
}

// ===== РЕДАКТИРОВАНИЕ ПРОФИЛЯ =====
function openEditProfileModal() {
    document.getElementById('edit-full-name').value = document.getElementById('profile-full-name').dataset.fullName || '';
    document.getElementById('edit-birth-year').value = document.getElementById('profile-birth-year').dataset.birthYear || '';
    document.getElementById('edit-workplace').value = document.getElementById('profile-workplace').dataset.workplace || '';
    document.getElementById('edit-bio').value = document.getElementById('profile-bio-display').textContent || '';
    document.getElementById('edit-profile-modal').classList.add('active');
}

function closeEditProfileModal() {
    document.getElementById('edit-profile-modal').classList.remove('active');
}

async function saveProfile() {
    const fullName = document.getElementById('edit-full-name').value.trim();
    const birthYear = document.getElementById('edit-birth-year').value.trim();
    const workplace = document.getElementById('edit-workplace').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();

    try {
        const res = await fetch(API_URL + '/users/profile', {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                full_name: fullName || null,
                birth_year: birthYear ? parseInt(birthYear) : null,
                workplace: workplace || null,
                bio: bio || null
            })
        });

        if (res.ok) {
            closeEditProfileModal();
            loadProfile();
            alert('✅ Профиль обновлён!');
        } else {
            const data = await res.json();
            alert(formatError(data));
        }
    } catch (e) {
        alert('Ошибка: ' + e.message);
    }
}

function displayProfileDetails(user) {
    const fullNameEl = document.getElementById('profile-full-name');
    fullNameEl.textContent = user.full_name || user.username;
    fullNameEl.dataset.fullName = user.full_name || '';

    const birthYearEl = document.getElementById('profile-birth-year');
    if (user.birth_year) {
        const age = new Date().getFullYear() - user.birth_year;
        birthYearEl.querySelector('.detail-text').textContent = user.birth_year + ' г.р. (' + age + ' лет)';
        birthYearEl.style.display = 'flex';
        birthYearEl.dataset.birthYear = user.birth_year;
    } else {
        birthYearEl.style.display = 'none';
    }

    const workplaceEl = document.getElementById('profile-workplace');
    if (user.workplace) {
        workplaceEl.querySelector('.detail-text').textContent = user.workplace;
        workplaceEl.style.display = 'flex';
        workplaceEl.dataset.workplace = user.workplace;
    } else {
        workplaceEl.style.display = 'none';
    }
}

async function loadProfile() {
    try {
        const res = await fetch(API_URL + '/users/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (res.ok) {
            const user = await res.json();
            myUserId = user.id;
            document.getElementById('profile-username').textContent = '@' + user.username;
            document.getElementById('avatar-initial').textContent = (user.full_name || user.username)[0].toUpperCase();

            displayAvatar(user.avatar_path);
            displayCover(user.cover_path);
            displayProfileDetails(user);

            document.getElementById('profile-bio-display').textContent = user.bio || '';

            userAvatarsCache[user.id] = user.avatar_path;
            updateSidebarAvatar();
        }
    } catch (e) {
        console.error('Ошибка загрузки профиля:', e);
    }
}

// ===== СТАТУС ОНЛАЙН =====
async function setOnlineStatus() {
    try {
        await fetch(API_URL + '/users/status/online', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });
    } catch (e) {
        console.error('Ошибка обновления статуса:', e);
    }
}

async function setOfflineStatus() {
    try {
        await fetch(API_URL + '/users/status/offline', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });
    } catch (e) {
        console.error('Ошибка установки оффлайн:', e);
    }
}

async function getUserStatus(userId) {
    try {
        const res = await fetch(API_URL + '/users/status/' + userId, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error('Ошибка получения статуса:', e);
    }
    return { is_online: false, last_seen: null };
}

function formatLastSeen(isoString) {
    if (!isoString) return 'неизвестно';

    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'только что';
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return minutes + ' мин назад';
    }
    if (diff < 86400000) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

if (token) {
    setOnlineStatus();
    onlineStatusInterval = setInterval(setOnlineStatus, 30000);
}

window.addEventListener('beforeunload', function() {
    if (token) setOfflineStatus();
});

document.addEventListener('visibilitychange', function() {
    if (document.hidden && token) {
        setOfflineStatus();
    } else if (!document.hidden && token) {
        setOnlineStatus();
    }
});

// ===== ЧАТЫ =====
async function loadChats() {
    const content = document.getElementById('chats-list-content');
    try {
        const res = await fetch(API_URL + '/messages/chats', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const chats = await res.json();
        if (chats.length === 0) {
            content.innerHTML = '<div class="empty-chats">У вас пока нет чатов.<br>Нажмите + чтобы начать новый.</div>';
            return;
        }
        content.innerHTML = chats.map(function(chat) {
            const initial = chat.username[0].toUpperCase();
            const time = chat.last_message_time ? formatTime(chat.last_message_time) : '';
            const unread = chat.unread_count > 0 ? '<div class="unread-badge">' + chat.unread_count + '</div>' : '';
            const isActive = currentChatUserId === chat.id ? 'active' : '';
            const avatarHtml = userAvatarsCache[chat.id]
                ? '<img src="/' + userAvatarsCache[chat.id].replace(/\\/g, '/') + '">'
                : initial;
            return '<div class="chat-item ' + isActive + '" onclick="openChat(' + chat.id + ')">' +
                '<div class="chat-avatar">' + avatarHtml + '</div>' +
                '<div class="chat-info">' +
                    '<div class="chat-name">' + escapeHtml(chat.username) + '</div>' +
                    '<div class="chat-last-message">' + escapeHtml(chat.last_message || '') + '</div>' +
                '</div>' +
                '<div class="chat-meta">' +
                    '<div class="chat-time">' + time + '</div>' +
                    unread +
                '</div>' +
            '</div>';
        }).join('');
    } catch (e) {
        console.error('Ошибка загрузки чатов:', e);
    }
}

async function openChat(userId) {
    currentChatUserId = userId;
    document.querySelectorAll('.chat-item').forEach(function(item) { item.classList.remove('active'); });
    loadChats();

    const chatArea = document.getElementById('chat-area');
    chatArea.innerHTML = '<div class="no-chat-selected">Загрузка...</div>';

    if (!myUserId) {
        try {
            const meRes = await fetch(API_URL + '/users/me', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (meRes.ok) {
                const meData = await meRes.json();
                myUserId = meData.id;
            }
        } catch (e) {
            console.error('Ошибка получения своего ID:', e);
        }
    }

    try {
        const usersRes = await fetch(API_URL + '/messages/users', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const users = await usersRes.json();
        const otherUser = users.find(function(u) { return u.id === userId; });

        if (!otherUser) {
            chatArea.innerHTML = '<div class="no-chat-selected">Пользователь не найден</div>';
            return;
        }

        const messagesRes = await fetch(API_URL + '/messages/chat/' + userId, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!messagesRes.ok) {
            throw new Error('Ошибка получения истории: ' + messagesRes.status);
        }
        const messages = await messagesRes.json();

        const statusData = await getUserStatus(userId);
        const statusClass = statusData.is_online ? 'online' : 'offline';
        const statusText = statusData.is_online ? 'в сети' : 'был(а) ' + formatLastSeen(statusData.last_seen);

        const initial = otherUser.username[0].toUpperCase();
        const avatarHtml = userAvatarsCache[userId]
            ? '<img src="/' + userAvatarsCache[userId].replace(/\\/g, '/') + '">'
            : initial;

        chatArea.innerHTML =
            '<div class="chat-header">' +
                '<div class="chat-header-avatar">' +
                    avatarHtml +
                    '<div class="online-indicator ' + statusClass + '"></div>' +
                '</div>' +
                '<div>' +
                    '<div class="chat-header-name">' + escapeHtml(otherUser.username) + '</div>' +
                    '<div class="chat-header-status ' + statusClass + '">' + statusText + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="messages-area" id="messages-area">' +
                (messages.length === 0 ? '<div class="empty-state">Нет сообщений. Напишите первое!</div>' : '') +
                messages.map(function(msg) { return renderMessage(msg); }).join('') +
            '</div>' +
            '<div id="attachment-preview-container"></div>' +
            '<div class="message-input-area">' +
                '<input type="file" id="message-attachment" style="display: none;" accept="image/*,.pdf,.doc,.docx,.txt" onchange="onAttachmentSelected()">' +
                '<button class="attach-btn" onclick="document.getElementById(\'message-attachment\').click()" title="Прикрепить файл">📎</button>' +
                '<button class="mic-btn" id="mic-btn" onclick="toggleRecording()" title="Голосовое сообщение">🎙️</button>' +
                '<input type="text" id="message-input" placeholder="Написать сообщение..." onkeypress="if(event.key===\'Enter\') sendMessage()">' +
                '<button class="send-btn" onclick="sendMessage()"></button>' +
            '</div>';

        const messagesArea = document.getElementById('messages-area');
        if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;

        startMessagesPolling(userId);
    } catch (e) {
        console.error('Ошибка открытия чата:', e);
        chatArea.innerHTML = '<div class="no-chat-selected">Ошибка: ' + e.message + '</div>';
    }
}

function renderMessage(msg) {
    const isSent = msg.sender_id != currentChatUserId;
    const time = new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const isEdited = msg.updated_at && msg.updated_at !== msg.created_at;
    const isOwner = myUserId && msg.sender_id == myUserId;

    let attachmentHtml = '';
    if (msg.attachment_path) {
        const normalizedPath = msg.attachment_path.replace(/\\/g, '/');
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(normalizedPath);
        const isAudio = /\.(webm|mp3|wav|ogg|m4a)$/i.test(normalizedPath);

        if (isImage) {
            attachmentHtml = '<div class="message-attachment"><img src="/' + normalizedPath + '" onclick="openLightbox(\'/' + normalizedPath + '\', \'Вложение\')"></div>';
        } else if (isAudio) {
            attachmentHtml = renderVoiceMessage('/' + normalizedPath);
        } else {
            attachmentHtml = '<div class="message-attachment"><a href="/' + normalizedPath + '" target="_blank">📎 ' + escapeHtml(normalizedPath.split('/').pop()) + '</a></div>';
        }
    }

    const actionsHtml = isOwner ?
        '<div class="message-actions">' +
            '<button class="msg-edit-btn" onclick="openEditMessageModal(' + msg.id + ', \'' + escapeHtml(msg.text).replace(/'/g, "\\'") + '\')">✏️</button>' +
            '<button class="msg-delete-btn" onclick="openDeleteMessageModal(' + msg.id + ')">️</button>' +
        '</div>'
        : '';

    return '<div class="message ' + (isSent ? 'sent' : 'received') + '">' +
        '<div class="message-text">' + escapeHtml(msg.text) + (isEdited ? ' <span class="message-edited">(изменено)</span>' : '') + '</div>' +
        attachmentHtml +
        '<div class="message-time">' + time + '</div>' +
        actionsHtml +
    '</div>';
}

function renderVoiceMessage(audioPath) {
    const bars = Array.from({length: 30}, () => {
        const height = Math.floor(Math.random() * 25) + 5;
        return '<div class="voice-bar" style="height: ' + height + 'px;"></div>';
    }).join('');

    return '<div class="voice-message">' +
        '<button class="voice-play-btn" onclick="toggleAudioPlay(this, \'' + audioPath + '\')">▶</button>' +
        '<div class="voice-waveform">' + bars + '</div>' +
        '<div class="voice-duration">0:00</div>' +
        '<audio src="' + audioPath + '" style="display: none;" onloadedmetadata="updateDuration(this)" ontimeupdate="updateProgress(this)"></audio>' +
    '</div>';
}

function toggleAudioPlay(btn, audioPath) {
    const voiceMsg = btn.closest('.voice-message');
    const audio = voiceMsg.querySelector('audio');

    if (audio.paused) {
        document.querySelectorAll('audio').forEach(a => {
            if (a !== audio) {
                a.pause();
                a.currentTime = 0;
                const otherBtn = a.closest('.voice-message').querySelector('.voice-play-btn');
                if (otherBtn) otherBtn.textContent = '▶';
            }
        });

        audio.play();
        btn.textContent = '⏸';
    } else {
        audio.pause();
        btn.textContent = '▶';
    }

    audio.onended = function() {
        btn.textContent = '▶';
        audio.currentTime = 0;
    };
}

function updateDuration(audio) {
    const voiceMsg = audio.closest('.voice-message');
    const durationEl = voiceMsg.querySelector('.voice-duration');
    const duration = audio.duration;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    durationEl.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

function updateProgress(audio) {
    const voiceMsg = audio.closest('.voice-message');
    const durationEl = voiceMsg.querySelector('.voice-duration');
    const currentTime = audio.currentTime;
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    durationEl.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

function startMessagesPolling(userId) {
    if (messagesPollingInterval) clearInterval(messagesPollingInterval);
    messagesPollingInterval = setInterval(function() {
        if (currentChatUserId === userId) refreshMessages(userId);
    }, 2000);
}

async function refreshMessages(userId) {
    try {
        const res = await fetch(API_URL + '/messages/chat/' + userId, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const messages = await res.json();
        const messagesArea = document.getElementById('messages-area');
        if (!messagesArea) return;

        const newHtml = messages.map(function(msg) { return renderMessage(msg); }).join('');
        if (messagesArea.children.length !== messages.length) {
            messagesArea.innerHTML = newHtml;
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
    } catch (e) {
        console.error('Ошибка обновления сообщений:', e);
    }
}

function onAttachmentSelected() {
    const input = document.getElementById('message-attachment');
    const container = document.getElementById('attachment-preview-container');
    if (input.files.length > 0) {
        container.innerHTML = '<div class="attachment-preview"> ' + escapeHtml(input.files[0].name) +
            ' <button class="remove-attachment" onclick="removeAttachment()">✕</button></div>';
    } else {
        container.innerHTML = '';
    }
}

function removeAttachment() {
    document.getElementById('message-attachment').value = '';
    document.getElementById('attachment-preview-container').innerHTML = '';
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const attachmentInput = document.getElementById('message-attachment');
    const text = input.value.trim();

    if (!text && !attachmentInput.files[0]) return;
    if (!currentChatUserId) return;

    try {
        const formData = new FormData();
        formData.append('text', text || '📎 Файл');
        if (attachmentInput.files[0]) {
            formData.append('attachment', attachmentInput.files[0]);
        }

        const res = await fetch(API_URL + '/messages/send?receiver_id=' + currentChatUserId, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });

        if (res.ok) {
            input.value = '';
            attachmentInput.value = '';
            document.getElementById('attachment-preview-container').innerHTML = '';
            refreshMessages(currentChatUserId);
            loadChats();
        } else {
            const data = await res.json();
            alert(formatError(data));
        }
    } catch (e) {
        alert('Ошибка отправки: ' + e.message);
    }
}

function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' мин';
    if (diff < 86400000) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

// ===== АВТОРИЗАЦИЯ =====
function toggleAuth() {
    isLogin = !isLogin;
    document.getElementById('auth-title').textContent = isLogin ? 'Вход' : 'Регистрация';
    document.getElementById('auth-btn').textContent = isLogin ? 'Войти' : 'Зарегистрироваться';
    document.getElementById('auth-toggle').textContent = isLogin
        ? 'Нет аккаунта? Зарегистрироваться'
        : 'Уже есть аккаунт? Войти';
    document.getElementById('auth-message').textContent = '';
}

function formatError(data) {
    if (!data) return 'Неизвестная ошибка';
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
        return data.detail.map(function(e) { if (e.msg) return e.msg; return JSON.stringify(e); }).join('; ');
    }
    if (data.detail) return JSON.stringify(data.detail);
    return 'Ошибка';
}

async function handleAuth() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const msg = document.getElementById('auth-message');
    if (!username || !password) { msg.innerHTML = '<div class="error">Заполните все поля</div>'; return; }

    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    try {
        let res;
        if (isLogin) {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);
            res = await fetch(API_URL + endpoint, { method: 'POST', body: formData });
        } else {
            res = await fetch(API_URL + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, email: username + '@familyhub.com', password: password })
            });
        }
        const data = await res.json();
        if (res.ok) {
            if (data.access_token) {
                token = data.access_token;
                currentUser = username;
                localStorage.setItem('familyhub_token', token);
                localStorage.setItem('familyhub_user', username);
                showMainApp();
            } else {
                msg.innerHTML = '<div class="success">Регистрация успешна! Теперь войдите.</div>';
                if (!isLogin) setTimeout(function() { toggleAuth(); }, 1500);
            }
        } else {
            msg.innerHTML = '<div class="error">' + formatError(data) + '</div>';
        }
    } catch (e) {
        msg.innerHTML = '<div class="error">Ошибка соединения: ' + e.message + '</div>';
    }
}

function showMainApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('sidebar-username').textContent = '@' + (currentUser || 'user');
    showPage('feed', document.querySelector('.menu-item.active'));
}

function showPage(pageName, element) {
    document.querySelectorAll('.page').forEach(function(page) { page.classList.remove('active'); });
    document.querySelectorAll('.menu-item').forEach(function(item) { item.classList.remove('active'); });
    document.getElementById('page-' + pageName).classList.add('active');
    if (element) element.classList.add('active');
    closeSidebar();

    if (pageName !== 'messages' && messagesPollingInterval) {
        clearInterval(messagesPollingInterval);
        messagesPollingInterval = null;
    }

    if (pageName === 'feed') loadPosts();
    else if (pageName === 'profile') {
        loadProfile();
        loadMyPosts();
    }
    else if (pageName === 'settings') updateThemeSelection();
    else if (pageName === 'messages') loadChats();
    else if (pageName === 'friends') {
        switchFriendsTab('friends', document.querySelector('.tab-btn'));
    }
}

function logout() {
    if (messagesPollingInterval) clearInterval(messagesPollingInterval);
    if (onlineStatusInterval) clearInterval(onlineStatusInterval);
    if (isRecording) stopRecording();
    if (token) setOfflineStatus();
    localStorage.removeItem('familyhub_token');
    localStorage.removeItem('familyhub_user');
    token = null;
    currentUser = null;
    location.reload();
}

function setTheme(themeName, save = true) {
    document.documentElement.setAttribute('data-theme', themeName);
    if (save) localStorage.setItem('familyhub_theme', themeName);
    updateThemeSelection();
}

function updateThemeSelection() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'default';
    document.querySelectorAll('.theme-card').forEach(function(card) { card.classList.remove('active'); });
    const themes = ['default', 'dark', 'blue', 'green', 'red', 'orange'];
    const currentIndex = themes.indexOf(currentTheme);
    if (currentIndex >= 0) {
        const cards = document.querySelectorAll('.theme-card');
        if (cards[currentIndex]) cards[currentIndex].classList.add('active');
    }
}

async function createPost() {
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const imageInput = document.getElementById('post-image');
    const msg = document.getElementById('post-message');
    if (!title || !content) { msg.innerHTML = '<div class="error">Заполните заголовок и текст</div>'; return; }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    if (imageInput.files[0]) formData.append('image', imageInput.files[0]);

    try {
        const res = await fetch(API_URL + '/posts/', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            msg.innerHTML = '<div class="success">Новость опубликована!</div>';
            document.getElementById('post-title').value = '';
            document.getElementById('post-content').value = '';
            document.getElementById('post-image').value = '';
            loadPosts();
        } else {
            msg.innerHTML = '<div class="error">' + formatError(data) + '</div>';
        }
    } catch (e) {
        msg.innerHTML = '<div class="error">Ошибка: ' + e.message + '</div>';
    }
}

async function loadPosts() {
    const feed = document.getElementById('posts-feed');
    feed.innerHTML = '<p style="color: var(--text-secondary);">Загрузка...</p>';
    try {
        const res = await fetch(API_URL + '/posts/?skip=0&limit=20');
        const posts = await res.json();
        if (!Array.isArray(posts) || posts.length === 0) {
            feed.innerHTML = '<div class="empty-state">Пока нет новостей. Будь первым!</div>';
            return;
        }
        const postsWithDetails = await Promise.all(posts.map(async function(post) {
            const [likesData, commentsData] = await Promise.all([
                fetch(API_URL + '/likes/post/' + post.id + '/count').then(r => r.json()),
                fetch(API_URL + '/comments/post/' + post.id).then(r => r.json())
            ]);
            return { ...post, likes_count: likesData.likes_count, comments: commentsData };
        }));
        feed.innerHTML = postsWithDetails.map(function(post) { return renderPost(post); }).join('');
    } catch (e) {
        feed.innerHTML = '<div class="error">Ошибка загрузки новостей: ' + e.message + '</div>';
    }
}

async function loadMyPosts() {
    const feed = document.getElementById('my-posts');
    feed.innerHTML = '<p style="color: var(--text-secondary);">Загрузка...</p>';
    try {
        const res = await fetch(API_URL + '/posts/?skip=0&limit=20');
        const posts = await res.json();
        const myPosts = posts.filter(function(post) { return post.author_username === currentUser; });
        if (myPosts.length === 0) {
            feed.innerHTML = '<div class="empty-state">У вас пока нет публикаций</div>';
            return;
        }
        const postsWithDetails = await Promise.all(myPosts.map(async function(post) {
            const [likesData, commentsData] = await Promise.all([
                fetch(API_URL + '/likes/post/' + post.id + '/count').then(r => r.json()),
                fetch(API_URL + '/comments/post/' + post.id).then(r => r.json())
            ]);
            return { ...post, likes_count: likesData.likes_count, comments: commentsData };
        }));
        feed.innerHTML = postsWithDetails.map(function(post) { return renderPost(post); }).join('');
    } catch (e) {
        feed.innerHTML = '<div class="error">Ошибка загрузки публикаций: ' + e.message + '</div>';
    }
}

function renderPost(post) {
    const date = new Date(post.created_at).toLocaleString('ru-RU');
    const normalizedPath = post.image_path ? post.image_path.replace(/\\/g, '/') : null;
    const fullPath = normalizedPath ? '/' + normalizedPath : null;
    const imageHtml = fullPath
        ? '<img src="' + fullPath + '" class="post-image" alt="Изображение" onclick="openLightbox(\'' + fullPath + '\', \'' + escapeHtml(post.title).replace(/'/g, "\\'") + '\')">'
        : '';
    const commentsHtml = post.comments.map(function(comment) {
        const commentDate = new Date(comment.created_at).toLocaleString('ru-RU');
        const authorName = comment.author_username || 'Пользователь #' + comment.author_id;
        const authorInitial = authorName[0].toUpperCase();
        const avatarHtml = userAvatarsCache[comment.author_id]
            ? '<img src="/' + userAvatarsCache[comment.author_id].replace(/\\/g, '/') + '">'
            : authorInitial;
        return '<div class="comment">' +
            '<div class="comment-avatar">' + avatarHtml + '</div>' +
            '<div class="comment-content">' +
                '<div class="comment-author">' + escapeHtml(authorName) + '</div>' +
                '<div class="comment-text">' + escapeHtml(comment.text) + '</div>' +
                '<div class="comment-date">' + commentDate + '</div>' +
            '</div>' +
        '</div>';
    }).join('');
    const authorInitial = (post.author_username || 'U')[0].toUpperCase();
    const isOwner = post.author_username === currentUser;
    const ownerActions = isOwner ?
        '<button class="action-btn edit-btn" onclick="openEditModal(' + post.id + ', \'' + escapeHtml(post.title).replace(/'/g, "\\'") + '\', \'' + escapeHtml(post.content).replace(/'/g, "\\'").replace(/\n/g, '\\n') + '\')">️ Редактировать</button>' +
        '<button class="action-btn delete-btn" onclick="openDeleteModal(' + post.id + ')">🗑️ Удалить</button>'
        : '';
    return '<div class="post" data-post-id="' + post.id + '">' +
        '<div class="post-header">' +
            '<div class="post-avatar">' + authorInitial + '</div>' +
            '<div class="post-author-info">' +
                '<div class="post-author">' + (post.author_username || 'Пользователь #' + post.author_id) + '</div>' +
                '<div class="post-date">' + date + '</div>' +
            '</div>' +
        '</div>' +
        '<div class="post-title">' + escapeHtml(post.title) + '</div>' +
        '<div class="post-content">' + escapeHtml(post.content) + '</div>' +
        imageHtml +
        '<div class="post-actions">' +
            '<button class="action-btn" onclick="toggleLike(' + post.id + ')">❤️ ' + post.likes_count + '</button>' +
            '<button class="action-btn">💬 ' + post.comments.length + '</button>' +
            ownerActions +
        '</div>' +
        '<div class="comments-section">' +
            commentsHtml +
            '<div class="comment-form">' +
                '<input type="text" id="comment-input-' + post.id + '" placeholder="Написать комментарий...">' +
                '<button onclick="addComment(' + post.id + ')">Отправить</button>' +
            '</div>' +
        '</div>' +
    '</div>';
}

async function toggleLike(postId) {
    if (!token) return;
    try {
        let res = await fetch(API_URL + '/likes/post/' + postId, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
        if (res.status === 400) {
            res = await fetch(API_URL + '/likes/post/' + postId, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
        }
        if (res.ok || res.status === 204) loadPosts();
    } catch (e) { console.error('Ошибка лайка:', e); }
}

async function addComment(postId) {
    if (!token) return;
    const input = document.getElementById('comment-input-' + postId);
    const text = input.value.trim();
    if (!text) return;
    try {
        const res = await fetch(API_URL + '/comments/?post_id=' + postId, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });
        if (res.ok) { input.value = ''; loadPosts(); }
        else { const data = await res.json(); alert(formatError(data)); }
    } catch (e) { console.error('Ошибка комментария:', e); }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== ДРУЗЬЯ =====

function switchFriendsTab(tab, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (tab === 'friends') {
        document.getElementById('friends-list').style.display = 'block';
        document.getElementById('requests-list').style.display = 'none';
        loadFriends();
    } else {
        document.getElementById('friends-list').style.display = 'none';
        document.getElementById('requests-list').style.display = 'block';
        loadFriendsRequests();
    }
}

function showAddFriendModal() {
    document.getElementById('add-friend-modal').classList.add('active');
    document.getElementById('friend-user-id').value = '';
    document.getElementById('friend-message').innerHTML = '';
}

function closeAddFriendModal() {
    document.getElementById('add-friend-modal').classList.remove('active');
}

async function sendFriendRequest() {
    const addresseeId = document.getElementById('friend-user-id').value;
    const msgDiv = document.getElementById('friend-message');

    if (!addresseeId) {
        msgDiv.innerHTML = '<div class="error">Введите ID пользователя</div>';
        return;
    }

    if (parseInt(addresseeId) === myUserId) {
        msgDiv.innerHTML = '<div class="error">Нельзя добавить себя в друзья</div>';
        return;
    }

    try {
        const res = await fetch(API_URL + '/friends/request', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ addressee_id: parseInt(addresseeId) })
        });

        if (res.ok) {
            msgDiv.innerHTML = '<div class="success">✅ Запрос отправлен!</div>';
            setTimeout(() => {
                closeAddFriendModal();
                loadFriendsRequests();
            }, 1500);
        } else {
            const data = await res.json();
            msgDiv.innerHTML = '<div class="error">' + formatError(data) + '</div>';
        }
    } catch (e) {
        msgDiv.innerHTML = '<div class="error">Ошибка: ' + e.message + '</div>';
    }
}

async function loadFriends() {
    const container = document.getElementById('friends-list');
    container.innerHTML = '<div class="empty-state">Загрузка...</div>';

    try {
        const res = await fetch(API_URL + '/friends/my', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (res.ok) {
            const friends = await res.json();

            if (friends.length === 0) {
                container.innerHTML = '<div class="empty-state">У вас пока нет друзей</div>';
                return;
            }

            let html = '';
            for (const friend of friends) {
                const avatarHtml = userAvatarsCache[friend.id]
                    ? '<img src="/' + userAvatarsCache[friend.id].replace(/\\/g, '/') + '">'
                    : friend.username[0].toUpperCase();

                html += '<div class="friend-item">' +
                    '<div class="friend-info">' +
                        '<div class="friend-avatar">' + avatarHtml + '</div>' +
                        '<div class="friend-details">' +
                            '<div class="friend-name">' + escapeHtml(friend.full_name || friend.username) + '</div>' +
                            '<div class="friend-username">@' + escapeHtml(friend.username) + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="friend-actions">' +
                        '<button class="btn-small btn-secondary" onclick="openChat(' + friend.id + '); showPage(\'messages\', document.querySelector(\'.menu-item[onclick*=\\\'messages\\\']\'))">💬 Написать</button>' +
                        '<button class="btn-small btn-danger" onclick="removeFriend(' + friend.id + ')">🗑️ Удалить</button>' +
                    '</div>' +
                '</div>';
            }

            container.innerHTML = html;
        } else {
            container.innerHTML = '<div class="empty-state">Ошибка загрузки</div>';
        }
    } catch (e) {
        console.error('Ошибка загрузки друзей:', e);
        container.innerHTML = '<div class="empty-state">Ошибка: ' + e.message + '</div>';
    }
}

async function loadFriendsRequests() {
    try {
        const res = await fetch(API_URL + '/friends/requests/incoming', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (res.ok) {
            const requests = await res.json();
            const container = document.getElementById('incoming-requests');
            const badge = document.getElementById('requests-badge');
            badge.textContent = requests.length;

            if (requests.length === 0) {
                container.innerHTML = '<div class="empty-state">Нет входящих запросов</div>';
            } else {
                let html = '';
                for (const req of requests) {
                    let userHtml = 'Пользователь #' + req.requester_id;
                    try {
                        const userRes = await fetch(API_URL + '/users/' + req.requester_id, {
                            headers: { 'Authorization': 'Bearer ' + token }
                        });
                        if (userRes.ok) {
                            const user = await userRes.json();
                            userHtml = escapeHtml(user.username);
                        }
                    } catch (e) {}

                    const date = new Date(req.created_at).toLocaleString('ru-RU');

                    html += '<div class="request-item">' +
                        '<div class="request-info">' +
                            '<div class="request-user">Запрос от: ' + userHtml + '</div>' +
                            '<div class="request-date">' + date + '</div>' +
                        '</div>' +
                        '<div class="friend-actions">' +
                            '<button class="btn-small btn-primary" onclick="acceptFriendRequest(' + req.id + ')">✅ Принять</button>' +
                            '<button class="btn-small btn-danger" onclick="rejectFriendRequest(' + req.id + ')">❌ Отклонить</button>' +
                        '</div>' +
                    '</div>';
                }
                container.innerHTML = html;
            }
        }
    } catch (e) {
        console.error('Ошибка загрузки входящих запросов:', e);
    }

    try {
        const res = await fetch(API_URL + '/friends/requests/outgoing', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (res.ok) {
            const requests = await res.json();
            const container = document.getElementById('outgoing-requests');

            if (requests.length === 0) {
                container.innerHTML = '<div class="empty-state">Нет исходящих запросов</div>';
            } else {
                let html = '';
                for (const req of requests) {
                    let userHtml = 'Пользователь #' + req.addressee_id;
                    try {
                        const userRes = await fetch(API_URL + '/users/' + req.addressee_id, {
                            headers: { 'Authorization': 'Bearer ' + token }
                        });
                        if (userRes.ok) {
                            const user = await userRes.json();
                            userHtml = escapeHtml(user.username);
                        }
                    } catch (e) {}

                    const date = new Date(req.created_at).toLocaleString('ru-RU');

                    html += '<div class="request-item">' +
                        '<div class="request-info">' +
                            '<div class="request-user">Запрос пользователю: ' + userHtml + '</div>' +
                            '<div class="request-date">' + date + '</div>' +
                        '</div>' +
                        '<div class="friend-actions">' +
                            '<span style="color: var(--text-secondary); font-size: 13px;">⏳ Ожидает ответа</span>' +
                        '</div>' +
                    '</div>';
                }
                container.innerHTML = html;
            }
        }
    } catch (e) {
        console.error('Ошибка загрузки исходящих запросов:', e);
    }
}

async function acceptFriendRequest(friendshipId) {
    try {
        const res = await fetch(API_URL + '/friends/request/' + friendshipId + '/accept', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (res.ok) {
            loadFriendsRequests();
            loadFriends();
        } else {
            const data = await res.json();
            alert(formatError(data));
        }
    } catch (e) {
        alert('Ошибка: ' + e.message);
    }
}

async function rejectFriendRequest(friendshipId) {
    try {
        const res = await fetch(API_URL + '/friends/request/' + friendshipId + '/reject', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (res.ok) {
            loadFriendsRequests();
        } else {
            const data = await res.json();
            alert(formatError(data));
        }
    } catch (e) {
        alert('Ошибка: ' + e.message);
    }
}

async function removeFriend(friendId) {
    if (!confirm('Удалить этого пользователя из друзей?')) return;

    try {
        const res = await fetch(API_URL + '/friends/' + friendId, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (res.ok || res.status === 204) {
            loadFriends();
        } else {
            const data = await res.json();
            alert(formatError(data));
        }
    } catch (e) {
        alert('Ошибка: ' + e.message);
    }
}