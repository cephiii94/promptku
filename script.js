document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // 1. SETUP & CONFIGURATION
    // =========================================================================

    /*
    [CATATAN KEAMANAN PENTING - FIREBASE]
    Konfigurasi Firebase Anda (termasuk apiKey) memang didesain untuk
    diekspos di sisi klien (client-side) seperti ini. Ini adalah hal yang wajar.

    NAMUN, Anda WAJIB mengamankan database Anda dengan
    FIREBASE SECURITY RULES yang ketat di Firebase Console Anda.
    Keamanan Anda bergantung pada RULES, bukan pada kerahasiaan kunci ini.
    */
    const firebaseConfig = {
        apiKey: "AIzaSyD5dhh4a3835uJGxxvKL27KcTAtu0f7bT4", // Ambil dari file asli Anda
        authDomain: "all-auth-1509.firebaseapp.com",
        projectId: "all-auth-1509",
        storageBucket: "all-auth-1509.appspot.com",
        messagingSenderId: "23681152443",
        appId: "1:23681152443:web:8f86c9b89e14c90692809e",
        measurementId: "G-D3Y0WHY83V"
    };

    // [BARU] Definisikan Cloud Name Anda di sini. Ini boleh publik.
    const CLOUDINARY_CLOUD_NAME = "dx4pxe7ji"; // Cloud Name Anda

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();

    // =========================================================================
    // 2. DOM ELEMENT SELECTORS
    // =========================================================================

    const promptGrid = document.getElementById('prompt-grid');
    const categoryFilter = document.getElementById('category-filter');
    const textFilterDesktop = document.getElementById('filter-input');
    const textFilterMobile = document.getElementById('filter-input-mobile');
    const addPromptLinkMobile = document.getElementById('add-prompt-link-mobile');
    const authContainerMobile = document.getElementById('auth-container-mobile');
    const searchBtn = document.getElementById('search-btn');
    const searchOverlay = document.getElementById('search-form-overlay');
    const loginForm = document.getElementById('login-form');
    const promptForm = document.getElementById('prompt-form');

    // Selector untuk Navigasi Bawah
    const navSearch = document.getElementById('nav-search');
    const navAddPrompt = document.getElementById('nav-add-prompt');
    const navAuthContainer = document.getElementById('nav-auth-container');
    const navTheme = document.getElementById('nav-theme');

    // Selector untuk Pratinjau Gambar di Modal
    const imagePreviewWrapper = document.getElementById('image-preview-wrapper');
    const fileInputWrapper = document.getElementById('file-input-wrapper');
    const promptImagePreview = document.getElementById('prompt-image-preview');
    const deleteImageBtn = document.getElementById('delete-image-btn');
    
    // Selector untuk tombol reset filter
    const resetFiltersBtn = document.getElementById('reset-filters-btn');

    // [TERBARU] Selector untuk navigasi bawah
    const bottomNavMobile = document.querySelector('.bottom-nav-mobile');

    // =========================================================================
    // 3. HELPER FUNCTION
    // =========================================================================
    
    const extractUsernameFromUrl = (url) => {
        if (!url || typeof url !== 'string') return '';
        try {
            const cleanedUrl = url.split('?')[0].replace(/\/$/, '');
            const parts = cleanedUrl.split('/');
            const username = parts[parts.length - 1];
            return username.charAt(0).toUpperCase() + username.slice(1);
        } catch (error) {
            console.error("Gagal mengekstrak username dari URL:", url, error);
            return '';
        }
    };

    // =========================================================================
    // 4. APPLICATION STATE
    // =========================================================================

    let allPrompts = [];
    let currentUser = null;

    // =========================================================================
    // 5. DATA FETCHING & FILTERING
    // =========================================================================

    const fetchAndRenderPrompts = async () => {
        try {
            const snapshot = await db.collection("prompts").orderBy("title").get();
            allPrompts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            populateCategoryFilter();
            applyFilters();
        } catch (error) {
            console.error("Gagal mengambil data: ", error);
            promptGrid.innerHTML = `<p>Gagal memuat data. Periksa aturan keamanan (security rules) Firestore Anda.</p>`;
        }
    };

    const populateCategoryFilter = () => {
        const categories = [...new Set(allPrompts.map(p => p.category).filter(Boolean))].sort();
        categoryFilter.innerHTML = '<option value="all">Semua Kategori</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
    };

    const applyFilters = () => {
        const category = categoryFilter.value;
        const searchTerm = (window.innerWidth > 768 ? textFilterDesktop.value : textFilterMobile.value).toLowerCase();
        
        if (resetFiltersBtn) {
            if (category !== 'all' || searchTerm) {
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
                p.title.toLowerCase().includes(searchTerm) ||
                (p.tags && p.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
            );
        }
        renderPrompts(filtered);
    };

    // =========================================================================
    // 6. RENDERING LOGIC
    // =========================================================================

    const renderPrompts = (promptsToRender) => {
        if (!promptGrid.innerHTML) {
            promptGrid.innerHTML = '<p>Memuat...</p>'; // Tampilkan pesan memuat awal
        }

        if (!promptsToRender.length) {
            // Hanya perbarui jika grid sudah terisi sebelumnya (menghindari kedipan saat memuat)
            if (promptGrid.innerHTML !== '<p>Memuat...</p>') {
                 promptGrid.innerHTML = '<p>Tidak ada prompt yang ditemukan.</p>';
            }
            return;
        }

        const allCardsHTML = promptsToRender.map(prompt => {
            
            // [BARU] Tombol Admin (diposisikan absolute di kanan atas)
            const adminActions = currentUser ? `
                <div class="card-actions">
                    <button class="action-btn edit-btn" data-id="${prompt.id}"><span class="material-icons">edit</span><span class="tooltip">Edit</span></button>
                    <button class="action-btn delete-btn" data-id="${prompt.id}"><span class="material-icons">delete</span><span class="tooltip">Hapus</span></button>
                </div>` : '';

            // Kategori di kiri atas (tetap sama)
            const overlayCategoryHtml = prompt.category 
                ? `<span class="image-overlay-text " data-filter-type="category" data-filter-value="${prompt.category}">${prompt.category}</span>` 
                : ''; 
            
            // [REKOMENDASI] Tombol copy baru yang lebih minimalis
            const copyButtonHtml = `
                <button class="copy-btn-overlay" data-prompt-text="${encodeURIComponent(prompt.promptText)}">
                    <span class="material-icons">content_copy</span>
                    <span class="copy-text">Salin</span>
                </button>`;

            // [STRUKTUR KARTU BARU]
            // Kita tidak lagi menggunakan .card-content.
            // Semua info sekarang ada di dalam .card-image-container atau overlay.
            return `
                <div class="card">
                    <div class="card-image-container" data-id="${prompt.id}" data-action="view-prompt">
                        <img src="${prompt.imageUrl}" alt="Hasil gambar dari prompt: ${prompt.title}">
                        
                        ${overlayCategoryHtml} ${adminActions} 
                        <div class="card-prompt-overlay">
                        <small class="card-overlay-hint">Klik gambar untuk detail</small>
                            <p class="card-prompt-text">${prompt.promptText}</p>
                            ${copyButtonHtml} </div>
                    </div>
                    
                    </div>`;
        }).join('');
        promptGrid.innerHTML = allCardsHTML;
    };

    // =========================================================================
    // 7. AUTHENTICATION & CRUD OPERATIONS
    // =========================================================================

    const loginUser = (email, password) => auth.signInWithEmailAndPassword(email, password).then(() => hideModal('login-modal')).catch(error => alert(`Login Gagal: ${error.message}`));
    const logoutUser = () => auth.signOut();

    const savePrompt = async (formData) => {
        try {
            if (formData.tags && typeof formData.tags === 'string') {
                formData.tags = formData.tags.split(',').map(tag => tag.trim()).filter(Boolean);
            } else if (!formData.tags) {
                formData.tags = [];
            }
            const { id, ...data } = formData;
            if (id) {
                await db.collection("prompts").doc(id).update(data);
            } else {
                await db.collection("prompts").add(data);
            }
            hideModal('prompt-modal');
            await fetchAndRenderPrompts();
        } catch (error) {
            console.error("Gagal menyimpan prompt: ", error);
            alert("Gagal menyimpan prompt.");
        }
    };

    const deletePrompt = async (id) => {
        if (confirm("Apakah Anda yakin ingin menghapus prompt ini?")) {
            try {
                await db.collection("prompts").doc(id).delete();
                await fetchAndRenderPrompts();
            } catch (error) {
                console.error("Gagal menghapus prompt: ", error);
                alert("Gagal menghapus prompt.");
            }
        }
    };

    // =========================================================================
    // 8. MODAL & UI LOGIC
    // =========================================================================

    // [MODIFIKASI] Menyembunyikan navigasi bawah saat modal muncul
    const showModal = (modalId, data = null) => {
        if (bottomNavMobile) {
            bottomNavMobile.style.display = 'none';
        }

        const modal = document.getElementById(modalId);
        if (modalId === 'prompt-modal') {
            promptForm.reset();
            document.getElementById('modal-title').innerText = data ? 'Edit Prompt' : 'Tambah Prompt Baru';
            document.getElementById('prompt-id').value = data?.id || '';
            document.getElementById('prompt-title').value = data?.title || '';
            document.getElementById('prompt-socialUrl').value = data?.socialUrl || '';
            document.getElementById('prompt-category').value = data?.category || '';
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

    // [MODIFIKASI] Menampilkan kembali navigasi bawah saat modal ditutup
    const hideModal = (modalId) => {
        document.getElementById(modalId).style.display = 'none';
        if (bottomNavMobile) {
            bottomNavMobile.style.display = 'flex';
        }
    };

    // [BARU & MODIFIKASI] Fungsi khusus untuk menampilkan modal full view (dengan logika mobile)
    const showViewPromptModal = (data) => {
        document.getElementById('view-modal-image').src = data.imageUrl;
        // Tetap isi text-content untuk desktop
        document.getElementById('view-modal-prompt-text').textContent = data.promptText;
        
        // [MODIFIKASI] Mengisi info author
        const authorText = document.getElementById('view-modal-author-text');
        const authorLink = document.getElementById('view-modal-author-link');
        
        if (data.user && data.socialUrl) {
            authorText.textContent = 'Prompt by: ';
            authorLink.href = data.socialUrl;
            authorLink.textContent = data.user;
            authorLink.style.display = 'inline';
        } else if (data.user) {
            authorText.textContent = 'Prompt by: ' + data.user;
            authorLink.style.display = 'none';
            authorLink.href = '#';
            authorLink.textContent = '';
        } else {
            authorText.textContent = ''; 
            authorLink.style.display = 'none';
            authorLink.href = '#';
            authorLink.textContent = '';
        }
        
        // --- Sisa fungsi (Tombol Copy) ---
        const copyBtn = document.getElementById('view-modal-copy-btn');
        // Simpan data prompt di tombolnya untuk digunakan nanti
        copyBtn.dataset.promptText = encodeURIComponent(data.promptText);
        
        // Reset status tombol copy
        copyBtn.classList.remove('copied');

        // [MODIFIKASI] Ubah teks tombol berdasarkan ukuran layar
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            copyBtn.querySelector('span:last-child').textContent = 'Lihat Prompt';
            copyBtn.querySelector('span.material-icons').textContent = 'text_snippet';
        } else {
            copyBtn.querySelector('span:last-child').textContent = 'Salin Prompt';
            copyBtn.querySelector('span.material-icons').textContent = 'content_copy';
        }
        
        // Tampilkan modal
        document.getElementById('view-prompt-modal').style.display = 'flex';
        if (bottomNavMobile) bottomNavMobile.style.display = 'none'; // Sembunyikan nav bawah
    };

    const updateAuthStateUI = (user) => {
        if (user) {
            // --- KONDISI SAAT USER SUDAH LOGIN ---
            // Header
            authContainerMobile.innerHTML = `<button class="auth-icon-btn logout" id="logout-btn-mobile-icon"><span class="material-icons">logout</span><span class="tooltip">Logout</span></button>`;
            document.getElementById('logout-btn-mobile-icon').addEventListener('click', logoutUser);
            if(addPromptLinkMobile) addPromptLinkMobile.style.display = 'flex';
            
            // Navigasi Bawah
            if (navAuthContainer) {
                navAuthContainer.innerHTML = `
                    <a href="#" class="nav-item" id="nav-logout">
                        <span class="material-icons">logout</span><span class="nav-label">Logout</span>
                    </a>`;
                document.getElementById('nav-logout').addEventListener('click', (e) => { e.preventDefault(); logoutUser(); });
            }
            if (navAddPrompt) navAddPrompt.style.display = 'flex';

        } else {
            // --- KONDISI SAAT USER TIDAK LOGIN ---
            // Header
            authContainerMobile.innerHTML = `<button class="auth-icon-btn" id="login-btn-mobile-icon"><span class="material-icons">login</span><span class="tooltip">Login</span></button>`;
            document.getElementById('login-btn-mobile-icon').addEventListener('click', () => showModal('login-modal'));
            if(addPromptLinkMobile) addPromptLinkMobile.style.display = 'none';

            // Navigasi Bawah
            if (navAuthContainer) {
                navAuthContainer.innerHTML = `
                    <a href="#" class="nav-item" id="nav-login">
                        <span class="material-icons">login</span><span class="nav-label">Login</span>
                    </a>`;
                document.getElementById('nav-login').addEventListener('click', (e) => { e.preventDefault(); showModal('login-modal'); });
            }
            if (navAddPrompt) navAddPrompt.style.display = 'none';
        }
    };

    // =========================================================================
    // 9. EVENT LISTENERS
    // =========================================================================

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loginUser(document.getElementById('login-email').value, document.getElementById('login-password').value);
    });
    
    // [PERUBAHAN UTAMA - SIGNED UPLOAD]
    promptForm.addEventListener('submit', async (e) => {
        e.preventDefault();
    
        const fileInput = document.getElementById('prompt-imageFile');
        const file = fileInput.files[0];
        const existingImageUrl = document.getElementById('prompt-imageUrl').value;
        const promptId = document.getElementById('prompt-id').value;
    
        if (!promptId && !file) {
            alert("Untuk prompt baru, jangan lupa upload gambar hasilnya ya!");
            return;
        }
    
        const submitButton = promptForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Menyimpan...';
    
        let imageUrl = existingImageUrl; 
    
        // HANYA jalankan blok ini jika ada file baru yang diupload
        if (file) {
            try {
                // ===========================================================
                // [PERUBAHAN UTAMA] - Implementasi Signed Upload
                // ===========================================================

                // 1. Minta "tanda tangan" (signature) aman dari server Netlify kita
                // Endpoint '/.netlify/functions/...' adalah endpoint default Netlify
                const signatureResponse = await fetch('/.netlify/functions/generate-signature');
                if (!signatureResponse.ok) {
                    throw new Error('Gagal mendapatkan signature dari server.');
                }
                const { signature, timestamp, api_key } = await signatureResponse.json();

                // 2. Siapkan FormData untuk dikirim ke Cloudinary
                const formData = new FormData();
                formData.append('file', file);
                formData.append('api_key', api_key); // Gunakan API Key dari server
                formData.append('timestamp', timestamp); // Gunakan timestamp dari server
                formData.append('signature', signature); // Gunakan signature dari server
                formData.append('upload_preset', 'galeri-prompt-uploads'); // Preset harus sama dengan yang di server

                // 3. Tentukan URL Upload Cloudinary
                const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
                
                // 4. Kirim file ke Cloudinary
                const response = await fetch(UPLOAD_URL, { method: 'POST', body: formData });
                // ===========================================================
                // [AKHIR PERUBAHAN UTAMA]
                // ===========================================================

                if (!response.ok) throw new Error('Upload gambar ke Cloudinary gagal.');
                const data = await response.json();
                imageUrl = data.secure_url;
            } catch (error) {
                console.error("Gagal mengunggah gambar: ", error);
                alert("Gagal mengunggah gambar. Silakan coba lagi.");
                submitButton.disabled = false;
                submitButton.textContent = 'Simpan';
                return;
            }
        }
    
        // Kode ini berjalan seperti biasa
        const socialUrl = document.getElementById('prompt-socialUrl').value;
        const extractedUser = extractUsernameFromUrl(socialUrl);

        const promptData = {
            id: promptId,
            title: document.getElementById('prompt-title').value,
            user: extractedUser,
            socialUrl: socialUrl,
            category: document.getElementById('prompt-category').value,
            promptText: document.getElementById('prompt-text').value,
            imageUrl: imageUrl, // Ini akan berisi URL baru jika ada file, atau URL lama jika tidak
            tags: document.getElementById('prompt-tags').value,
        };
    
        await savePrompt(promptData); 
    
        submitButton.disabled = false;
        // [Perbaikan kecil] Ganti teks tombol kembali ke icon 'save'
        submitButton.innerHTML = '<span class="material-icons">save</span>';
    });
    // [AKHIR PERUBAHAN]

    promptGrid.addEventListener('click', (e) => {
        const target = e.target;
        const editBtn = target.closest('.edit-btn');
        const deleteBtn = target.closest('.delete-btn');
        const copyBtn = target.closest('.copy-btn-overlay'); // <-- [DIUBAH]
        const clickedTag = target.closest('.image-overlay-text'); // <-- [DIUBAH] Cek tag kategori juga
        const viewBtn = target.closest('[data-action="view-prompt"]'); // <-- [BARU]

        // [BARU] Logika untuk menampilkan modal full view
        if (viewBtn && !editBtn && !deleteBtn && !copyBtn && !clickedTag) {
            const promptId = viewBtn.dataset.id;
            const promptData = allPrompts.find(p => p.id === promptId);
            if (promptData) {
                showViewPromptModal(promptData);
            }
            return; // Hentikan eksekusi
        }

        if (clickedTag) {
            const { filterType, filterValue } = clickedTag.dataset;
            textFilterDesktop.value = '';
            textFilterMobile.value = '';
            if (filterType === 'category') {
                categoryFilter.value = filterValue;
            } else if (filterType === 'tag') {
                categoryFilter.value = 'all';
                textFilterDesktop.value = filterValue;
                textFilterMobile.value = filterValue;
            }
            applyFilters();
            window.scrollTo(0, 0);
            return;
        }
        if (editBtn) {
            const promptToEdit = allPrompts.find(p => p.id === editBtn.dataset.id);
            if (promptToEdit) showModal('prompt-modal', promptToEdit);
            return;
        }
        if (deleteBtn) {
            deletePrompt(deleteBtn.dataset.id);
            return;
        }
        // [BLOK DIUBAH] - Logika copy-paste untuk tombol baru
        if (copyBtn) {
            const textToCopy = decodeURIComponent(copyBtn.dataset.promptText);
            navigator.clipboard.writeText(textToCopy).then(() => {
                const textSpan = copyBtn.querySelector('.copy-text');
                if (!textSpan) return;
                
                const originalText = textSpan.textContent; // "Salin"
                copyBtn.classList.add('copied');
                textSpan.textContent = 'Tersalin!'; // Teks ini akan muncul berkat CSS

                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    textSpan.textContent = originalText; // Kembali ke "Salin" (tersembunyi)
                }, 2000);
            }).catch(err => console.error('Gagal menyalin: ', err));
        }
    });
    
    document.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', () => hideModal(btn.dataset.modal)));

    // [BARU & MODIFIKASI] Listener untuk modal full view (close-btn & copy-btn)
    const viewModal = document.getElementById('view-prompt-modal');
    if (viewModal) { // Cek jika elemen ada
        const viewModalCopyBtn = document.getElementById('view-modal-copy-btn');
        const viewModalCloseBtn = viewModal.querySelector('.close-btn-fullview');

        viewModalCloseBtn.addEventListener('click', () => {
            hideModal('view-prompt-modal');
        });

        // [MODIFIKASI BESAR] Event listener untuk tombol utama di modal full view
        viewModalCopyBtn.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const textToCopy = decodeURIComponent(btn.dataset.promptText);
            const isMobile = window.innerWidth <= 768;

            if (isMobile) {
                // --- LOGIKA MOBILE: Buka Pop-up ---
                
                // 1. Isi text area di popup baru
                const popupTextArea = document.getElementById('popup-prompt-textarea');
                if(popupTextArea) popupTextArea.value = textToCopy;
                
                // 2. Tampilkan modal popup
                showModal('prompt-text-popup'); 

                // 3. Reset tombol copy di *dalam* popup (jika ada)
                const popupCopyBtn = document.getElementById('popup-copy-btn');
                if (popupCopyBtn) {
                    popupCopyBtn.classList.remove('copied');
                    popupCopyBtn.querySelector('span:last-child').textContent = 'Salin Prompt';
                }

            } else {
                // --- LOGIKA DESKTOP: Langsung Salin ---
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const textSpan = btn.querySelector('span:last-child');
                    const originalText = "Salin Prompt"; // Teks asli desktop
                    
                    btn.classList.add('copied');
                    textSpan.textContent = 'Berhasil Tersalin!';
                    
                    setTimeout(() => {
                        btn.classList.remove('copied');
                        textSpan.textContent = originalText;
                    }, 2000);
                }).catch(err => console.error('Gagal menyalin: ', err));
            }
        });
    }

    // [BARU] Event listener untuk tombol Salin di DALAM pop-up mobile
    const popupCopyBtn = document.getElementById('popup-copy-btn');
    if (popupCopyBtn) {
        popupCopyBtn.addEventListener('click', (e) => {
            const textToCopy = document.getElementById('popup-prompt-textarea').value;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const btn = e.currentTarget;
                btn.classList.add('copied');
                btn.querySelector('span:last-child').textContent = 'Berhasil Tersalin!';
            }).catch(err => console.error('Gagal menyalin: ', err));
        });
    }


    // [KODE BARU] Menambahkan event listener untuk menutup modal saat area luar di-klik
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (event) => {
            // event.target adalah elemen yang diklik.
            // Kita cek apakah elemen yang diklik sama dengan elemen modal itu sendiri.
            if (event.target === modal) {
                // Khusus untuk popup prompt, jangan tutup jika area luar diklik
                // agar tidak sengaja tertutup saat scroll di HP
                if (modal.id === 'prompt-text-popup' || modal.id === 'prompt-modal') { 
                    return;
                }
                hideModal(modal.id); // Jika ya, tutup modalnya.
            }
        });
    });
    
    searchBtn.addEventListener('click', () => searchOverlay.classList.toggle('active'));
    [categoryFilter, textFilterDesktop, textFilterMobile].forEach(el => el.addEventListener('input', applyFilters));
    if(addPromptLinkMobile) addPromptLinkMobile.addEventListener('click', (e) => { e.preventDefault(); showModal('prompt-modal'); });
    
    if (navSearch) {
        navSearch.addEventListener('click', (e) => {
            e.preventDefault();
            searchOverlay.classList.toggle('active');
            window.scrollTo(0, 0);
        });
    }
    if (navAddPrompt) {
        navAddPrompt.addEventListener('click', (e) => {
            e.preventDefault();
            showModal('prompt-modal');
        });
    }
    if (navTheme) {
        navTheme.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Fitur ganti tema akan segera hadir!');
        });
    }

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
            categoryFilter.value = 'all';
            textFilterDesktop.value = '';
            textFilterMobile.value = '';
            applyFilters();
        });
    }

    // =========================================================================
    // 10. INITIALIZATION
    // =========================================================================

    auth.onAuthStateChanged(user => {
        currentUser = user;
        updateAuthStateUI(user);
        applyFilters(); 
    });

    fetchAndRenderPrompts();
    document.getElementById('current-year').textContent = new Date().getFullYear();
});