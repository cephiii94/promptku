import { initFirebase } from './config.js';

// =========================================================================
// STATE & CONFIG
// =========================================================================
let db, auth, currentUser;
let userDocRef = null;

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
        const photoURL = currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=random`;

        // --- 1. Update UI Identitas ---
        document.getElementById('profile-name').textContent = currentUser.displayName;
        document.getElementById('profile-email').textContent = `@${currentUser.email.split('@')[0]}`; // Username ala-ala
        document.getElementById('profile-bio').textContent = bio;
        document.getElementById('profile-image').src = photoURL;
        document.getElementById('header-avatar').src = photoURL;

        // Isi Form Edit dengan data saat ini
        document.getElementById('edit-name').value = currentUser.displayName;
        document.getElementById('edit-bio').value = bio;
        document.getElementById('edit-photo-url').value = currentUser.photoURL || '';

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
        btn.addEventListener('click', () => {
            // Reset active styles
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.tab;
            const grid = document.getElementById('profile-content-area');
            const badges = document.getElementById('achievements-area');

            // Switch Content
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
        });
    });

    // 2. Edit Profile Submit
    const editForm = document.getElementById('edit-profile-form');
    if(editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = document.getElementById('edit-name').value;
            const newBio = document.getElementById('edit-bio').value;
            const newPhoto = document.getElementById('edit-photo-url').value;

            try {
                // Update Auth Profile (Display Name & Photo)
                await currentUser.updateProfile({
                    displayName: newName,
                    photoURL: newPhoto || currentUser.photoURL
                });

                // Update Firestore (Bio & Redundant Info)
                await userDocRef.set({
                    bio: newBio,
                    email: currentUser.email,
                    photoURL: newPhoto || currentUser.photoURL,
                    displayName: newName
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