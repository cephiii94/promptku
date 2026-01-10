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
            text: 'Mohon Log In dulu untuk mengakses halaman Generator.',
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

    const sortBy = UI.els.sortByFilter ? UI.els.sortByFilter.value : 'title_asc';
    
    // Reset Filters Button Logic
    if (UI.els.resetFiltersBtn) {
        if (category !== 'all' || searchTerm !== '' || sortBy !== 'title_asc') {
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
    
    switch(sortBy) {
        case 'title_asc': filtered.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
        case 'title_desc': filtered.sort((a, b) => (b.title || '').localeCompare(a.title || '')); break;
        case 'popular': filtered.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0) || (a.title || '').localeCompare(b.title || '')); break;
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
    if(UI.els.promptForm) {
        UI.els.promptForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: 'Login untuk menyimpan.' });
        
            const fileInput = document.getElementById('prompt-imageFile');
            const file = fileInput ? fileInput.files[0] : null;
            const existingImageUrl = document.getElementById('prompt-imageUrl').value;
            const promptId = document.getElementById('prompt-id').value;
        
            if (!promptId && !file) return Swal.fire({ icon: 'warning', title: 'Gambar Kosong', text: 'Silakan upload gambar.' });
        
            const submitButton = UI.els.promptForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="material-icons spin">hourglass_top</span>'; 
        
            let imageUrl = existingImageUrl; 
            if (file) {
                try {
                    const signatureResponse = await fetch('/.netlify/functions/generate-signature');
                    if (!signatureResponse.ok) throw new Error('Signature failed');
                    const { signature, timestamp, api_key } = await signatureResponse.json();
                    
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('api_key', api_key);
                    formData.append('timestamp', timestamp);
                    formData.append('signature', signature);
                    formData.append('upload_preset', 'galeri-prompt-uploads'); 
                    
                    const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
                    const response = await fetch(UPLOAD_URL, { method: 'POST', body: formData });
                    if (!response.ok) throw new Error('Cloudinary failed');
                    const data = await response.json();
                    imageUrl = data.secure_url; 
                } catch (error) {
                    Swal.fire({ icon: 'error', title: 'Upload Gagal', text: 'Coba lagi nanti.' });
                    submitButton.disabled = false;
                    submitButton.innerHTML = '<span class="material-icons">save</span>';
                    return;
                }
            }
        
            const socialUrl = document.getElementById('prompt-socialUrl').value;
            const isPremium = document.getElementById('prompt-isPremium') ? document.getElementById('prompt-isPremium').checked : false;
            const mayarLink = document.getElementById('prompt-mayarLink') ? document.getElementById('prompt-mayarLink').value : '';

            const promptData = {
                id: promptId,
                title: document.getElementById('prompt-title').value,
                user: extractUsernameFromUrl(socialUrl),
                socialUrl: socialUrl,
                category: document.getElementById('prompt-category').value, 
                promptText: document.getElementById('prompt-text').value,
                imageUrl: imageUrl,
                tags: document.getElementById('prompt-tags').value,
                isPremium: isPremium,
                mayarLink: isPremium ? mayarLink : '' 
            };
            if (!promptId) promptData.creatorId = currentUser.uid;
        
            await savePrompt(promptData); 
            submitButton.disabled = false;
            submitButton.innerHTML = '<span class="material-icons">save</span>';
        });
    }

    // 3. Grid Interaction (View, Edit, Delete, Copy)
    if(UI.els.promptGrid) {
        UI.els.promptGrid.addEventListener('click', (e) => {
            const target = e.target;
            const editBtn = target.closest('.edit-btn');
            const deleteBtn = target.closest('.delete-btn');
            const copyBtn = target.closest('.copy-btn-overlay:not(.premium-btn)'); 
            const clickedFilter = target.closest('[data-filter-type]');
            const viewBtn = target.closest('[data-action="view-prompt"]'); 

            if (viewBtn && !editBtn && !deleteBtn && !copyBtn && !clickedFilter) {
                const index = parseInt(viewBtn.dataset.index, 10);
                if (!isNaN(index)) {
                    currentViewIndex = index;
                    const promptData = currentFilteredPrompts[currentViewIndex];
                    if (promptData) UI.showFullViewModal(promptData, currentUser, currentViewIndex, currentFilteredPrompts.length);
                }
                return;
            }

            if (clickedFilter) {
                const { filterType, filterValue } = clickedFilter.dataset;
                if(UI.els.textFilterDesktop) UI.els.textFilterDesktop.value = '';
                if(UI.els.textFilterMobile) UI.els.textFilterMobile.value = '';
                
                if (filterType === 'category') handleCategoryClick(filterValue);
                else if (filterType === 'tag') {
                    if(UI.els.textFilterDesktop) {
                        UI.els.textFilterDesktop.value = filterValue;
                        UI.toggleClearButton();
                    }
                    handleCategoryClick('all'); 
                }
                window.scrollTo(0, 0); 
                return;
            }

            if (editBtn) {
                const promptToEdit = allPrompts.find(p => p.id === editBtn.dataset.id);
                if (promptToEdit) {
                    UI.fillPromptModal(promptToEdit);
                    UI.showModal('prompt-modal');
                }
            }
            if (deleteBtn) deletePrompt(deleteBtn.dataset.id);
            
            if (copyBtn) {
                const textToCopy = decodeURIComponent(copyBtn.dataset.promptText);
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const textSpan = copyBtn.querySelector('.copy-text');
                    const originalText = textSpan.textContent; 
                    copyBtn.classList.add('copied');
                    textSpan.textContent = 'Tersalin!';
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        textSpan.textContent = originalText;
                    }, 2000);
                });
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
                    window.open(btn.dataset.mayarLink, '_blank');
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
            if(UI.els.sortByFilter) UI.els.sortByFilter.value = 'title_asc';
            applyFilters();
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
    if(UI.els.addPromptLinkMobile) UI.els.addPromptLinkMobile.addEventListener('click', (e) => { e.preventDefault(); UI.showModal('prompt-modal'); });
    if (UI.els.navSearch) UI.els.navSearch.addEventListener('click', (e) => { e.preventDefault(); if(UI.els.searchOverlay) UI.els.searchOverlay.classList.toggle('active'); window.scrollTo(0, 0); });
    if (UI.els.navAddPrompt) UI.els.navAddPrompt.addEventListener('click', (e) => { e.preventDefault(); UI.showModal('prompt-modal'); });
    if (UI.els.navAddPromptMobile) UI.els.navAddPromptMobile.addEventListener('click', (e) => { e.preventDefault(); UI.showModal('prompt-modal'); });
    
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