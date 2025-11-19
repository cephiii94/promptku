// Menunggu DOM dimuat sepenuhnya
document.addEventListener('DOMContentLoaded', async () => {

    // =========================================================================
    // 1. KONFIGURASI & LIST KATEGORI RESMI
    // =========================================================================

    // --- DAFTAR KATEGORI RESMI (Master Data) ---
    const OFFICIAL_CATEGORIES = [
        "Character",
        "Filter",
        "Effect",
        "Anime",
 
        "Lainnya"
    ];

    // Ambil konfigurasi Firebase dari Netlify
    let firebaseConfig;
    try {
        const response = await fetch('/.netlify/functions/get-firebase-config');
        if (!response.ok) throw new Error('Gagal mengambil konfigurasi Firebase.');
        firebaseConfig = await response.json();
    } catch (error) {
        console.error("Config Error:", error);
    }

    const CLOUDINARY_CLOUD_NAME = "dx4pxe7ji"; 

    // Inisialisasi Firebase
    if (firebaseConfig && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else if (!firebase.apps.length) {
        console.error("Firebase config missing, skipping initialization.");
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();
    
    // =========================================================================
    // 2. DOM ELEMENT SELECTORS
    // =========================================================================
    
    const promptGrid = document.getElementById('prompt-grid');
    const categoryFilter = document.getElementById('category-filter');
    const sortByFilter = document.getElementById('sort-by-filter');
    const textFilterDesktop = document.getElementById('filter-input');
    const textFilterMobile = document.getElementById('filter-input-mobile');
    
    // Container untuk Chip Kategori di Home
    const homeCategoryList = document.getElementById('home-category-list');

    const addPromptLinkMobile = document.getElementById('add-prompt-link-mobile');
    const authContainerMobile = document.getElementById('auth-container-mobile');
    const searchBtn = document.getElementById('search-btn');
    const searchOverlay = document.getElementById('search-form-overlay');
    
    const loginForm = document.getElementById('login-form');
    const promptForm = document.getElementById('prompt-form');
    
    const navSearch = document.getElementById('nav-search');
    const navAddPrompt = document.getElementById('nav-add-prompt');
    const navAddPromptMobile = document.getElementById('nav-add-prompt-mobile');
    const navAuthContainer = document.getElementById('nav-auth-container');
    const navTheme = document.getElementById('nav-theme');
    
    const imagePreviewWrapper = document.getElementById('image-preview-wrapper');
    const fileInputWrapper = document.getElementById('file-input-wrapper');
    const promptImagePreview = document.getElementById('prompt-image-preview');
    const deleteImageBtn = document.getElementById('delete-image-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    
    const bottomNavMobile = document.querySelector('.bottom-nav-mobile');
    const modalNavPrev = document.getElementById('modal-nav-prev');
    const modalNavNext = document.getElementById('modal-nav-next');

    // Header Desktop (Pinterest Style) Selectors
    const authButtonsDesktop = document.getElementById('auth-buttons-desktop');
    const userProfileDesktop = document.getElementById('user-profile-desktop');
    const headerAvatar = document.getElementById('header-avatar');
    const dropdownUsername = document.getElementById('dropdown-username');
    const dropdownEmail = document.getElementById('dropdown-email');
    const loginBtnDesktop = document.getElementById('login-btn-desktop');
    const logoutBtnDesktop = document.getElementById('logout-btn-desktop');
    const dropdownTrigger = document.getElementById('profile-dropdown-trigger');
    const profileDropdown = document.getElementById('profile-dropdown-menu');
    const profileIconContainer = document.querySelector('.profile-icon-container');


    // =========================================================================
    // 3. HELPER FUNCTIONS
    // =========================================================================
    
    const extractUsernameFromUrl = (url) => {
        if (!url || typeof url !== 'string') return '';
        try {
            const cleanedUrl = url.split('?')[0].replace(/\/$/, '');
            const parts = cleanedUrl.split('/');
            const username = parts[parts.length - 1];
            return username.charAt(0).toUpperCase() + username.slice(1);
        } catch (error) {
            return '';
        }
    };

    // =========================================================================
    // 4. DATA & STATE
    // =========================================================================

    let allPrompts = [];
    let currentUser = null;
    let currentFilteredPrompts = [];
    let currentViewIndex = 0;
    let activeCategory = 'all'; 


    // =========================================================================
    // 5. LOGIKA KATEGORI & DATA FETCHING
    // =========================================================================

    const populateCategoryOptions = () => {
        // 1. Isi Dropdown Filter
        if (categoryFilter) {
            categoryFilter.innerHTML = '<option value="all">Semua Kategori</option>';
            OFFICIAL_CATEGORIES.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categoryFilter.appendChild(option);
            });
        }

        // 2. Isi Dropdown Form Upload
        const promptCategoryInput = document.getElementById('prompt-category');
        if (promptCategoryInput && promptCategoryInput.tagName === 'SELECT') {
            promptCategoryInput.innerHTML = '<option value="" disabled selected>-- Pilih Kategori --</option>';
            OFFICIAL_CATEGORIES.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                promptCategoryInput.appendChild(option);
            });
        }

        // 3. Isi List Kategori di Home (Chips)
        if (homeCategoryList) {
            homeCategoryList.innerHTML = '';
            
            const allChip = document.createElement('button');
            allChip.className = 'category-chip active';
            allChip.textContent = 'Semua';
            allChip.dataset.value = 'all';
            allChip.addEventListener('click', () => handleCategoryClick('all'));
            homeCategoryList.appendChild(allChip);

            OFFICIAL_CATEGORIES.forEach(category => {
                const chip = document.createElement('button');
                chip.className = 'category-chip';
                chip.textContent = category;
                chip.dataset.value = category;
                chip.addEventListener('click', () => handleCategoryClick(category));
                homeCategoryList.appendChild(chip);
            });
        }
    };

    const handleCategoryClick = (categoryValue) => {
        activeCategory = categoryValue;
        
        const chips = document.querySelectorAll('.category-chip');
        chips.forEach(chip => {
            if (chip.dataset.value === categoryValue) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });

        if (categoryFilter) categoryFilter.value = categoryValue;
        applyFilters();
    };

    const fetchAndRenderPrompts = async () => {
        try {
            const snapshot = await db.collection("prompts").get();
            allPrompts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            populateCategoryOptions();
            applyFilters();
        } catch (error) {
            console.error("Gagal mengambil data: ", error);
            if(promptGrid) promptGrid.innerHTML = `<p style="text-align:center; padding:20px;">Gagal memuat data.</p>`;
        }
    };

    const applyFilters = () => {
        const category = activeCategory;
        
        let searchTerm = '';
        if (window.innerWidth > 768 && textFilterDesktop) {
            searchTerm = textFilterDesktop.value.toLowerCase();
        } else if (textFilterMobile) {
            searchTerm = textFilterMobile.value.toLowerCase();
        }

        const sortBy = sortByFilter ? sortByFilter.value : 'title_asc';
        
        if (resetFiltersBtn) {
            if (category !== 'all' || searchTerm !== '' || sortBy !== 'title_asc') {
                resetFiltersBtn.style.display = 'inline-flex';
            } else {
                resetFiltersBtn.style.display = 'none';
            }
        }

        let filtered = allPrompts;

        if (category !== 'all') {
            filtered = filtered.filter(p => p.category === category);
        }
        if (searchTerm) {
            filtered = filtered.filter(p =>
                (p.title && p.title.toLowerCase().includes(searchTerm)) ||
                (p.tags && p.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
            );
        }
        
        switch(sortBy) {
            case 'title_asc':
                filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                break;
            case 'title_desc':
                filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
                break;
            case 'popular':
                filtered.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0) || (a.title || '').localeCompare(b.title || ''));
                break;
        }

        currentFilteredPrompts = filtered;
        renderPrompts(filtered);
    };


    // =========================================================================
    // 6. RENDERING LOGIC
    // =========================================================================

    const renderPrompts = (promptsToRender) => {
        if (!promptGrid) return;

        if (!promptsToRender.length) {
             promptGrid.innerHTML = '<p style="text-align:center; width:100%; padding: 2rem; color: #666;">Tidak ada prompt yang ditemukan.</p>';
            return;
        }

        const allCardsHTML = promptsToRender.map((prompt, index) => {
            
            let adminActions = '';
            if (currentUser && (prompt.creatorId === currentUser.uid || currentUser.isAdmin === true)) {
                adminActions = `
                <div class="card-actions">
                    <button class="action-btn edit-btn" data-id="${prompt.id}"><span class="material-icons">edit</span><span class="tooltip">Edit</span></button>
                    <button class="action-btn delete-btn" data-id="${prompt.id}"><span class="material-icons">delete</span><span class="tooltip">Hapus</span></button>
                </div>`;
            }

            const overlayCategoryHtml = prompt.category 
                ? `<span class="image-overlay-text" data-filter-type="category" data-filter-value="${prompt.category}">${prompt.category}</span>` 
                : ''; 
            
            const copyButtonHtml = `
                <button class="copy-btn-overlay" data-prompt-text="${encodeURIComponent(prompt.promptText || '')}">
                    <span class="material-icons">content_copy</span>
                    <span class="copy-text">Salin</span>
                </button>`;

            const tagsHtml = (prompt.tags && Array.isArray(prompt.tags) && prompt.tags.length > 0)
                ? `<div class="card-tags-overlay">
                    ${prompt.tags.map(tag => `<span class="tag-overlay" data-filter-type="tag" data-filter-value="${tag}">${tag}</span>`).join('')}
                   </div>`
                : '';

            const displayImage = prompt.imageUrl || 'https://placehold.co/400x300?text=No+Image';

            return `
                <div class="card">
                    <div class="card-image-container" data-id="${prompt.id}" data-index="${index}" data-action="view-prompt">
                        <img src="${displayImage}" alt="Hasil gambar: ${prompt.title}" loading="lazy">
                        <span class="card-expand-hint material-icons">open_in_full</span>
                        ${overlayCategoryHtml}
                        ${adminActions}
                        <div class="card-prompt-overlay">
                            <div class="overlay-info">
                                <h4 class="overlay-title">${prompt.title || 'Tanpa Judul'}</h4>
                                <span class="overlay-user">by ${prompt.user || 'Anonymous'}</span>
                                ${tagsHtml}
                            </div>
                            ${copyButtonHtml}
                        </div>
                    </div>
                </div>`;
        }).join('');
        promptGrid.innerHTML = allCardsHTML;
    };
    

    // =========================================================================
    // 7. AUTH & CRUD (DENGAN NOTIFIKASI BARU)
    // =========================================================================

    const loginUser = (email, password) => auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            hideModal('login-modal');
            // [BARU] Notifikasi sukses login
            Swal.fire({
                icon: 'success',
                title: 'Login Berhasil!',
                text: 'Selamat datang kembali.',
                timer: 1500,
                showConfirmButton: false
            });
        })
        .catch(error => Swal.fire({ icon: 'error', title: 'Login Gagal', text: error.message }));

    // [BARU] Fungsi Logout dengan Konfirmasi & Notifikasi
    const logoutUser = () => {
        Swal.fire({
            title: 'Konfirmasi Logout',
            text: "Apakah Anda yakin ingin keluar?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#EF4444', // Merah
            cancelButtonColor: '#4B5563',
            confirmButtonText: 'Ya, Keluar',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                auth.signOut().then(() => {
                    Swal.fire({
                        icon: 'success',
                        title: 'Berhasil Keluar',
                        text: 'Sampai jumpa lagi!',
                        timer: 1500,
                        showConfirmButton: false
                    });
                });
            }
        });
    };

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

            hideModal('prompt-modal');
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
            showModal('login-modal');
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
                // Update view modal jika terbuka
                const viewModal = document.getElementById('view-prompt-modal');
                if(viewModal && viewModal.style.display === 'flex') {
                    const currentPromptId = currentFilteredPrompts[currentViewIndex].id;
                    if(currentPromptId === promptId) showViewPromptModal(promptData);
                }
                applyFilters();
            }
        } catch (error) {
            console.error("Like error:", error);
        }
    };


    // =========================================================================
    // 8. MODAL HANDLERS
    // =========================================================================

    const showModal = (modalId, data = null) => {
        if (bottomNavMobile) bottomNavMobile.style.display = 'none';
        const modal = document.getElementById(modalId);
        if(!modal) return;

        if (modalId === 'prompt-modal') {
            promptForm.reset();
            document.getElementById('modal-title').innerText = data ? 'Edit Prompt' : 'Tambah Prompt Baru';
            document.getElementById('prompt-id').value = data?.id || '';
            document.getElementById('prompt-title').value = data?.title || '';
            document.getElementById('prompt-socialUrl').value = data?.socialUrl || '';
            
            const categorySelect = document.getElementById('prompt-category');
            if(categorySelect) categorySelect.value = data?.category || ''; 

            document.getElementById('prompt-text').value = data?.promptText || '';
            document.getElementById('prompt-imageUrl').value = data?.imageUrl || '';
            document.getElementById('prompt-tags').value = (data?.tags && Array.isArray(data.tags)) ? data.tags.join(', ') : '';
            
            const fileInput = document.getElementById('prompt-imageFile');
            if (data && data.imageUrl) {
                promptImagePreview.src = data.imageUrl;
                imagePreviewWrapper.style.display = 'block';
                fileInputWrapper.style.display = 'none';
                fileInput.required = false; 
            } else {
                promptImagePreview.src = '';
                imagePreviewWrapper.style.display = 'none';
                fileInputWrapper.style.display = 'block';
                fileInput.required = true; 
            }
        }
        modal.style.display = 'flex';
    };

    const hideModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if(modal) modal.style.display = 'none';
        if (bottomNavMobile) bottomNavMobile.style.display = 'flex';
    };

    const showViewPromptModal = (data) => {
        const modalTitle = document.querySelector('#view-prompt-modal .modal-prompt-side h2');
        if (modalTitle) modalTitle.textContent = data.title;

        const modalImg = document.getElementById('view-modal-image');
        if(modalImg) modalImg.src = data.imageUrl;

        const modalPromptText = document.getElementById('view-modal-prompt-text');
        if(modalPromptText) modalPromptText.textContent = data.promptText;
        
        const authorText = document.getElementById('view-modal-author-text');
        const authorLink = document.getElementById('view-modal-author-link');
        
        if(authorText && authorLink) {
            if (data.user && data.socialUrl) {
                authorText.textContent = 'Prompt by: ';
                authorLink.href = data.socialUrl;
                authorLink.textContent = data.user;
                authorLink.style.display = 'inline';
            } else if (data.user) {
                authorText.textContent = 'Prompt by: ' + data.user;
                authorLink.style.display = 'none';
            } else {
                authorText.textContent = ''; 
                authorLink.style.display = 'none';
            }
        }
        
        const copyBtn = document.getElementById('view-modal-copy-btn');
        if(copyBtn) {
            copyBtn.dataset.promptText = encodeURIComponent(data.promptText);
            copyBtn.classList.remove('copied');
            const isMobile = window.innerWidth <= 768;
            copyBtn.querySelector('span:last-child').textContent = isMobile ? 'Lihat Prompt' : 'Salin Prompt';
        }

        if(modalNavPrev) modalNavPrev.style.display = (currentViewIndex === 0) ? 'none' : 'flex';
        if(modalNavNext) modalNavNext.style.display = (currentViewIndex === currentFilteredPrompts.length - 1) ? 'none' : 'flex';
        
        const generateBtn = document.getElementById('view-modal-generate-btn');
        if(generateBtn) generateBtn.dataset.promptText = encodeURIComponent(data.promptText);
        
        const likeBtn = document.getElementById('view-modal-like-btn');
        const likeCountSpan = document.getElementById('view-modal-like-count');
        
        if(likeBtn && likeCountSpan) {
            likeBtn.dataset.id = data.id;
            likeCountSpan.textContent = data.likeCount || 0;
            const isLiked = currentUser && data.likedBy && data.likedBy.includes(currentUser.uid);
            if (isLiked) {
                likeBtn.classList.add('liked');
                likeBtn.querySelector('.material-icons').textContent = 'favorite';
            } else {
                likeBtn.classList.remove('liked');
                likeBtn.querySelector('.material-icons').textContent = 'favorite_border';
            }
        }

        const viewPromptModal = document.getElementById('view-prompt-modal');
        if(viewPromptModal) viewPromptModal.style.display = 'flex';
        if (bottomNavMobile) bottomNavMobile.style.display = 'none';
    };

    const navigateToPrompt = (direction) => {
        currentViewIndex += direction;
        if (currentViewIndex < 0) currentViewIndex = 0;
        if (currentViewIndex >= currentFilteredPrompts.length) currentViewIndex = currentFilteredPrompts.length - 1;
        const promptData = currentFilteredPrompts[currentViewIndex];
        if (promptData) showViewPromptModal(promptData);
    };

    // [UPDATE] UI Update Function - Tampilkan Badge Admin & Fix Mobile Nav
    const updateAuthStateUI = (user) => {
        if (user) {
            if(authButtonsDesktop) authButtonsDesktop.style.display = 'none';
            if(userProfileDesktop) userProfileDesktop.style.display = 'flex';
            
            if(headerAvatar) headerAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=2563EB&color=fff`;
            
            if(dropdownUsername) {
                let nameHTML = user.displayName || 'Pengguna';
                if (currentUser && currentUser.isAdmin) {
                    nameHTML += ` <span style="background-color: #EF4444; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; vertical-align: middle; margin-left: 6px; font-weight: 700;">ADMIN</span>`;
                }
                dropdownUsername.innerHTML = nameHTML;
            }

            if(dropdownEmail) dropdownEmail.textContent = user.email;

            if(authContainerMobile) {
                authContainerMobile.innerHTML = `<button class="auth-icon-btn logout" id="logout-btn-mobile-icon"><span class="material-icons">logout</span></button>`;
                document.getElementById('logout-btn-mobile-icon')?.addEventListener('click', logoutUser);
            }
            
            if (navAuthContainer) {
                navAuthContainer.innerHTML = `
                    <a href="#" class="nav-link-inner" id="nav-logout" style="display: flex; flex-direction: column; align-items: center; color: inherit; text-decoration: none; width: 100%;">
                        <span class="material-icons">logout</span>
                        <span class="nav-label">Logout</span>
                    </a>`;
                document.getElementById('nav-logout').addEventListener('click', (e) => { 
                    e.preventDefault(); 
                    logoutUser(); 
                });
            }

            if(addPromptLinkMobile) addPromptLinkMobile.style.display = 'flex';
            if(navAddPrompt) navAddPrompt.style.display = 'flex';

        } else {
            if(authButtonsDesktop) authButtonsDesktop.style.display = 'block';
            if(userProfileDesktop) userProfileDesktop.style.display = 'none';

            if(authContainerMobile) {
                authContainerMobile.innerHTML = `<button class="auth-icon-btn" id="login-btn-mobile-icon"><span class="material-icons">login</span></button>`;
                document.getElementById('login-btn-mobile-icon')?.addEventListener('click', () => showModal('login-modal'));
            }
            
            if (navAuthContainer) {
                navAuthContainer.innerHTML = `
                    <a href="#" class="nav-link-inner" id="nav-login" style="display: flex; flex-direction: column; align-items: center; color: inherit; text-decoration: none; width: 100%;">
                        <span class="material-icons">login</span>
                        <span class="nav-label">Login</span>
                    </a>`;
                document.getElementById('nav-login').addEventListener('click', (e) => { 
                    e.preventDefault(); 
                    showModal('login-modal'); 
                });
            }

            if(addPromptLinkMobile) addPromptLinkMobile.style.display = 'none';
            if(navAddPrompt) navAddPrompt.style.display = 'none';
        }
        
        applyFilters();
    };


    // =========================================================================
    // 9. EVENT LISTENERS
    // =========================================================================

    if(loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            loginUser(document.getElementById('login-email').value, document.getElementById('login-password').value);
        });
    }
    
    if(promptForm) {
        promptForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) {
                Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: 'Login untuk menyimpan.' });
                return;
            }
        
            const fileInput = document.getElementById('prompt-imageFile');
            const file = fileInput ? fileInput.files[0] : null;
            const existingImageUrl = document.getElementById('prompt-imageUrl').value;
            const promptId = document.getElementById('prompt-id').value;
        
            if (!promptId && !file) {
                Swal.fire({ icon: 'warning', title: 'Gambar Kosong', text: 'Silakan upload gambar.' });
                return;
            }
        
            const submitButton = promptForm.querySelector('button[type="submit"]');
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
            const promptData = {
                id: promptId,
                title: document.getElementById('prompt-title').value,
                user: extractUsernameFromUrl(socialUrl),
                socialUrl: socialUrl,
                category: document.getElementById('prompt-category').value, // Ambil dari select
                promptText: document.getElementById('prompt-text').value,
                imageUrl: imageUrl,
                tags: document.getElementById('prompt-tags').value,
            };
            if (!promptId) promptData.creatorId = currentUser.uid;
        
            await savePrompt(promptData); 
            submitButton.disabled = false;
            submitButton.innerHTML = '<span class="material-icons">save</span>';
        });
    }

    if(promptGrid) {
        promptGrid.addEventListener('click', (e) => {
            const target = e.target;
            const editBtn = target.closest('.edit-btn');
            const deleteBtn = target.closest('.delete-btn');
            const copyBtn = target.closest('.copy-btn-overlay'); 
            const clickedFilter = target.closest('[data-filter-type]');
            const viewBtn = target.closest('[data-action="view-prompt"]'); 

            if (viewBtn && !editBtn && !deleteBtn && !copyBtn && !clickedFilter) {
                const index = parseInt(viewBtn.dataset.index, 10);
                if (!isNaN(index)) {
                    currentViewIndex = index;
                    const promptData = currentFilteredPrompts[currentViewIndex];
                    if (promptData) showViewPromptModal(promptData);
                }
                return;
            }

            if (clickedFilter) {
                const { filterType, filterValue } = clickedFilter.dataset;
                if(textFilterDesktop) textFilterDesktop.value = '';
                if(textFilterMobile) textFilterMobile.value = '';
                
                if (filterType === 'category') {
                    handleCategoryClick(filterValue);
                } else if (filterType === 'tag') {
                    if(textFilterDesktop) {
                        textFilterDesktop.value = filterValue;
                        toggleClearButton(); // [TAMBAHAN] Tampilkan tombol X langsung
                    }
                    if(handleCategoryClick) handleCategoryClick('all'); 
                }
                window.scrollTo(0, 0); 
                return;
            }

            if (editBtn) {
                const promptToEdit = allPrompts.find(p => p.id === editBtn.dataset.id);
                if (promptToEdit) showModal('prompt-modal', promptToEdit);
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
    
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => hideModal(btn.dataset.modal));
    });

    const viewModal = document.getElementById('view-prompt-modal');
    if (viewModal) { 
        const viewModalCopyBtn = document.getElementById('view-modal-copy-btn');
        const viewModalCloseBtn = viewModal.querySelector('.close-btn-fullview');
        if(viewModalCloseBtn) viewModalCloseBtn.addEventListener('click', () => hideModal('view-prompt-modal'));

        if(viewModalCopyBtn) {
            viewModalCopyBtn.addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const textToCopy = decodeURIComponent(btn.dataset.promptText);
                const isMobile = window.innerWidth <= 768;

                if (isMobile) {
                    const popupTextArea = document.getElementById('popup-prompt-textarea');
                    if(popupTextArea) popupTextArea.value = textToCopy;
                    showModal('prompt-text-popup'); 
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

        const viewModalGenerateBtn = document.getElementById('view-modal-generate-btn');
        if (viewModalGenerateBtn) {
            viewModalGenerateBtn.addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const textToCopy = decodeURIComponent(btn.dataset.promptText);
                const isMobile = window.innerWidth <= 768;
                if (isMobile) window.open('https://gemini.google.com/app', '_blank');
                else {
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        const textSpan = btn.querySelector('span:last-child');
                        const originalText = "Generate";
                        if (textSpan) {
                            btn.classList.add('copied');
                            textSpan.textContent = 'Tersalin!';
                        }
                        window.open('https://gemini.google.com/app', '_blank');
                        setTimeout(() => {
                            btn.classList.remove('copied');
                            if (textSpan) textSpan.textContent = originalText;
                        }, 2500);
                    });
                }
            });
        }
        
        const viewModalLikeBtn = document.getElementById('view-modal-like-btn');
        if (viewModalLikeBtn) {
            viewModalLikeBtn.addEventListener('click', (e) => {
                const promptId = e.currentTarget.dataset.id;
                if (promptId) toggleLikePrompt(promptId);
            });
        }
    }

    const popupCopyBtn = document.getElementById('popup-copy-btn');
    if (popupCopyBtn) {
        popupCopyBtn.addEventListener('click', (e) => {
            const textToCopy = document.getElementById('popup-prompt-textarea').value;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const btn = e.currentTarget;
                btn.classList.add('copied');
                btn.querySelector('span:last-child').textContent = 'Berhasil Tersalin!';
            });
        });
    }

    if (modalNavPrev) modalNavPrev.addEventListener('click', () => navigateToPrompt(-1));
    if (modalNavNext) modalNavNext.addEventListener('click', () => navigateToPrompt(1));

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                if (modal.id === 'prompt-text-popup' || modal.id === 'prompt-modal') return;
                hideModal(modal.id);
            }
        });
    });
    
    if(searchBtn) searchBtn.addEventListener('click', () => searchOverlay.classList.toggle('active'));
    
    [categoryFilter, textFilterDesktop, textFilterMobile, sortByFilter].forEach(el => {
        if (el) el.addEventListener('input', applyFilters);
    });

    if(addPromptLinkMobile) addPromptLinkMobile.addEventListener('click', (e) => { e.preventDefault(); showModal('prompt-modal'); });
    
    if (navSearch) navSearch.addEventListener('click', (e) => { e.preventDefault(); if(searchOverlay) searchOverlay.classList.toggle('active'); window.scrollTo(0, 0); });
    if (navAddPrompt) navAddPrompt.addEventListener('click', (e) => { e.preventDefault(); showModal('prompt-modal'); });
    if (navAddPromptMobile) navAddPromptMobile.addEventListener('click', (e) => { e.preventDefault(); showModal('prompt-modal'); });
    if (navTheme) navTheme.addEventListener('click', (e) => { e.preventDefault(); Swal.fire({ icon: 'info', title: 'Segera Hadir!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 }); });

    if(deleteImageBtn) {
        deleteImageBtn.addEventListener('click', () => {
            imagePreviewWrapper.style.display = 'none';
            fileInputWrapper.style.display = 'block';
            document.getElementById('prompt-imageUrl').value = '';
            promptImagePreview.src = '';
            document.getElementById('prompt-imageFile').required = true;
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            handleCategoryClick('all');
            if(textFilterDesktop) textFilterDesktop.value = '';
            if(textFilterMobile) textFilterMobile.value = '';
            if(sortByFilter) sortByFilter.value = 'title_asc';
            applyFilters();
        });
    }

    // =========================================================================
    // LOGIKA TOMBOL X (CLEAR SEARCH)
    // =========================================================================
    const clearSearchBtn = document.getElementById('clear-search-btn');

    // 1. Fungsi untuk Cek Kapan Tombol X Muncul
    const toggleClearButton = () => {
        if (!clearSearchBtn || !textFilterDesktop) return;
        
        if (textFilterDesktop.value.trim().length > 0) {
            clearSearchBtn.classList.remove('hidden'); // Tampilkan jika ada teks
        } else {
            clearSearchBtn.classList.add('hidden');    // Sembunyikan jika kosong
        }
    };

    // 2. Event saat mengetik (munculkan/sembunyikan X)
    if (textFilterDesktop) {
        textFilterDesktop.addEventListener('input', toggleClearButton);
    }

    // 3. Event saat tombol X diklik (Hapus teks & Refresh hasil)
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (textFilterDesktop) textFilterDesktop.value = ''; // Kosongkan input
            toggleClearButton(); // Sembunyikan tombol X lagi
            applyFilters();      // Refresh grid prompt (kembali ke semua)
        });
    }

    // [TAMBAHAN] Trigger toggleClearButton saat tag diklik
    // Ini memastikan tombol X muncul langsung tanpa harus ketik
    if (textFilterDesktop) {
        const originalListener = textFilterDesktop.addEventListener.bind(textFilterDesktop);
        // Setelah input berisi value dari tag, panggil toggleClearButton
        Object.defineProperty(textFilterDesktop, '__updateSearchFromTag', {
            value: function() {
                toggleClearButton();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' || event.key === 'Esc') {
            const viewModal = document.getElementById('view-prompt-modal');
            if (viewModal && viewModal.style.display === 'flex') { hideModal('view-prompt-modal'); return; }
            const popupModal = document.getElementById('prompt-text-popup');
            if (popupModal && popupModal.style.display === 'flex') { hideModal('prompt-text-popup'); return; }
            const loginModal = document.getElementById('login-modal');
            if (loginModal && loginModal.style.display === 'flex') { hideModal('login-modal'); return; }
        }
    });

    // Header Pinterest Listeners (DESKTOP)
    if (loginBtnDesktop) loginBtnDesktop.addEventListener('click', () => showModal('login-modal'));
    if (logoutBtnDesktop) logoutBtnDesktop.addEventListener('click', (e) => {
        e.preventDefault();
        // Menggunakan fungsi logoutUser baru yang ada konfirmasinya
        logoutUser();
        if(profileDropdown) profileDropdown.classList.remove('show');
    });
    if (dropdownTrigger && profileDropdown) {
        dropdownTrigger.addEventListener('click', (e) => { e.stopPropagation(); profileDropdown.classList.toggle('show'); });
    }
    if (profileIconContainer) {
        profileIconContainer.addEventListener('click', () => Swal.fire({ icon: 'info', title: 'Profil', text: `Login sebagai: ${currentUser ? currentUser.email : ''}` }));
    }
    document.addEventListener('click', (e) => {
        if (profileDropdown && profileDropdown.classList.contains('show')) {
            if (!profileDropdown.contains(e.target) && !dropdownTrigger.contains(e.target)) {
                profileDropdown.classList.remove('show');
            }
        }
    });

    // =========================================================================
    // 10. INIT
    // =========================================================================

    auth.onAuthStateChanged(async (user) => { 
        if (user) {
            const tokenResult = await user.getIdTokenResult(true); 
            currentUser = user;
            currentUser.isAdmin = tokenResult.claims.admin === true;
        } else {
            currentUser = null;
        }
        updateAuthStateUI(user);
    });

    fetchAndRenderPrompts();
    const yearSpan = document.getElementById('current-year');
    if(yearSpan) yearSpan.textContent = new Date().getFullYear();
});