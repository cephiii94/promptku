import { initFirebase } from './config.js';

// =========================================================================
// STATE & CONFIG
// =========================================================================
let db, auth, currentUser;
let userDocRef = null;

// Konfigurasi Avatar
const AVATAR_LIST = [
    // --- FREE ---
    { id: 'free_1', url: 'https://cdn-icons-png.flaticon.com/128/4140/4140048.png', type: 'free', name: 'Cool Guy' },
    { id: 'free_2', url: 'https://cdn-icons-png.flaticon.com/128/4140/4140047.png', type: 'free', name: 'Cool Girl' },
    { id: 'free_3', url: 'https://cdn-icons-png.flaticon.com/128/4140/4140037.png', type: 'free', name: 'Artist' },
    { id: 'free_4', url: 'https://cdn-icons-png.flaticon.com/128/4140/4140051.png', type: 'free', name: 'Geek' },
    
    // --- PREMIUM (Beli pakai Promtium) ---
    { id: 'prem_1', url: 'https://cdn-icons-png.flaticon.com/128/3408/3408455.png', type: 'premium', cost: 50, name: 'Cyber Punk' },
    { id: 'prem_2', url: 'https://cdn-icons-png.flaticon.com/128/3408/3408466.png', type: 'premium', cost: 100, name: 'Neon Robot' },
    { id: 'prem_3', url: 'https://cdn-icons-png.flaticon.com/128/3408/3408470.png', type: 'premium', cost: 200, name: 'Space Walker' },

    // --- EXCLUSIVE (Achievement) ---
    { id: 'ach_1', url: 'https://cdn-icons-png.flaticon.com/128/949/949666.png', type: 'achievement', req: 'first_blood', name: 'Veteran' },
    { id: 'ach_2', url: 'https://cdn-icons-png.flaticon.com/128/949/949635.png', type: 'achievement', req: 'on_fire', name: 'Hotshot' }
];

let selectedAvatarUrl = null;

// Konfigurasi Rank (Gamifikasi)
const RANKS = [
    { maxLvl: 5, name: "Newbie Prompt", icon: "school", color: "#6B7280" },      // Level 1-5
    { maxLvl: 15, name: "Tukang Ketik", icon: "keyboard", color: "#3B82F6" },    // Level 6-15
    { maxLvl: 30, name: "Prompt Engineer", icon: "engineering", color: "#8B5CF6" }, // Level 16-30
    { maxLvl: 999, name: "AI Whisperer", icon: "auto_awesome", color: "#F59E0B" }   // Level 31+
];

// =========================================================================
// INITIALIZATION
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    const fb = await initFirebase();
    db = fb.db;
    auth = fb.auth;

    // Cek Status Login
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            userDocRef = db.collection('users').doc(user.uid);
            
            // 1. Muat Header Profil (Info Utama)
            await loadUserProfile();
            
            // 2. Muat Tab Default (Karya Saya)
            loadMyPrompts();
            
            // 3. Setup Tombol Edit & Logout
            setupEventListeners();
        } else {
            // Kalau belum login, tendang ke Home
            window.location.replace("index.html");
        }
    });
});

// =========================================================================
// CORE LOGIC: PROFILE & GAMIFICATION
// =========================================================================
const loadUserProfile = async () => {
    try {
        // Ambil data tambahan dari Firestore (XP, Bio, dll)
        const doc = await userDocRef.get();
        let userData = doc.exists ? doc.data() : {};

        // Default value jika user baru
        const xp = userData.xp || 0;
        const bio = userData.bio || "Pengguna baru yang belum mengisi bio.";
        const photoURL = currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || 'User')}&background=random`;
        
        // [BARU] Promtium & Membership Status
        const balance = userData.token || 0;
        const isSultan = userData.isPremium || false;

        // --- 1. Update UI Identitas ---
        document.getElementById('profile-name').innerHTML = `${currentUser.displayName} ${isSultan ? '<span class="material-icons" style="color:#F59E0B; font-size:1.2rem; vertical-align:middle; margin-left:4px;" title="Sultan Member">verified</span>' : ''}`;
        document.getElementById('profile-email').textContent = `@${currentUser.email.split('@')[0]}`; 
        document.getElementById('profile-bio').textContent = bio;
        document.getElementById('profile-image').src = photoURL;
        document.getElementById('header-avatar').src = photoURL;

        // Update Saldo Header
        const balEl = document.getElementById('balance-amount');
        if (balEl) balEl.textContent = `${balance} Promtium`;

        // Isi Form Edit dengan data saat ini
        document.getElementById('edit-name').value = currentUser.displayName;
        document.getElementById('edit-bio').value = bio;
        // Update Preview di Modal Edit
        const editPreview = document.getElementById('edit-modal-avatar-preview');
        if(editPreview) editPreview.src = photoURL;

        // --- 2. Update Gamification (Level & Rank) ---
        const level = Math.floor(xp / 100) + 1; // Rumus: Tiap 100 XP naik 1 Level
        const nextLevelXp = level * 100;
        const currentLevelXp = xp % 100;
        
        // Cari Rank Name
        const rankInfo = RANKS.find(r => level <= r.maxLvl) || RANKS[RANKS.length - 1];

        // Render Rank Badge
        const rankEl = document.getElementById('profile-rank');
        rankEl.innerHTML = `${rankInfo.name} <small>(Lvl. ${level})</small>`;
        rankEl.parentElement.querySelector('.material-icons').textContent = rankInfo.icon;
        
        // Render Progress Bar
        document.getElementById('xp-text').textContent = `${currentLevelXp} / 100 XP (Total: ${xp})`;
        document.getElementById('xp-bar-fill').style.width = `${currentLevelXp}%`;

        // --- 3. Update Stats Dasar ---
        document.getElementById('stat-xp').textContent = xp;
        
        // Hitung total prompt user
        const promptSnapshot = await db.collection('prompts').where('creatorId', '==', currentUser.uid).get();
        document.getElementById('stat-prompts').textContent = promptSnapshot.size;

        // Hitung total Likes (Agak berat query-nya, jadi kita simpan di userDoc nanti biar cepat)
        const totalLikes = userData.totalLikesReceived || 0; 
        document.getElementById('stat-likes').textContent = totalLikes;

    } catch (error) {
        console.error("Error loading profile:", error);
        Swal.fire("Error", "Gagal memuat profil.", "error");
    }
};

// =========================================================================
// TAB CONTENT LOADERS
// =========================================================================

// A. KARYA SAYA
const loadMyPrompts = async () => {
    const grid = document.getElementById('profile-content-area');
    grid.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
    
    try {
        const snapshot = await db.collection('prompts')
            .where('creatorId', '==', currentUser.uid)
            .get(); // Note: Indexing mungkin diperlukan di Firebase Console

        const prompts = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        renderGrid(prompts, true); // true = mode edit aktif
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p class="text-center">Gagal memuat prompt.</p>';
    }
};

// B. DISUKAI (LIKED)
const loadLikedPrompts = async () => {
    const grid = document.getElementById('profile-content-area');
    grid.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

    try {
        // Firestore tidak bisa query array-contains secara efisien untuk list besar
        // Tapi untuk skala kecil, ini oke.
        const snapshot = await db.collection('prompts')
            .where('likedBy', 'array-contains', currentUser.uid)
            .get();

        const prompts = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        renderGrid(prompts, false); // false = mode edit mati
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p class="text-center">Belum ada prompt yang disukai.</p>';
    }
};

// C. ACHIEVEMENTS (BADGES)
const loadAchievements = async () => {
    const doc = await userDocRef.get();
    const userData = doc.exists ? doc.data() : {};
    const totalPrompts = document.getElementById('stat-prompts').textContent;
    const totalLikes = document.getElementById('stat-likes').textContent;
    const xp = userData.xp || 0;
    const level = Math.floor(xp / 100) + 1;

    // Logic Unlocking Badge
    const badges = [
        { 
            id: 'first_blood', 
            icon: '🏅', 
            title: 'First Blood', 
            desc: 'Upload prompt pertamamu.', 
            unlocked: totalPrompts > 0 
        },
        { 
            id: 'on_fire', 
            icon: '🔥', 
            title: 'On Fire', 
            desc: 'Dapatkan 10 Like total.', // Dimudahkan dulu buat testing
            unlocked: totalLikes >= 10 
        },
        { 
            id: 'senior_eng', 
            icon: '🤖', 
            title: 'Senior Engineer', 
            desc: 'Capai Level 5.', 
            unlocked: level >= 5 
        }
    ];

    const container = document.getElementById('achievements-area');
    container.innerHTML = badges.map(badge => `
        <div class="achievement-card ${badge.unlocked ? 'unlocked' : 'locked'}">
            <div class="badge-icon">${badge.icon}</div>
            <h3>${badge.title}</h3>
            <p>${badge.desc}</p>
            ${badge.unlocked ? '<span style="color:green; font-size:0.7rem;">✔ TERCAPAI</span>' : ''}
        </div>
    `).join('');
};

// =========================================================================
// HELPER: RENDER GRID (Copied & Simplified from ui.js)
// =========================================================================
const renderGrid = (prompts, isMyProfile) => {
    const grid = document.getElementById('profile-content-area');
    
    if (prompts.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 2rem; color:#666;">Belum ada konten di sini.</div>';
        return;
    }

    grid.innerHTML = prompts.map(prompt => `
        <div class="card">
            <div class="card-image-container">
                <img src="${prompt.imageUrl}" alt="${prompt.title}" loading="lazy">
                
                ${isMyProfile ? `
                <div class="card-actions" style="opacity:1; visibility:visible; background: rgba(0,0,0,0.3); padding:4px; border-radius:12px;">
                    <button class="action-btn edit-btn" onclick="window.location.href='index.html?edit=${prompt.id}'">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="action-btn delete-btn" onclick="deletePrompt('${prompt.id}')">
                        <span class="material-icons">delete</span>
                    </button>
                </div>` : ''}

                <div class="card-prompt-overlay">
                    <div class="overlay-info">
                        <h4 class="overlay-title">${prompt.title}</h4>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
};

// =========================================================================
// EVENT LISTENERS
// =========================================================================
const setupEventListeners = () => {
    
    // 1. Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btn = e.currentTarget;

            // [NEW] Avatar Tab Logic (Biar gak bentrok sama Main Tab)
            if (btn.dataset.avatarTab) {
                document.querySelectorAll('#avatar-selection-modal .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderAvatars(btn.dataset.avatarTab);
                return;
            }

            // Normal Profile Tabs
            if (btn.dataset.tab) {
                document.querySelectorAll('.profile-tabs > .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const tab = btn.dataset.tab;
                const grid = document.getElementById('profile-content-area');
                const badges = document.getElementById('achievements-area');

                if (tab === 'achievements') {
                    grid.classList.add('hidden');
                    badges.classList.remove('hidden');
                    loadAchievements();
                } else {
                    grid.classList.remove('hidden');
                    badges.classList.add('hidden');
                    if (tab === 'my-prompts') loadMyPrompts();
                    if (tab === 'liked-prompts') loadLikedPrompts();
                }
            }
        });
    });

    // 2. Edit Profile Submit
    const editForm = document.getElementById('edit-profile-form');
    if(editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = document.getElementById('edit-name').value;
            const newBio = document.getElementById('edit-bio').value;
            
            try {
                // Update Auth Profile (Display Name only)
                await currentUser.updateProfile({
                    displayName: newName
                    // PhotoURL handled by Avatar Selector
                });

                // Update Firestore (Bio & Redundant Info)
                await userDocRef.set({
                    bio: newBio,
                    email: currentUser.email,
                    displayName: newName
                    // PhotoURL handled by Avatar Selector
                }, { merge: true });

                Swal.fire("Berhasil", "Profil diperbarui!", "success");
                document.getElementById('edit-profile-modal').style.display = 'none';
                loadUserProfile(); // Reload UI

            } catch (error) {
                console.error(error);
                Swal.fire("Gagal", error.message, "error");
            }
        });
    }

    // 3. Logout
    document.getElementById('logout-btn-profile').addEventListener('click', () => {
        auth.signOut().then(() => window.location.href = 'index.html');
    });

    // 4. [NEW] Avatar Modal Handlers
    // 4. [UPDATED] Unified Edit Modal Handlers
    
    // Saat tombol "Edit Profil" diklik (yang di HTML onclick="...display='flex'")
    // Kita tambahkan listener global atau update onclick di HTML agar mengisi data gambar juga.
    // Cara termudah: Tambahkan logic di 'edit-profile-modal' observer atau saat loadUserProfile.
    
    // A. Listener Tombol Kamera di dalam Modal Edit
    const triggerAvatarBtn = document.getElementById('trigger-avatar-selector');
    if(triggerAvatarBtn) {
        triggerAvatarBtn.addEventListener('click', () => {
            // Tutup Modal Edit Profil, Buka Modal Avatar
            document.getElementById('edit-profile-modal').style.display = 'none';
            document.getElementById('avatar-selection-modal').style.display = 'flex';
            renderAvatars('free');
        });
    }

    // B. Listener saat Modal Avatar ditutup / Batal -> Kembali ke Edit Profil
    // (Opsional, tapi bagus UX-nya)
    const cancelAvatarBtn = document.querySelector('#avatar-selection-modal .btn-secondary');
    if(cancelAvatarBtn) {
        // Clone node untuk reset listener lama
        const newBtn = cancelAvatarBtn.cloneNode(true);
        cancelAvatarBtn.parentNode.replaceChild(newBtn, cancelAvatarBtn);
        
        newBtn.addEventListener('click', () => {
            document.getElementById('avatar-selection-modal').style.display = 'none';
            document.getElementById('edit-profile-modal').style.display = 'flex'; // Kembali ke menu edit utama
        });
    }

    const saveAvatarBtn = document.getElementById('save-avatar-btn');
    if(saveAvatarBtn) {
        saveAvatarBtn.addEventListener('click', saveAvatar);
    }
};

// =========================================================================
// AVATAR LOGIC (NEW)
// =========================================================================
const renderAvatars = async (filterType) => {
    const grid = document.getElementById('avatar-grid');
    grid.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>'; // Loading

    // Ambil data user terbaru untuk cek Owned Avatars
    const doc = await userDocRef.get();
    const userData = doc.exists ? doc.data() : {};
    const ownedAvatars = userData.ownedAvatars || [];
    const balance = userData.token || 0;

    // Filter Avatar List
    let avatarsToShow = AVATAR_LIST.filter(a => a.type === filterType);
    
    if (avatarsToShow.length === 0) {
        grid.innerHTML = '<p style="text-align:center; grid-column:1/-1;">Tidak ada avatar di kategori ini.</p>';
        return;
    }

    grid.innerHTML = avatarsToShow.map(avatar => {
        // Cek Status (Locked/Unlocked)
        let isLocked = false;
        let lockReason = '';

        if (avatar.type === 'premium' && !ownedAvatars.includes(avatar.id)) {
            isLocked = true;
            lockReason = `${avatar.cost} P`;
        } else if (avatar.type === 'achievement') {
            // Cek Achievement Logic (Sederhana dulu)
            // Misalnya req='first_blood' -> kita cek badge unlocked logic yang sama kayak loadAchievements
            // Disini disederhanakan: Anggap belum unlock kalau belum ada di ownedAvatars (harus klaim dulu? atau auto?)
            // Kita buat simple: Achievement Avatar otomatis masuk ownedAvatars saat achievement tercapai (Logic backend/trigger lain).
            // Jadi disini cukup cek ownedAvatars.
            if (!ownedAvatars.includes(avatar.id)) {
                isLocked = true;
                lockReason = 'Locked'; 
            }
        }

        const isSelected = selectedAvatarUrl === avatar.url || (!selectedAvatarUrl && currentUser.photoURL === avatar.url);

        return `
            <div class="avatar-item ${isLocked ? 'locked' : ''} ${isSelected ? 'selected' : ''}" 
                 onclick="selectAvatar('${avatar.id}')">
                <img src="${avatar.url}" alt="${avatar.name}">
                ${isLocked ? `<div class="lock-icon"><span class="material-icons">lock</span></div>` : ''}
                ${avatar.type === 'premium' && isLocked ? `<div class="avatar-price-tag"><img src="img/promtium.png" style="width:12px;"> ${avatar.cost}</div>` : ''}
                ${avatar.type === 'achievement' && isLocked ? `<div class="avatar-price-tag achievement-tag">Quest</div>` : ''}
            </div>
        `;
    }).join('');
};

window.selectAvatar = async (id) => {
    const avatar = AVATAR_LIST.find(a => a.id === id);
    if (!avatar) return;

    // Cek Status Lock
    const doc = await userDocRef.get();
    const userData = doc.exists ? doc.data() : {};
    const ownedAvatars = userData.ownedAvatars || [];

    if (avatar.type === 'free' || ownedAvatars.includes(avatar.id)) {
        // Select
        selectedAvatarUrl = avatar.url;
        // Re-render untuk update UI Selected
        renderAvatars(avatar.type); // Tetap di tab yang sama
    } else if (avatar.type === 'premium') {
        // Prompt Beli
        buyAvatar(avatar);
    } else if (avatar.type === 'achievement') {
        Swal.fire({
            icon: 'info',
            title: 'Terkunci',
            text: `Selesaikan achievement '${avatar.name}' untuk membuka avatar ini!`
        });
    }
};

const buyAvatar = async (avatar) => {
    const result = await Swal.fire({
        title: 'Beli Avatar?',
        html: `Harga: <b>${avatar.cost} Promtium</b>.<br>Saldo Anda akan dipotong.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Beli',
        confirmButtonColor: '#F59E0B'
    });

    if (result.isConfirmed) {
        try {
            Swal.showLoading();
            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userDocRef);
                if (!userDoc.exists) throw "User tidak ditemukan";
                const data = userDoc.data();
                const currentToken = data.token || 0;

                if (currentToken < avatar.cost) throw "Saldo Promtium tidak cukup!";

                transaction.update(userDocRef, {
                    token: currentToken - avatar.cost,
                    ownedAvatars: firebase.firestore.FieldValue.arrayUnion(avatar.id)
                });
            });

            Swal.fire('Berhasil!', 'Avatar telah terbeli.', 'success');
            // Auto Select
            selectedAvatarUrl = avatar.url;
            renderAvatars('premium');
            
            // Update Balance di Header (UI update)
            loadUserProfile(); 

        } catch (error) {
            Swal.fire('Gagal', error.toString(), 'error');
        }
    }
};

const saveAvatar = async () => {
    if (!selectedAvatarUrl) {
        document.getElementById('avatar-selection-modal').style.display = 'none';
        return;
    }

    try {
        Swal.showLoading();
        // Update Firebase Auth & Firestore
        await currentUser.updateProfile({ photoURL: selectedAvatarUrl });
        await userDocRef.update({ photoURL: selectedAvatarUrl });
        
        Swal.fire({ title: "Berhasil", text: "Avatar profil diperbarui!", icon: "success", timer: 1500, showConfirmButton: false });
        
        document.getElementById('avatar-selection-modal').style.display = 'none';
        document.getElementById('edit-profile-modal').style.display = 'flex'; // Kembali ke Edit Profil
        
        // Refresh UI
        loadUserProfile();
        
    } catch (error) {
        console.error(error);
        Swal.fire("Gagal", "Terjadi kesalahan saat menyimpan avatar.", "error");
    }
};

// Global Function untuk Delete (karena dipanggil via onclick HTML string)
window.deletePrompt = async (id) => {
    Swal.fire({
        title: 'Hapus?', text: "Tidak bisa dikembalikan!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await db.collection("prompts").doc(id).delete();
            Swal.fire("Terhapus", "", "success");
            loadMyPrompts(); // Refresh grid
        }
    });
};