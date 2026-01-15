// main.js
import { initFirebase, OFFICIAL_CATEGORIES, CLOUDINARY_CLOUD_NAME, extractUsernameFromUrl } from './config.js';
import * as Auth from './auth.js';
import * as UI from './ui.js';

// =========================================================================
// STATE MANAGEMENT
// =========================================================================
let db, auth;
let allPrompts = [];
let currentUser = null;
let currentFilteredPrompts = [];
let currentViewIndex = 0;
let activeCategory = 'all'; 
let currentPage = 1;
const itemsPerPage = 12;

// =========================================================================
// INITIALIZATION
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cek Pesan Satpam (Titipan dari session)
    if (sessionStorage.getItem('alert_must_login')) {
        Swal.fire({
            icon: 'warning',
            title: 'Akses Dibatasi',
            text: 'Mohon Log In dulu untuk mengakses halaman',
            confirmButtonColor: '#F59E0B'
        });
        sessionStorage.removeItem('alert_must_login');
    }

    // 2. Init Firebase
    const fb = await initFirebase();
    if (!fb) return;
    db = fb.db;
    auth = fb.auth;

    // 3. Auth Listener & Satpam Logic
    auth.onAuthStateChanged(async (user) => {
        // --- SATPAM AREA START ---
        const isToolsPage = window.location.pathname.includes('tools.html');
        if (isToolsPage && !user) {
            sessionStorage.setItem('alert_must_login', 'true');
            window.location.replace("index.html"); 
            return;
        }
        // --- SATPAM AREA END ---

        if (user) {
            const tokenResult = await user.getIdTokenResult(true); 
            currentUser = user;
            currentUser.isAdmin = tokenResult.claims.admin === true;
        } else {
            currentUser = null;
        }

        UI.updateAuthStateUI(
            currentUser, 
            currentUser?.isAdmin, 
            () => UI.showModal('auth-modal'), 
            () => Auth.logoutUser(auth)
        );
        applyFilters(); // Re-render to update Admin buttons
    });

    // 4. Init Data & UI
    const yearSpan = document.getElementById('current-year');
    if(yearSpan) yearSpan.textContent = new Date().getFullYear();

    await fetchAndRenderPrompts();
    setupEventListeners();
});

// =========================================================================
// DATA FETCHING & FILTERING
// =========================================================================
const fetchAndRenderPrompts = async () => {
    try {
        const snapshot = await db.collection("prompts").get();
        allPrompts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        UI.populateCategoryOptions(OFFICIAL_CATEGORIES, activeCategory, (cat) => {
            handleCategoryClick(cat);
        });

        applyFilters();
    } catch (error) {
        console.error("Gagal mengambil data: ", error);
        if(UI.els.promptGrid) UI.els.promptGrid.innerHTML = `<p style="text-align:center; padding:20px;">Gagal memuat data.</p>`;
    }
};

const handleCategoryClick = (categoryValue) => {
    activeCategory = categoryValue;
    // Update active chips logic
    const chips = document.querySelectorAll('.category-chip');
    chips.forEach(chip => {
        if (chip.dataset.value === categoryValue) chip.classList.add('active');
        else chip.classList.remove('active');
    });

    if (UI.els.categoryFilter) UI.els.categoryFilter.value = categoryValue;
    applyFilters();
};

const applyFilters = () => {
    const category = activeCategory;
    let searchTerm = '';
    
    if (window.innerWidth > 768 && UI.els.textFilterDesktop) {
        searchTerm = UI.els.textFilterDesktop.value.toLowerCase();
    } else if (UI.els.textFilterMobile) {
        searchTerm = UI.els.textFilterMobile.value.toLowerCase();
    }

    let sortBy = 'date_desc'; // Default sort
    if (UI.els.sortByFilter) {
        sortBy = UI.els.sortByFilter.value;
    }
    
    // Reset Filters Button Logic
    if (UI.els.resetFiltersBtn) {
        if (category !== 'all' || searchTerm !== '' || sortBy !== 'date_desc') {
            UI.els.resetFiltersBtn.style.display = 'inline-flex';
        } else {
            UI.els.resetFiltersBtn.style.display = 'none';
        }
    }

    let filtered = allPrompts;

    if (category !== 'all') filtered = filtered.filter(p => p.category === category);
    if (searchTerm) {
        filtered = filtered.filter(p =>
            (p.title && p.title.toLowerCase().includes(searchTerm)) ||
            (p.tags && p.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
        );
    }
    
    // Helper untuk konversi date (Firestore Timestamp atau Date object atau null)
    const getTime = (p) => {
        if (p.createdAt && p.createdAt.seconds) return p.createdAt.seconds; // Firestore Timestamp
        if (p.createdAt instanceof Date) return p.createdAt.getTime() / 1000;
        return 0; // Kalau null/undefined, dianggap 0 (sangat lama)
    };

    switch(sortBy) {
        case 'date_desc': filtered.sort((a, b) => getTime(b) - getTime(a)); break; // Terbaru (Desc)
        case 'date_asc': filtered.sort((a, b) => getTime(a) - getTime(b)); break; // Terlama (Asc)
        case 'title_asc': filtered.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
        case 'title_desc': filtered.sort((a, b) => (b.title || '').localeCompare(a.title || '')); break;
        case 'popular': filtered.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0) || (a.title || '').localeCompare(b.title || '')); break;
        default: filtered.sort((a, b) => getTime(b) - getTime(a)); // Default Fallback
    }

    currentFilteredPrompts = filtered;
    currentPage = 1;
    updatePageDisplay();
};

// =========================================================================
// PAGINATION & RENDER
// =========================================================================
const updatePageDisplay = () => {
    if (!UI.els.paginationContainer) return;

    const totalItems = currentFilteredPrompts.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalItems === 0) {
        UI.els.paginationContainer.innerHTML = '';
        UI.renderPrompts([], currentUser, currentPage, itemsPerPage); 
        return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const promptsToShow = currentFilteredPrompts.slice(start, end);

    UI.renderPrompts(promptsToShow, currentUser, currentPage, itemsPerPage);
    
    UI.renderPagination(totalPages, currentPage, (newPage) => {
        currentPage = newPage;
        updatePageDisplay();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
};

// =========================================================================
// CRUD OPERATIONS
// =========================================================================
const savePrompt = async (formData) => {
    try {
        if (formData.tags && typeof formData.tags === 'string') {
            formData.tags = formData.tags.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);
        } else if (!formData.tags) formData.tags = [];
        
        if (!formData.id) {
            formData.likeCount = 0;
            formData.likedBy = [];
        }

        const { id, ...data } = formData;

        if (id) await db.collection("prompts").doc(id).update(data);
        else await db.collection("prompts").add(data);

        UI.hideModal('prompt-modal');
        await fetchAndRenderPrompts(); 
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Prompt berhasil disimpan', timer: 1500, showConfirmButton: false });
    } catch (error) {
        console.error("Gagal menyimpan: ", error);
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menyimpan prompt.' });
    }
};

const deletePrompt = async (id) => {
    Swal.fire({
        title: 'Anda Yakin?', text: "Hapus permanen?", icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus!', confirmButtonColor: '#EF4444'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await db.collection("prompts").doc(id).delete();
                Swal.fire({ title: 'Terhapus!', icon: 'success', timer: 1500, showConfirmButton: false });
                await fetchAndRenderPrompts(); 
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menghapus prompt.' });
            }
        }
    });
};

const toggleLikePrompt = async (promptId) => {
    if (!currentUser) {
        Swal.fire({ icon: 'info', title: 'Login Dulu', text: 'Silakan login untuk menyukai prompt.' });
        UI.showModal('auth-modal');
        return;
    }
    const promptRef = db.collection("prompts").doc(promptId);
    const userId = currentUser.uid;

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(promptRef);
            if (!doc.exists) throw "Dokumen tidak ditemukan!";
            const data = doc.data();
            const likedBy = data.likedBy || [];
            let newLikeCount = data.likeCount || 0;
            let newLikedBy = [...likedBy];

            if (likedBy.includes(userId)) {
                newLikedBy = likedBy.filter(uid => uid !== userId);
                newLikeCount--;
            } else {
                newLikedBy.push(userId);
                newLikeCount++;
            }
            transaction.update(promptRef, { likedBy: newLikedBy, likeCount: newLikeCount < 0 ? 0 : newLikeCount });
        });
        
        // Optimistic UI Update
        const promptIndex = allPrompts.findIndex(p => p.id === promptId);
        if (promptIndex > -1) {
            const promptData = allPrompts[promptIndex];
            const isLiked = promptData.likedBy && promptData.likedBy.includes(userId);
            if (isLiked) {
                promptData.likeCount = (promptData.likeCount || 1) - 1;
                promptData.likedBy = promptData.likedBy.filter(uid => uid !== userId);
            } else {
                promptData.likeCount = (promptData.likeCount || 0) + 1;
                if (!promptData.likedBy) promptData.likedBy = [];
                promptData.likedBy.push(userId);
            }
            
            const viewModal = document.getElementById('view-prompt-modal');
            if(viewModal && viewModal.style.display === 'flex') {
                const currentPromptId = currentFilteredPrompts[currentViewIndex].id;
                if(currentPromptId === promptId) UI.showFullViewModal(promptData, currentUser, currentViewIndex, currentFilteredPrompts.length);
            }
            applyFilters(); 
        }
    } catch (error) {
        console.error("Like error:", error);
    }
};

const triggerMayarCheckout = (link) => {
    if (!link) {
        Swal.fire('Error', 'Link pembayaran tidak ditemukan!', 'error');
        return;
    }

    console.log("--- START MAYAR CHECKOUT via IframeLightbox ---");

    // 1. Helper function to find the global class
    const findLibrary = () => {
        return window.IframeLightbox;
    };

    let StartLibrary = findLibrary();

    if (StartLibrary) {
        console.log("✅ IframeLightbox library found immediately.");
        openLightbox(StartLibrary, link);
    } else {
        console.warn("⚠️ IframeLightbox not found yet. Starting retry mechanism...");
        
        // 2. Retry Mechanism
        let attempts = 0;
        const maxAttempts = 5;
        const interval = setInterval(() => {
            attempts++;
            StartLibrary = findLibrary();
            
            if (StartLibrary) {
                clearInterval(interval);
                console.log(`✅ Library found on attempt ${attempts}!`);
                openLightbox(StartLibrary, link);
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.error("❌ Failed to find IframeLightbox after multiple attempts.");
                
                // FALLBACK
                Swal.fire({
                    title: 'Popup Gagal Dimuat',
                    text: 'Sistem pembayaran popup tidak merespon. Buka halaman pembayaran di tab baru?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Ya, Buka Tab Baru',
                    cancelButtonText: 'Batal'
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.open(link, '_blank');
                    }
                });
            }
        }, 500);
    }
};

// Execute Checkout Logic using IframeLightbox
const openLightbox = (LibraryClass, link) => {
    try {
        console.log("🚀 Opening Mayar Lightbox:", link);
        
        // Create a dummy hidden trigger element
        // The library binds to an element and reads href/data-src
        const dummyBtn = document.createElement('a');
        dummyBtn.href = link;
        dummyBtn.style.display = 'none';
        document.body.appendChild(dummyBtn);

        // Instantiate Lightbox
        // Note: The library lacks a clear onSuccess callback in its minified code.
        // We will reload page on close as a "best guess" refresh interaction,
        // or just let the user initiate refresh.
        const lightbox = new LibraryClass(dummyBtn, {
            scrolling: true, // [FIX] Mengaktifkan scroll agar user bisa melihat konten panjang
            rate: 500, // Default rate
            onCreated: () => console.log("Lightbox created"),
            onLoaded: () => console.log("Lightbox loaded"),
            onClosed: () => {
                console.log("Lightbox closed. Cleaning up.");
                dummyBtn.remove();
                
                // Optional: ask user if they finished payment
                Swal.fire({
                    title: 'Status Pembayaran',
                    text: 'Apakah Anda sudah menyelesaikan pembayaran?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sudah, Refresh Halaman',
                    cancelButtonText: 'Belum'
                }).then((res) => {
                     if(res.isConfirmed) window.location.reload();
                });
            }
        });
        
        lightbox.open();

    } catch (e) {
        console.error("🔥 Exception during lightbox execution:", e);
        window.open(link, '_blank'); 
    }
};

// =========================================================================
// EVENT LISTENERS SETUP
// =========================================================================
function setupEventListeners() {
    
    // 1. Auth Login Form
    if(UI.els.loginForm) {
        UI.els.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            Auth.loginUser(auth, document.getElementById('login-email').value, document.getElementById('login-password').value, () => UI.hideModal('auth-modal'));
        });
    }

    // --- A. LOGIKA TAB (MASUK vs DAFTAR) ---
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form-container');

    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 1. Hapus class 'active' dari semua tab & form
            authTabs.forEach(t => t.classList.remove('active'));
            authForms.forEach(f => f.classList.remove('active'));

            // 2. Tambah class 'active' ke tab yang diklik
            tab.classList.add('active');

            // 3. Munculkan form yang sesuai (Login atau Register)
            const targetId = tab.dataset.target; // ambil data-target="register-form-wrapper"
            document.getElementById(targetId).classList.add('active');
        });
    });


    // --- B. LOGIKA SUBMIT FORM DAFTAR ---
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;

            // Panggil fungsi register dari Auth
            Auth.registerUser(auth, email, password, name, () => {
                UI.hideModal('auth-modal'); // Tutup modal kalau sukses
                registerForm.reset(); // Kosongkan form
            });
        });
    }

    // 2. Add Prompt Form & Cloudinary
    if (UI.els.promptForm) {
        UI.els.promptForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 1. Ambil Value dari Input
            const title = document.getElementById('prompt-title').value;
            const socialUrl = document.getElementById('prompt-socialUrl').value;
            
            // Ambil Kategori (Bisa dari Dropdown atau pakai default)
            let category = '';
            if (UI.els.promptCategoryInput) category = UI.els.promptCategoryInput.value;
            
            // Ambil Tags
            const tagsInput = document.getElementById('prompt-tags').value;
            const tags = tagsInput.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag !== '');

            // Ambil Text Prompt (Fix yang tadi kita tambahkan textarea)
            const promptTextElement = document.getElementById('prompt-text');
            const promptText = promptTextElement ? promptTextElement.value : '';

            // Ambil Status Premium
            const isPremium = document.getElementById('prompt-isPremium').checked;
            
            // Ambil Link Mayar
            const mayarLinkInput = document.getElementById('prompt-mayarLink');
            const mayarLink = mayarLinkInput ? mayarLinkInput.value : '';

            // --- [BARU] AMBIL PRODUCT ID / SKU MAYAR ---
            const mayarSkuInput = document.getElementById('prompt-mayarSku');
            const mayarSku = mayarSkuInput ? mayarSkuInput.value.trim() : '';
            // -------------------------------------------

            const imageFile = document.getElementById('prompt-imageFile').files[0];
            const promptId = document.getElementById('prompt-id').value;
            const currentImageUrl = document.getElementById('prompt-imageUrl').value;

            // 2. Validasi Sederhana
            if (!title) {
                Swal.fire('Error', 'Judul prompt wajib diisi!', 'error');
                return;
            }

            // Jika prompt baru (tidak ada ID) dan tidak ada gambar yang diupload
            if (!promptId && !imageFile) {
                Swal.fire('Error', 'Wajib upload gambar hasil prompt!', 'error');
                return;
            }
            
            // Jika Premium, pastikan Link & SKU diisi (Opsional: bisa diperketat di sini)
            if (isPremium && (!mayarLink || !mayarSku)) {
                Swal.fire('Peringatan', 'Untuk Prompt Premium, Link Checkout & Product ID Mayar sebaiknya diisi agar sistem otomatis berjalan.', 'warning');
            }

            // Tampilkan Loading
            const submitBtn = UI.els.promptForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-icons spin">refresh</span> Menyimpan...';

            try {
                let imageUrl = currentImageUrl;

                // 3. Upload Gambar (Jika ada file baru)
                if (imageFile) {
                        // Siapkan Data untuk Cloudinary
                        const formData = new FormData();
                        formData.append('file', imageFile);
                        
                        // ⚠️ PENTING: Pastikan Tuan sudah buat "Upload Preset" (Unsigned) di Dashboard Cloudinary
                        // Ganti 'promptku_preset' dengan nama preset Tuan (misal: 'ml_default' atau bikin baru)
                        formData.append('upload_preset', 'galeri-prompt-uploads'); 
                        
                        // Kirim ke Cloudinary
                        const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                            method: 'POST',
                            body: formData
                        });

                        if (!cloudinaryRes.ok) {
                            throw new Error('Gagal upload gambar ke Cloudinary. Cek Upload Preset!');
                        }

                        const cloudinaryData = await cloudinaryRes.json();
                        imageUrl = cloudinaryData.secure_url; // Ambil URL hasil upload
                    }

                // 4. Siapkan Data untuk Disimpan
                const promptData = {
                    title: title,
                    title_lowercase: title.toLowerCase(), // Helper untuk pencarian
                    socialUrl: socialUrl,
                    category: category,
                    tags: tags,
                    promptText: promptText, // Simpan teks prompt
                    imageUrl: imageUrl,
                    isPremium: isPremium,
                    
                    // Simpan Data Mayar (Hanya kalau Premium)
                    mayarLink: isPremium ? mayarLink : '',
                    mayarSku: isPremium ? mayarSku : '', // <--- FIELD BARU KITA
                    
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                // 5. Simpan ke Firestore
                if (promptId) {
                    // --- MODE EDIT ---
                    await db.collection('prompts').doc(promptId).update(promptData);
                    Swal.fire('Berhasil!', 'Prompt berhasil diperbarui.', 'success');
                } else {
                    // --- MODE TAMBAH BARU ---
                    promptData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    promptData.creatorId = currentUser.uid;
                    promptData.user = currentUser.displayName || 'Anonymous';
                    promptData.likeCount = 0;
                    promptData.likedBy = [];

                    await db.collection('prompts').add(promptData);
                    Swal.fire('Berhasil!', 'Prompt baru berhasil ditambahkan!', 'success');
                }

                // 6. Bersih-bersih
                UI.hideModal('prompt-modal');
                UI.els.promptForm.reset();
                // Reset preview gambar
                document.getElementById('prompt-image-preview').src = '';
                document.getElementById('image-preview-wrapper').style.display = 'none';
                document.getElementById('file-input-wrapper').style.display = 'block';

                // Refresh Grid
                applyFilters();

            } catch (error) {
                console.error("Error saving prompt: ", error);
                Swal.fire('Gagal', 'Terjadi kesalahan saat menyimpan prompt: ' + error.message, 'error');
            } finally {
                // Kembalikan Tombol
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    }

    // 4. Modal Interactions
    const viewModal = document.getElementById('view-prompt-modal');
    if (viewModal) { 
        const viewModalCopyBtn = document.getElementById('view-modal-copy-btn');
        const viewModalCloseBtn = viewModal.querySelector('.close-btn-fullview');
        if(viewModalCloseBtn) viewModalCloseBtn.addEventListener('click', () => UI.hideModal('view-prompt-modal'));

        if(viewModalCopyBtn) {
            viewModalCopyBtn.addEventListener('click', (e) => {
                const btn = e.currentTarget;
                // Jika Premium (Beli), buka link
                if (btn.dataset.isPremium === "true") {
                    triggerMayarCheckout(btn.dataset.mayarLink); // <--- UBAH BARIS INI
                    return; 
                }

                // Jika Gratis, Copy Logic
                const textToCopy = decodeURIComponent(btn.dataset.promptText);
                const isMobile = window.innerWidth <= 768;

                if (isMobile) {
                    const popupTextArea = document.getElementById('popup-prompt-textarea');
                    if(popupTextArea) popupTextArea.value = textToCopy;
                    UI.showModal('prompt-text-popup'); 
                    const popupCopyBtn = document.getElementById('popup-copy-btn');
                    if (popupCopyBtn) {
                        popupCopyBtn.classList.remove('copied');
                        popupCopyBtn.querySelector('span:last-child').textContent = 'Salin Prompt';
                    }
                } else {
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        const textSpan = btn.querySelector('span:last-child');
                        const originalText = "Salin Prompt";
                        btn.classList.add('copied');
                        textSpan.textContent = 'Berhasil Tersalin!';
                        setTimeout(() => {
                            btn.classList.remove('copied');
                            textSpan.textContent = originalText;
                        }, 2000);
                    });
                }
            });
        }
        
        // Like & Generate Listeners inside View Modal
        const viewModalLikeBtn = document.getElementById('view-modal-like-btn');
        if (viewModalLikeBtn) {
            viewModalLikeBtn.addEventListener('click', (e) => {
                const promptId = e.currentTarget.dataset.id;
                if (promptId) toggleLikePrompt(promptId);
            });
        }
    }

    // 5. Filter & Search Inputs
    [UI.els.categoryFilter, UI.els.textFilterDesktop, UI.els.textFilterMobile, UI.els.sortByFilter].forEach(el => {
        if (el) el.addEventListener('input', applyFilters);
    });

    if (UI.els.textFilterDesktop) {
        UI.els.textFilterDesktop.addEventListener('input', UI.toggleClearButton);
    }
    if (UI.els.clearSearchBtn) {
        UI.els.clearSearchBtn.addEventListener('click', () => {
            if (UI.els.textFilterDesktop) UI.els.textFilterDesktop.value = ''; 
            UI.toggleClearButton(); 
            applyFilters();     
        });
    }

    if (UI.els.resetFiltersBtn) {
        UI.els.resetFiltersBtn.addEventListener('click', () => {
            handleCategoryClick('all');
            if(UI.els.textFilterDesktop) UI.els.textFilterDesktop.value = '';
            if(UI.els.textFilterMobile) UI.els.textFilterMobile.value = '';
            if(UI.els.sortByFilter) UI.els.sortByFilter.value = 'date_desc';
            applyFilters();
        });
    }

    // [BARU] 5.5. INTERAKSI GRID (KLIK KARTU, EDIT, DELETE)
    if (UI.els.promptGrid) {
        UI.els.promptGrid.addEventListener('click', (e) => {
            
            // --- [PINDAHAN] D. CEK DULU: TOMBOL PREMIUM / BELI ---
            // (Wajib ditaruh paling atas sebelum logika kartu/modal)
            const premiumBtn = e.target.closest('.premium-btn');
            if (premiumBtn) {
                e.stopPropagation(); 
                const link = premiumBtn.dataset.mayarLink;
                triggerMayarCheckout(link); 
                return; // Stop di sini agar tidak membuka modal
            }
            
            // A. Handle Tombol Edit
            const editBtn = e.target.closest('.edit-btn');
            if (editBtn) {
                e.stopPropagation();
                const id = editBtn.dataset.id;
                const promptData = allPrompts.find(p => p.id === id);
                if (promptData) {
                    UI.fillPromptModal(promptData, currentUser?.isAdmin);
                    UI.showModal('prompt-modal');
                }
                return;
            }

            // B. Handle Tombol Hapus
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                const id = deleteBtn.dataset.id;
                deletePrompt(id);
                return;
            }

            // C. Handle Klik Kartu (Buka Modal Preview)
            const cardContainer = e.target.closest('.card-image-container');
            if (cardContainer) {
                // Cegah jika yang diklik adalah tombol copy/beli/link overlay
                if (e.target.closest('.copy-btn-overlay') || 
                    e.target.closest('a') || 
                    e.target.closest('button')) {
                    return;
                }

                const index = parseInt(cardContainer.dataset.index);
                currentViewIndex = index;
                
                if (currentFilteredPrompts[index]) {
                    UI.showFullViewModal(
                        currentFilteredPrompts[index], 
                        currentUser, 
                        currentViewIndex, 
                        currentFilteredPrompts.length
                    );
                }
            }
        });
    }


    // 6. Navigation Buttons
    if (UI.els.modalNavPrev) UI.els.modalNavPrev.addEventListener('click', () => {
        currentViewIndex--;
        if (currentViewIndex < 0) currentViewIndex = 0;
        UI.showFullViewModal(currentFilteredPrompts[currentViewIndex], currentUser, currentViewIndex, currentFilteredPrompts.length);
    });
    if (UI.els.modalNavNext) UI.els.modalNavNext.addEventListener('click', () => {
        currentViewIndex++;
        if (currentViewIndex >= currentFilteredPrompts.length) currentViewIndex = currentFilteredPrompts.length - 1;
        UI.showFullViewModal(currentFilteredPrompts[currentViewIndex], currentUser, currentViewIndex, currentFilteredPrompts.length);
    });

    // 7. General UI Events
    document.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', () => UI.hideModal(btn.dataset.modal)));
    
    // Checkbox Premium Toggle UI
    if (UI.els.promptPremiumCheck) {
        UI.els.promptPremiumCheck.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            if(UI.els.mayarLinkContainer) UI.els.mayarLinkContainer.style.display = isChecked ? 'block' : 'none';
            if(UI.els.promptMayarLink) UI.els.promptMayarLink.required = isChecked;
            if(UI.els.promptTextInput) UI.els.promptTextInput.placeholder = isChecked ? "Tulis deskripsi singkat / teaser di sini. JANGAN TULIS PROMPT ASLI!" : "Isi Prompt";
        });
    }

    // Header & Mobile Nav Actions
    const openNewPromptModal = (e) => {
        e.preventDefault();
        // Param 1: null (data kosong), Param 2: status admin
        UI.fillPromptModal(null, currentUser?.isAdmin); 
        UI.showModal('prompt-modal');
    };

    if (UI.els.navSearch) UI.els.navSearch.addEventListener('click', (e) => { e.preventDefault(); if(UI.els.searchOverlay) UI.els.searchOverlay.classList.toggle('active'); window.scrollTo(0, 0); });
    if(UI.els.addPromptLinkMobile) UI.els.addPromptLinkMobile.addEventListener('click', openNewPromptModal);
    if (UI.els.navAddPrompt) UI.els.navAddPrompt.addEventListener('click', openNewPromptModal);
    if (UI.els.navAddPromptMobile) UI.els.navAddPromptMobile.addEventListener('click', openNewPromptModal);

    // Header Pinterest Style Logic
    if (UI.els.loginBtnDesktop) UI.els.loginBtnDesktop.addEventListener('click', () => UI.showModal('auth-modal'));
    if (UI.els.logoutBtnDesktop) UI.els.logoutBtnDesktop.addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logoutUser(auth);
        if(UI.els.profileDropdown) UI.els.profileDropdown.classList.remove('show');
    });
    if (UI.els.dropdownTrigger && UI.els.profileDropdown) {
        UI.els.dropdownTrigger.addEventListener('click', (e) => { e.stopPropagation(); UI.els.profileDropdown.classList.toggle('show'); });
    }
    document.addEventListener('click', (e) => {
        if (UI.els.profileDropdown && UI.els.profileDropdown.classList.contains('show')) {
            if (!UI.els.profileDropdown.contains(e.target) && !UI.els.dropdownTrigger.contains(e.target)) {
                UI.els.profileDropdown.classList.remove('show');
            }
        }
    });
}