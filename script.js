// Menunggu DOM dimuat sepenuhnya
document.addEventListener('DOMContentLoaded', async () => {

    // === [TAMBAHAN BARU] CEK PESAN PERINGATAN ===
    // Kalau ada titipan pesan dari Satpam, tampilkan Notifikasi!
    if (sessionStorage.getItem('alert_must_login')) {
        Swal.fire({
            icon: 'warning',
            title: 'Akses Dibatasi',
            text: 'Mohon Log In dulu untuk mengakses halaman Generator.',
            confirmButtonColor: '#F59E0B' // Warna oranye biar senada
        });
        // Hapus pesan supaya tidak muncul terus-menerus kalau di-refresh
        sessionStorage.removeItem('alert_must_login');
    }

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
    const clearSearchBtn = document.getElementById('clear-search-btn');
    
    // Container untuk Chip Kategori di Home
    const homeCategoryList = document.getElementById('home-category-list');

    // Container Pagination
    const paginationContainer = document.getElementById('pagination-container');

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

    // State Pagination
    let currentPage = 1;
    const itemsPerPage = 12; // Jumlah kartu per halaman


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
        
        // Logika tombol Reset Filter
        if (resetFiltersBtn) {
            if (category !== 'all' || searchTerm !== '' || sortBy !== 'title_asc') {
                resetFiltersBtn.style.display = 'inline-flex';
            } else {
                resetFiltersBtn.style.display = 'none';
            }
        }

        let filtered = allPrompts;

        // Filter Kategori
        if (category !== 'all') {
            filtered = filtered.filter(p => p.category === category);
        }
        // Filter Pencarian
        if (searchTerm) {
            filtered = filtered.filter(p =>
                (p.title && p.title.toLowerCase().includes(searchTerm)) ||
                (p.tags && p.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
            );
        }
        
        // Sorting
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
        
        // [PENTING] Reset ke halaman 1 setiap kali filter berubah
        currentPage = 1;
        
        // [PENTING] Panggil fungsi pagination untuk render
        updatePageDisplay();
    };


    // =========================================================================
    // 6. PAGINATION LOGIC
    // =========================================================================

    const updatePageDisplay = () => {
        if (!paginationContainer) return;

        // 1. Hitung total halaman
        const totalItems = currentFilteredPrompts.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        // Jika tidak ada data
        if (totalItems === 0) {
            paginationContainer.innerHTML = '';
            renderPrompts([]); 
            return;
        }

        // 2. Ambil potongan data (slice) untuk halaman saat ini
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const promptsToShow = currentFilteredPrompts.slice(start, end);

        // 3. Render kartu prompt
        renderPrompts(promptsToShow);

        // 4. Generate HTML Tombol Pagination
        let paginationHTML = '';

        // Tombol Prev
        paginationHTML += `
            <button class="page-btn prev-btn" ${currentPage === 1 ? 'disabled' : ''}>
                <span class="material-icons">chevron_left</span>
            </button>
        `;

        const maxVisibleButtons = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);

        if (endPage - startPage + 1 < maxVisibleButtons) {
            startPage = Math.max(1, endPage - maxVisibleButtons + 1);
        }

        if (startPage > 1) {
            paginationHTML += `<button class="page-btn num-btn" data-page="1">1</button>`;
            if (startPage > 2) paginationHTML += `<span style="padding:0 5px; color:#aaa;">...</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="page-btn num-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">
                    ${i}
                </button>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) paginationHTML += `<span style="padding:0 5px; color:#aaa;">...</span>`;
            paginationHTML += `<button class="page-btn num-btn" data-page="${totalPages}">${totalPages}</button>`;
        }

        // Tombol Next
        paginationHTML += `
            <button class="page-btn next-btn" ${currentPage === totalPages ? 'disabled' : ''}>
                <span class="material-icons">chevron_right</span>
            </button>
        `;

        paginationContainer.innerHTML = paginationHTML;

        // 5. Event Listener Pagination
        paginationContainer.querySelectorAll('.num-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                updatePageDisplay();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

        const prevBtn = paginationContainer.querySelector('.prev-btn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    updatePageDisplay();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        }

        const nextBtn = paginationContainer.querySelector('.next-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    updatePageDisplay();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        }
    };


    // =========================================================================
    // 7. RENDERING LOGIC (DENGAN UPDATE PREMIUM)
    // =========================================================================

    const renderPrompts = (promptsToRender) => {
        if (!promptGrid) return;

        if (!promptsToRender.length) {
             promptGrid.innerHTML = '<p style="text-align:center; width:100%; padding: 2rem; color: #666;">Tidak ada prompt yang ditemukan.</p>';
            return;
        }

        const allCardsHTML = promptsToRender.map((prompt, index) => {
            
            const absoluteIndex = ((currentPage - 1) * itemsPerPage) + index;

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
            
            // [UPDATE PREMIUM] Logika Tombol di Overlay (Copy vs Beli)
            let actionButtonHtml = '';

            if (prompt.isPremium) {
                // Tampilan Tombol BELI (Untuk Premium)
                actionButtonHtml = `
                <a href="${prompt.mayarLink}" target="_blank" class="copy-btn-overlay premium-btn" style="text-decoration: none; background: #F59E0B; border-color: #D97706;">
                    <span class="material-icons">shopping_cart</span>
                    <span class="copy-text" style="display:inline; margin-left:4px;">Beli</span>
                </a>`;
            } else {
                // Tampilan Tombol COPY (Untuk Gratis)
                actionButtonHtml = `
                <button class="copy-btn-overlay" data-prompt-text="${encodeURIComponent(prompt.promptText || '')}">
                    <span class="material-icons">content_copy</span>
                    <span class="copy-text">Salin</span>
                </button>`;
            }

            // [UPDATE PREMIUM] Badge Premium (Opsional)
            const premiumBadge = prompt.isPremium 
                ? `<span style="position: absolute; top: 10px; right: 10px; background: #F59E0B; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; z-index: 5;">PREMIUM</span>`
                : '';


            const tagsHtml = (prompt.tags && Array.isArray(prompt.tags) && prompt.tags.length > 0)
                ? `<div class="card-tags-overlay">
                    ${prompt.tags.map(tag => `<span class="tag-overlay" data-filter-type="tag" data-filter-value="${tag}">${tag}</span>`).join('')}
                   </div>`
                : '';

            const displayImage = prompt.imageUrl || 'https://placehold.co/400x300?text=No+Image';

            return `
                <div class="card">
                    <div class="card-image-container" data-id="${prompt.id}" data-index="${absoluteIndex}" data-action="view-prompt">
                        <img src="${displayImage}" alt="Hasil gambar: ${prompt.title}" loading="lazy">
                        <span class="card-expand-hint material-icons">open_in_full</span>
                        ${overlayCategoryHtml}
                        ${premiumBadge}
                        ${adminActions}
                        <div class="card-prompt-overlay">
                            <div class="overlay-info">
                                <h4 class="overlay-title">${prompt.title || 'Tanpa Judul'}</h4>
                                <span class="overlay-user">by ${prompt.user || 'Anonymous'}</span>
                                ${tagsHtml}
                            </div>
                            ${actionButtonHtml}
                        </div>
                    </div>
                </div>`;
        }).join('');
        promptGrid.innerHTML = allCardsHTML;
    };
    

    // =========================================================================
    // 8. AUTH & CRUD (DENGAN UPDATE SAVE PREMIUM)
    // =========================================================================

    const loginUser = (email, password) => auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            hideModal('login-modal');
            Swal.fire({
                icon: 'success',
                title: 'Login Berhasil!',
                text: 'Selamat datang kembali.',
                timer: 1500,
                showConfirmButton: false
            });
        })
        .catch(error => Swal.fire({ icon: 'error', title: 'Login Gagal', text: error.message }));

    const logoutUser = () => {
        Swal.fire({
            title: 'Konfirmasi Logout',
            text: "Apakah Anda yakin ingin keluar?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#EF4444', 
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
    // 9. MODAL HANDLERS (DENGAN LOGIKA PREMIUM)
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

            // [UPDATE PREMIUM] Populate data form premium
            const isPrem = data?.isPremium || false;
            const premCheckbox = document.getElementById('prompt-isPremium');
            const mayarInput = document.getElementById('prompt-mayarLink');
            const mayarContainer = document.getElementById('mayar-link-container');
            const promptTextInput = document.getElementById('prompt-text');

            if(premCheckbox) premCheckbox.checked = isPrem;
            if(mayarInput) mayarInput.value = data?.mayarLink || '';
            
            // Toggle container input Mayar sesuai status
            if (mayarContainer) {
                if (isPrem) {
                    mayarContainer.style.display = 'block';
                    if(mayarInput) mayarInput.required = true;
                    if(promptTextInput) promptTextInput.placeholder = "Tulis deskripsi singkat / teaser di sini. JANGAN TULIS PROMPT ASLI!";
                } else {
                    mayarContainer.style.display = 'none';
                    if(mayarInput) mayarInput.required = false;
                    if(promptTextInput) promptTextInput.placeholder = "Isi Prompt";
                }
            }

            // Image handling
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
        const authorText = document.getElementById('view-modal-author-text');
        const authorLink = document.getElementById('view-modal-author-link');
        
        // Elemen Tombol
        const copyBtn = document.getElementById('view-modal-copy-btn');
        const generateBtn = document.getElementById('view-modal-generate-btn');

        // [UPDATE PREMIUM] Logika Modal Fullview
        if (data.isPremium) {
            // --- JIKA PREMIUM ---
            if(modalPromptText) {
                modalPromptText.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #D97706; background: #FFFBEB; border-radius: 8px;">
                    <span class="material-icons" style="font-size: 48px; margin-bottom: 1rem;">lock</span><br>
                    <strong>Prompt Ini Terkunci (Premium)</strong><br>
                    <p style="margin-top: 10px; color: #4B5563;">${data.promptText || "Dapatkan akses penuh ke prompt berkualitas tinggi ini dengan membelinya."}</p>
                </div>`;
            }

            // Sembunyikan tombol Generate
            if(generateBtn) generateBtn.style.display = 'none';

            // Ubah tombol Copy jadi Tombol Beli
            if(copyBtn) {
                // Kita modifikasi tombol yang ada agar tidak merusak struktur
                copyBtn.classList.remove('login-btn'); 
                copyBtn.style.backgroundColor = '#F59E0B';
                copyBtn.style.color = '#fff';
                
                // Ubah konten tombol
                copyBtn.innerHTML = `
                    <span class="material-icons">shopping_cart</span>
                    <span>Beli Sekarang</span>`;
                
                // Hapus logic copy lama (sementara kita override onclick)
                copyBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(data.mayarLink, '_blank');
                };
                // Hapus dataset copy agar tidak tertrigger event listener global
                delete copyBtn.dataset.promptText;
            }

        } else {
            // --- JIKA GRATIS (Standard) ---
            if(modalPromptText) modalPromptText.textContent = data.promptText;
            
            // Munculkan tombol Generate
            if(generateBtn) {
                generateBtn.style.display = 'flex'; // Atau inline-flex
                generateBtn.dataset.promptText = encodeURIComponent(data.promptText);
            }

            // Kembalikan tombol Copy ke kondisi awal
            if(copyBtn) {
                copyBtn.classList.add('login-btn');
                copyBtn.style.backgroundColor = ''; // Reset ke CSS class
                copyBtn.style.color = '';
                
                copyBtn.innerHTML = `
                    <span class="material-icons">content_copy</span>
                    <span>Salin Prompt</span>`;
                
                // Set data agar event listener global berfungsi
                copyBtn.dataset.promptText = encodeURIComponent(data.promptText);
                
                // Reset onclick (biarkan event listener global yang menangani)
                copyBtn.onclick = null;
            }
        }
        
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

        // Navigasi Modal
        if(modalNavPrev) modalNavPrev.style.display = (currentViewIndex === 0) ? 'none' : 'flex';
        if(modalNavNext) modalNavNext.style.display = (currentViewIndex === currentFilteredPrompts.length - 1) ? 'none' : 'flex';
        
        // Like Button
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

const updateAuthStateUI = (user) => {
        // Ambil elemen tombol FAB Mobile (Tombol +)
        const fabMobile = document.getElementById('nav-add-prompt-mobile');

        if (user) {
            // === KONDISI: USER LOGIN ===
            
            // UI Desktop
            if(authButtonsDesktop) authButtonsDesktop.style.display = 'none';
            if(userProfileDesktop) userProfileDesktop.style.display = 'flex';
            
            // Update Foto & Nama di Header
            if(headerAvatar) headerAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=2563EB&color=fff`;
            
            if(dropdownUsername) {
                let nameHTML = user.displayName || 'Pengguna';
                if (currentUser && currentUser.isAdmin) {
                    nameHTML += ` <span style="background-color: #EF4444; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; vertical-align: middle; margin-left: 6px; font-weight: 700;">ADMIN</span>`;
                }
                dropdownUsername.innerHTML = nameHTML;
            }

            if(dropdownEmail) dropdownEmail.textContent = user.email;

            // Update Auth Container Mobile (Jadi tombol Logout)
            if(authContainerMobile) {
                authContainerMobile.innerHTML = `<button class="auth-icon-btn logout" id="logout-btn-mobile-icon"><span class="material-icons">logout</span></button>`;
                document.getElementById('logout-btn-mobile-icon')?.addEventListener('click', logoutUser);
            }
            
            // Menu Navigasi Login/Logout
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

            // --- BAGIAN INI YANG PENTING UNTUK TOMBOL (+) ---
            // Munculkan tombol Buat Prompt di Desktop & Mobile
            if(navAddPrompt) navAddPrompt.style.display = 'flex';
            
            // [REVISI BRI] Lepas class hidden dari FAB Mobile
            if(fabMobile) fabMobile.classList.remove('hidden'); 

        } else {
            // === KONDISI: USER TAMU / LOGOUT ===

            // UI Desktop
            if(authButtonsDesktop) authButtonsDesktop.style.display = 'block';
            if(userProfileDesktop) userProfileDesktop.style.display = 'none';

            // Auth Container Mobile (Jadi tombol Login)
            if(authContainerMobile) {
                authContainerMobile.innerHTML = `<div id="login-btn-mobile" class="nav-item" style="cursor: pointer;"><span class="material-icons">login</span></button>`;
                document.getElementById('login-btn-mobile-icon')?.addEventListener('click', () => showModal('login-modal'));
            }
            
            // Menu Navigasi Login/Logout
            if (navAuthContainer) {
                navAuthContainer.innerHTML = `
                    <a href="#" class="nav-link-inner" id="login-btn-mobile" style="display: flex; flex-direction: column; align-items: center; color: inherit; text-decoration: none; width: 100%;">
                        <span class="material-icons">login</span>
                        <span class="nav-label">Login</span>
                    </a>`;
                document.getElementById('nav-login').addEventListener('click', (e) => { 
                    e.preventDefault(); 
                    showModal('login-modal'); 
                });
            }

            // --- BAGIAN INI YANG PENTING UNTUK TOMBOL (+) ---
            // Sembunyikan tombol Buat Prompt
            if(navAddPrompt) navAddPrompt.style.display = 'none';
            
            // [REVISI BRI] Pasang class hidden ke FAB Mobile
            if(fabMobile) fabMobile.classList.add('hidden'); 
        }
        
        applyFilters();
    };


    // =========================================================================
    // 10. EVENT LISTENERS
    // =========================================================================

    // [UPDATE PREMIUM] Event Listener untuk Checkbox Premium
    const premiumCheckbox = document.getElementById('prompt-isPremium');
    const mayarLinkContainer = document.getElementById('mayar-link-container');
    const promptTextInput = document.getElementById('prompt-text');

    if (premiumCheckbox) {
        premiumCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                if(mayarLinkContainer) mayarLinkContainer.style.display = 'block';
                if(document.getElementById('prompt-mayarLink')) document.getElementById('prompt-mayarLink').required = true;
                if(promptTextInput) promptTextInput.placeholder = "Tulis deskripsi singkat / teaser di sini. JANGAN TULIS PROMPT ASLI!";
            } else {
                if(mayarLinkContainer) mayarLinkContainer.style.display = 'none';
                if(document.getElementById('prompt-mayarLink')) document.getElementById('prompt-mayarLink').required = false;
                if(promptTextInput) promptTextInput.placeholder = "Isi Prompt";
            }
        });
    }

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
            
            // [UPDATE PREMIUM] Ambil value Premium & Link Mayar
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
                // Data Baru
                isPremium: isPremium,
                mayarLink: isPremium ? mayarLink : '' 
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
            // Untuk copy button di grid, pastikan bukan tombol premium
            const copyBtn = target.closest('.copy-btn-overlay:not(.premium-btn)'); 
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
                        if(toggleClearButton) toggleClearButton(); 
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
            
            // Logic Copy hanya jalan jika bukan Premium
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
                
                // [UPDATE PREMIUM] Cek jika tombol berfungsi sebagai tombol Beli
                if (btn.querySelector('.material-icons').textContent === 'shopping_cart') {
                    // Jangan jalankan logika copy
                    return; 
                }

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

    const toggleClearButton = () => {
        if (!clearSearchBtn || !textFilterDesktop) return;
        
        if (textFilterDesktop.value.trim().length > 0) {
            clearSearchBtn.classList.remove('hidden'); 
        } else {
            clearSearchBtn.classList.add('hidden');    
        }
    };

    if (textFilterDesktop) {
        textFilterDesktop.addEventListener('input', toggleClearButton);
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (textFilterDesktop) textFilterDesktop.value = ''; 
            toggleClearButton(); 
            applyFilters();     
        });
    }

    if (textFilterDesktop) {
        // Fix potential circular ref or undefined if overriding prototype carelessly
        // Simple event listener is enough as added above
        const originalListener = textFilterDesktop.addEventListener.bind(textFilterDesktop);
        // Monkey patch aman untuk updateSearchFromTag
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
    // 11. INIT & SECURITY GUARD (SATPAM)
    // =========================================================================

    auth.onAuthStateChanged(async (user) => { 
        
        // --- [MULAI] SATPAM AREA: KICK USER BELUM LOGIN DARI TOOLS.HTML ---
        const isToolsPage = window.location.pathname.includes('tools.html');
        
        if (isToolsPage && !user) {
            // 1. Titip pesan di saku browser user
            sessionStorage.setItem('alert_must_login', 'true');
            
            // 2. Tendang ke halaman utama
            window.location.replace("index.html"); 
            return; // Stop proses
        }
        // --- [SELESAI] SATPAM AREA ---

        if (user) {
            const tokenResult = await user.getIdTokenResult(true); 
            currentUser = user;
            currentUser.isAdmin = tokenResult.claims.admin === true;
        } else {
            currentUser = null;
        }
        
        // Update tampilan UI (Tombol login/logout, dll)
        updateAuthStateUI(user);
        document.body.style.display = 'block';
    });

    fetchAndRenderPrompts();
    const yearSpan = document.getElementById('current-year');
    if(yearSpan) yearSpan.textContent = new Date().getFullYear();
});