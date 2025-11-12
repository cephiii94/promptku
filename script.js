// [PERUBAHAN] Bungkus event listener dalam 'async'
document.addEventListener('DOMContentLoaded', async () => {

    // =========================================================================
    // 1. SETUP & CONFIGURATION
    // =========================================================================

    // [PERUBAHAN] Ambil konfigurasi Firebase dari Netlify Function
    let firebaseConfig;
    try {
        const response = await fetch('/.netlify/functions/get-firebase-config');
        if (!response.ok) {
            throw new Error('Gagal mengambil konfigurasi Firebase.');
        }
        firebaseConfig = await response.json();
    } catch (error) {
        console.error(error);
        // Tampilkan pesan error ke pengguna jika config gagal dimuat
        document.body.innerHTML = `<p style="color: red; text-align: center; padding-top: 50px;">
            Gagal memuat konfigurasi aplikasi. Silakan coba lagi nanti.
        </p>`;
        return; // Hentikan eksekusi skrip jika config gagal
    }

    // CLOUDINARY_CLOUD_NAME tidak rahasia, jadi tidak apa-apa di sini.
    // Yang rahasia (API Key & Secret) sudah Anda amankan di fungsi 'generate-signature'.
    const CLOUDINARY_CLOUD_NAME = "dx4pxe7ji"; 

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    // ... sisa kode Anda (lanjut ke const db = ...)
    const db = firebase.firestore();
    const FieldValue = firebase.firestore.FieldValue;


    // =========================================================================
    // 2. DOM ELEMENT SELECTORS
    // =========================================================================

    const promptGrid = document.getElementById('prompt-grid');
    const categoryFilter = document.getElementById('category-filter');
    const sortByFilter = document.getElementById('sort-by-filter'); // Ambil dari HTML baru
    const textFilterDesktop = document.getElementById('filter-input');
    const textFilterMobile = document.getElementById('filter-input-mobile');
    const addPromptLinkMobile = document.getElementById('add-prompt-link-mobile');
    const authContainerMobile = document.getElementById('auth-container-mobile');
    const searchBtn = document.getElementById('search-btn');
    const searchOverlay = document.getElementById('search-form-overlay');
    const loginForm = document.getElementById('login-form');
    const promptForm = document.getElementById('prompt-form');
    const navSearch = document.getElementById('nav-search');
    const navAddPrompt = document.getElementById('nav-add-prompt');
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
    let currentFilteredPrompts = [];
    let currentViewIndex = 0;


    // =========================================================================
    // 5. DATA FETCHING & FILTERING
    // =========================================================================

    const fetchAndRenderPrompts = async () => {
        try {
            const snapshot = await db.collection("prompts").get();
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
        const sortBy = sortByFilter.value; 
        
        if (resetFiltersBtn) {
            if (category !== 'all' || searchTerm || sortBy !== 'title_asc') {
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
        
        switch(sortBy) {
            case 'title_asc':
                filtered.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'title_desc':
                filtered.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'popular':
                filtered.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0) || a.title.localeCompare(b.title));
                break;
        }

        currentFilteredPrompts = filtered;
        renderPrompts(filtered);
    };


    // =========================================================================
    // 6. RENDERING LOGIC
    // =========================================================================

    const renderPrompts = (promptsToRender) => {
        if (!promptGrid.innerHTML) {
            promptGrid.innerHTML = '<p>Memuat...</p>';
        }

        if (!promptsToRender.length) {
            if (promptGrid.innerHTML !== '<p>Memuat...</p>') {
                 promptGrid.innerHTML = '<p>Tidak ada prompt yang ditemukan.</p>';
            }
            return;
        }

        const allCardsHTML = promptsToRender.map((prompt, index) => {
            
            // --- [PERBAIKAN KEAMANAN RULES] ---
            // Tampilkan tombol admin HANYA jika currentUser ada DAN
            // (dia adalah admin ATAU dia adalah pemilik prompt)
            // Kita asumsikan 'isUserAdmin' akan dicek di sisi server, 
            // tapi untuk UI, kita cek kepemilikan.
            // Untuk sekarang, kita sederhanakan: Tombol muncul jika dia pemilik.
            // Anda HARUS menambahkan cek 'admin' jika Anda punya logic itu.
            // Untuk saat ini, kita akan cek kepemilikan saja.
            
            let adminActions = '';
            // ================================================================
            // ▼▼▼ PERUBAHAN FUNGSI ADMIN ADA DI SINI ▼▼▼
            // ================================================================
            // Tampilkan tombol jika user login DAN (dia adalah pemilik ATAU dia adalah admin)
            if (currentUser && (prompt.creatorId === currentUser.uid || currentUser.isAdmin === true)) {
                adminActions = `
                <div class="card-actions">
                    <button class="action-btn edit-btn" data-id="${prompt.id}"><span class="material-icons">edit</span><span class="tooltip">Edit</span></button>
                    <button class="action-btn delete-btn" data-id="${prompt.id}"><span class="material-icons">delete</span><span class="tooltip">Hapus</span></button>
                </div>`;
            }
            // ================================================================
            // ▲▲▲ AKHIR DARI PERUBAHAN FUNGSI ADMIN ▲▲▲
            // ================================================================
            // Jika Anda punya custom claim 'admin', logic-nya akan seperti ini:
            // if (currentUser && (prompt.creatorId === currentUser.uid || currentUser.isAdmin === true)) { ... }
            // Karena kita tidak punya 'currentUser.isAdmin' di frontend, kita pakai logic 'creatorId' saja.
            // Catatan: Security rules di server-lah yang *sebenarnya* mengamankan data. Ini hanya UI.


            const overlayCategoryHtml = prompt.category 
                ? `<span class="image-overlay-text" data-filter-type="category" data-filter-value="${prompt.category}">${prompt.category}</span>` 
                : ''; 
            
            const copyButtonHtml = `
                <button class="copy-btn-overlay" data-prompt-text="${encodeURIComponent(prompt.promptText)}">
                    <span class="material-icons">content_copy</span>
                    <span class="copy-text">Salin</span>
                </button>`;

            const tagsHtml = (prompt.tags && Array.isArray(prompt.tags) && prompt.tags.length > 0)
                ? `<div class="card-tags-overlay">
                    ${prompt.tags.map(tag => `<span class="tag-overlay" data-filter-type="tag" data-filter-value="${tag}">${tag}</span>`).join('')}
                   </div>`
                : '';

            return `
                <div class="card">
                    <div class="card-image-container" data-id="${prompt.id}" data-index="${index}" data-action="view-prompt">
                        <img src="${prompt.imageUrl}" alt="Hasil gambar dari prompt: ${prompt.title}" loading="lazy">
                        
                        <span class="card-expand-hint material-icons">open_in_full</span>

                        ${overlayCategoryHtml}
                        ${adminActions}
                        <div class="card-prompt-overlay">
                            <div class="overlay-info">
                                <h4 class="overlay-title">${prompt.title}</h4>
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
    // 7. AUTHENTICATION & CRUD OPERATIONS
    // =========================================================================

    const loginUser = (email, password) => auth.signInWithEmailAndPassword(email, password)
        .then(() => hideModal('login-modal'))
        .catch(error => {
            // [PEMBARUAN] Ganti alert
            Swal.fire({ icon: 'error', title: 'Login Gagal', text: error.message });
        });

    const logoutUser = () => auth.signOut();

    const savePrompt = async (formData) => {
        try {
            if (formData.tags && typeof formData.tags === 'string') {
                formData.tags = formData.tags.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);
            } else if (!formData.tags) {
                formData.tags = [];
            }
            
            if (!formData.id) {
                // Inisialisasi data 'like' untuk prompt baru
                formData.likeCount = 0;
                formData.likedBy = [];
            }

            const { id, ...data } = formData;

            if (id) {
                // Ini adalah 'update' (edit)
                await db.collection("prompts").doc(id).update(data);
            } else {
                // Ini adalah 'create' (baru)
                // 'creatorId' sudah ditambahkan ke 'data' sebelum memanggil fungsi ini
                await db.collection("prompts").add(data);
            }
            hideModal('prompt-modal');
            await fetchAndRenderPrompts(); // Ambil data baru dari server
        } catch (error) {
            console.error("Gagal menyimpan prompt: ", error);
            // [PEMBARUAN] Ganti alert
            Swal.fire({ icon: 'error', title: 'Oops...', text: 'Gagal menyimpan prompt. (Cek Security Rules)' });
        }
    };

    // [PEMBARUAN] Fungsi deletePrompt diubah total untuk SweetAlert
    const deletePrompt = async (id) => {
        Swal.fire({
            title: 'Anda Yakin?',
            text: "Prompt yang sudah dihapus tidak bisa dikembalikan!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus Saja!',
            cancelButtonText: 'Batalkan',
            confirmButtonColor: '#EF4444', // Sesuai var(--danger-red)
            cancelButtonColor: '#4B5563'   // Sesuai var(--text-medium)
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await db.collection("prompts").doc(id).delete();
                    
                    Swal.fire({
                        title: 'Terhapus!',
                        text: 'Prompt berhasil dihapus.',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    
                    await fetchAndRenderPrompts(); // Ambil data baru
                    
                } catch (error) {
                    console.error("Gagal menghapus prompt: ", error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: 'Gagal menghapus prompt. (Cek Security Rules)'
                    });
                }
            }
        });
    };

    const toggleLikePrompt = async (promptId) => {
        if (!currentUser) {
            // [PEMBARUAN] Ganti alert
            Swal.fire({ icon: 'info', title: 'Login Dulu', text: 'Silakan login untuk menyukai prompt ini.' });
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
                    // User sudah 'like', jadi 'unlike'
                    newLikedBy = likedBy.filter(uid => uid !== userId);
                    newLikeCount--;
                } else {
                    // User belum 'like', jadi 'like'
                    newLikedBy.push(userId);
                    newLikeCount++;
                }

                transaction.update(promptRef, { 
                    likedBy: newLikedBy,
                    likeCount: newLikeCount < 0 ? 0 : newLikeCount // Pastikan tidak negatif
                });
            });
            
            // Update data di 'allPrompts' (state lokal) agar UI responsif
            const promptIndex = allPrompts.findIndex(p => p.id === promptId);
            if (promptIndex > -1) {
                const promptData = allPrompts[promptIndex];
                const isLiked = promptData.likedBy && promptData.likedBy.includes(userId);
                
                if (isLiked) {
                    // Logika 'unlike' di state lokal
                    promptData.likeCount = (promptData.likeCount || 1) - 1;
                    promptData.likedBy = promptData.likedBy.filter(uid => uid !== userId);
                } else {
                    // Logika 'like' di state lokal
                    promptData.likeCount = (promptData.likeCount || 0) + 1;
                    if (!promptData.likedBy) promptData.likedBy = [];
                    promptData.likedBy.push(userId);
                }
                
                // Jika modal view sedang terbuka, update juga UI di sana
                if(document.getElementById('view-prompt-modal').style.display === 'flex') {
                    // Cek apakah prompt yang di-like adalah yang sedang dilihat
                    const currentPromptId = currentFilteredPrompts[currentViewIndex].id;
                    if(currentPromptId === promptId) {
                        // Render ulang modal dengan data baru dari state lokal
                        showViewPromptModal(promptData);
                    }
                }
                
                // Render ulang grid utama (opsional, tapi bagus jika sorting 'popular' aktif)
                applyFilters();
            }

        } catch (error) {
            console.error("Gagal melakukan like/unlike: ", error);
            // [PEMBARUAN] Ganti alert
            Swal.fire({ icon: 'error', title: 'Oops...', text: 'Terjadi kesalahan. (Cek Security Rules)' });
        }
    };


    // =========================================================================
    // 8. MODAL & UI LOGIC
    // =========================================================================

    const showModal = (modalId, data = null) => {
        if (bottomNavMobile) bottomNavMobile.style.display = 'none';
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
                // Mode Edit: Tampilkan gambar yang ada
                promptImagePreview.src = data.imageUrl;
                imagePreviewWrapper.style.display = 'block';
                fileInputWrapper.style.display = 'none';
                fileInput.required = false; // Tidak wajib upload ulang
            } else {
                // Mode Tambah Baru: Tampilkan input file
                promptImagePreview.src = '';
                imagePreviewWrapper.style.display = 'none';
                fileInputWrapper.style.display = 'block';
                fileInput.required = true; // Wajib upload
            }
        }
        modal.style.display = 'flex';
    };

    const hideModal = (modalId) => {
        document.getElementById(modalId).style.display = 'none';
        if (bottomNavMobile) bottomNavMobile.style.display = 'flex';
    };

    const showViewPromptModal = (data) => {
        const modalTitle = document.querySelector('#view-prompt-modal .modal-prompt-side h2');
        if (modalTitle) modalTitle.textContent = data.title;

        document.getElementById('view-modal-image').src = data.imageUrl;
        document.getElementById('view-modal-prompt-text').textContent = data.promptText;
        
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
        } else {
            authorText.textContent = ''; 
            authorLink.style.display = 'none';
        }
        
        const copyBtn = document.getElementById('view-modal-copy-btn');
        copyBtn.dataset.promptText = encodeURIComponent(data.promptText);
        copyBtn.classList.remove('copied');

        // Atur ulang tombol copy/view ke state default
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            copyBtn.querySelector('span:last-child').textContent = 'Lihat Prompt';
            copyBtn.querySelector('span.material-icons').textContent = 'text_snippet';
        } else {
            copyBtn.querySelector('span:last-child').textContent = 'Salin Prompt';
            copyBtn.querySelector('span.material-icons').textContent = 'content_copy';
        }

        // Tampilkan/Sembunyikan tombol navigasi
        if (currentViewIndex === 0) modalNavPrev.style.display = 'none';
        else modalNavPrev.style.display = 'flex';

        if (currentViewIndex === currentFilteredPrompts.length - 1) modalNavNext.style.display = 'none';
        else modalNavNext.style.display = 'flex';
        
        const generateBtn = document.getElementById('view-modal-generate-btn');
        // Kita simpan data prompt di tombolnya
        generateBtn.dataset.promptText = encodeURIComponent(data.promptText);
        
        // Update tombol Like
        const likeBtn = document.getElementById('view-modal-like-btn');
        const likeCountSpan = document.getElementById('view-modal-like-count');
        
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

        document.getElementById('view-prompt-modal').style.display = 'flex';
        if (bottomNavMobile) bottomNavMobile.style.display = 'none';
    };

    const navigateToPrompt = (direction) => {
        currentViewIndex += direction;
        if (currentViewIndex < 0) currentViewIndex = 0;
        if (currentViewIndex >= currentFilteredPrompts.length) {
             currentViewIndex = currentFilteredPrompts.length - 1;
        }
        
        const promptData = currentFilteredPrompts[currentViewIndex];
        if (promptData) {
            showViewPromptModal(promptData);
        }
    };

    const updateAuthStateUI = (user) => {
        if (user) {
            // User Login
            authContainerMobile.innerHTML = `<button class="auth-icon-btn logout" id="logout-btn-mobile-icon"><span class="material-icons">logout</span><span class="tooltip">Logout</span></button>`;
            document.getElementById('logout-btn-mobile-icon').addEventListener('click', logoutUser);
            if(addPromptLinkMobile) addPromptLinkMobile.style.display = 'flex';
            
            if (navAuthContainer) {
                navAuthContainer.innerHTML = `<a href="#" class="nav-item" id="nav-logout"><span class="material-icons">logout</span><span class="nav-label">Logout</span></a>`;
                document.getElementById('nav-logout').addEventListener('click', (e) => { e.preventDefault(); logoutUser(); });
            }
            if (navAddPrompt) navAddPrompt.style.display = 'flex';

        } else {
            // User Logout
            authContainerMobile.innerHTML = `<button class="auth-icon-btn" id="login-btn-mobile-icon"><span class="material-icons">login</span><span class="tooltip">Login</span></button>`;
            document.getElementById('login-btn-mobile-icon').addEventListener('click', () => showModal('login-modal'));
            if(addPromptLinkMobile) addPromptLinkMobile.style.display = 'none';

            if (navAuthContainer) {
                navAuthContainer.innerHTML = `<a href="#" class="nav-item" id="nav-login"><span class="material-icons">login</span><span class="nav-label">Login</span></a>`;
                document.getElementById('nav-login').addEventListener('click', (e) => { e.preventDefault(); showModal('login-modal'); });
            }
            if (navAddPrompt) navAddPrompt.style.display = 'none';
        }
        
        // PENTING: Render ulang kartu setelah status login berubah
        // agar tombol edit/delete tampil/hilang sesuai hak akses
        applyFilters();
    };


    // =========================================================================
    // 9. EVENT LISTENERS
    // =========================================================================

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loginUser(document.getElementById('login-email').value, document.getElementById('login-password').value);
    });
    
    promptForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUser) {
            Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: 'Anda harus login untuk menyimpan prompt.' });
            return;
        }
    
        const fileInput = document.getElementById('prompt-imageFile');
        const file = fileInput.files[0];
        const existingImageUrl = document.getElementById('prompt-imageUrl').value;
        const promptId = document.getElementById('prompt-id').value;
    
        if (!promptId && !file) {
            // [PEMBARUAN] Ganti alert
            Swal.fire({ icon: 'warning', title: 'Tunggu Sebentar', text: 'Untuk prompt baru, jangan lupa upload gambar hasilnya ya!' });
            return;
        }
    
        const submitButton = promptForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="material-icons spin">hourglass_top</span>'; // Tampilkan spinner
    
        let imageUrl = existingImageUrl; 
    
        if (file) {
            // Hanya jalankan upload jika ada file BARU dipilih
            try {
                // 1. Dapatkan signature dari server Netlify
                const signatureResponse = await fetch('/.netlify/functions/generate-signature');
                if (!signatureResponse.ok) throw new Error('Gagal mendapatkan signature dari server.');
                const { signature, timestamp, api_key } = await signatureResponse.json();
                
                // 2. Siapkan FormData untuk Cloudinary
                const formData = new FormData();
                formData.append('file', file);
                formData.append('api_key', api_key);
                formData.append('timestamp', timestamp);
                formData.append('signature', signature);
                formData.append('upload_preset', 'galeri-prompt-uploads'); // Preset upload Anda
                
                // 3. Kirim ke Cloudinary
                const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
                const response = await fetch(UPLOAD_URL, { method: 'POST', body: formData });
                if (!response.ok) throw new Error('Upload gambar ke Cloudinary gagal.');
                
                const data = await response.json();
                imageUrl = data.secure_url; // Dapatkan URL gambar yang aman
            } catch (error) {
                console.error("Gagal mengunggah gambar: ", error);
                // [PEMBARUAN] Ganti alert
                Swal.fire({ icon: 'error', title: 'Upload Gagal', text: 'Gagal mengunggah gambar. Silakan coba lagi.' });
                submitButton.disabled = false;
                submitButton.innerHTML = '<span class="material-icons">save</span>';
                return;
            }
        }
    
        // Jika tidak ada gambar baru DAN tidak ada gambar lama (mode 'baru' tapi file gagal)
        if (!imageUrl) {
            Swal.fire({ icon: 'error', title: 'Gambar Hilang', text: 'URL gambar tidak ditemukan. Proses dibatalkan.' });
            submitButton.disabled = false;
            submitButton.innerHTML = '<span class="material-icons">save</span>';
            return;
        }
    
        const socialUrl = document.getElementById('prompt-socialUrl').value;
        const extractedUser = extractUsernameFromUrl(socialUrl);

        // Siapkan data untuk disimpan
        const promptData = {
            id: promptId,
            title: document.getElementById('prompt-title').value,
            user: extractedUser,
            socialUrl: socialUrl,
            category: document.getElementById('prompt-category').value,
            promptText: document.getElementById('prompt-text').value,
            imageUrl: imageUrl,
            tags: document.getElementById('prompt-tags').value,
        };
        
        // --- [ FITUR BARU YANG ANDA MINTA ] ---
        // Tambahkan 'creatorId' HANYA jika ini prompt baru (promptId kosong)
        // Ini penting agar 'creatorId' tidak ter-timpa saat admin meng-edit
        if (!promptId) {
            promptData.creatorId = currentUser.uid;
        }
        // --- [ AKHIR DARI FITUR BARU ] ---
    
        await savePrompt(promptData); 
    
        submitButton.disabled = false;
        submitButton.innerHTML = '<span class="material-icons">save</span>';
    });

    // Event listener utama untuk semua aksi di grid
    promptGrid.addEventListener('click', (e) => {
        const target = e.target;
        
        // Cari target terdekat dari aksi-aksi berikut
        const editBtn = target.closest('.edit-btn');
        const deleteBtn = target.closest('.delete-btn');
        const copyBtn = target.closest('.copy-btn-overlay'); 
        const clickedFilter = target.closest('[data-filter-type]');
        const viewBtn = target.closest('[data-action="view-prompt"]'); 

        // 1. Aksi: Buka Modal View
        // Pastikan kita mengklik area gambar, BUKAN salah satu tombol aksi di atasnya
        if (viewBtn && !editBtn && !deleteBtn && !copyBtn && !clickedFilter) {
            const index = parseInt(viewBtn.dataset.index, 10);
            if (!isNaN(index)) {
                currentViewIndex = index;
                const promptData = currentFilteredPrompts[currentViewIndex];
                if (promptData) showViewPromptModal(promptData);
            }
            return; // Hentikan eksekusi
        }

        // 2. Aksi: Klik Kategori atau Tag
        if (clickedFilter) {
            const { filterType, filterValue } = clickedFilter.dataset;
            textFilterDesktop.value = '';
            textFilterMobile.value = '';
            
            if (filterType === 'category') {
                categoryFilter.value = filterValue;
            } else if (filterType === 'tag') {
                // Jika tag diklik, masukkan ke search bar
                textFilterDesktop.value = filterValue;
                textFilterMobile.value = filterValue;
                categoryFilter.value = 'all'; // Reset kategori
            }
            applyFilters();
            window.scrollTo(0, 0); // Scroll ke atas
            return;
        }

        // 3. Aksi: Tombol Edit
        if (editBtn) {
            // Ambil data lengkap dari state lokal
            const promptToEdit = allPrompts.find(p => p.id === editBtn.dataset.id);
            if (promptToEdit) showModal('prompt-modal', promptToEdit);
            return;
        }
        
        // 4. Aksi: Tombol Delete
        if (deleteBtn) {
            deletePrompt(deleteBtn.dataset.id);
            return;
        }
        
        // 5. Aksi: Tombol Copy di Kartu
        if (copyBtn) {
            const textToCopy = decodeURIComponent(copyBtn.dataset.promptText);
            navigator.clipboard.writeText(textToCopy).then(() => {
                const textSpan = copyBtn.querySelector('.copy-text');
                if (!textSpan) return;
                
                const originalText = textSpan.textContent; 
                copyBtn.classList.add('copied');
                textSpan.textContent = 'Tersalin!';

                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    textSpan.textContent = originalText;
                }, 2000);
            }).catch(err => console.error('Gagal menyalin: ', err));
        }
    });
    
    // Listener untuk semua tombol close modal
    document.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', () => hideModal(btn.dataset.modal)));

    // --- Listener khusus untuk Modal Full View ---
    const viewModal = document.getElementById('view-prompt-modal');
    if (viewModal) { 
        const viewModalCopyBtn = document.getElementById('view-modal-copy-btn');
        const viewModalCloseBtn = viewModal.querySelector('.close-btn-fullview');

        // Tombol Close (X) besar
        viewModalCloseBtn.addEventListener('click', () => hideModal('view-prompt-modal'));

        // Tombol "Salin Prompt" / "Lihat Prompt" (Mobile)
        viewModalCopyBtn.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const textToCopy = decodeURIComponent(btn.dataset.promptText);
            const isMobile = window.innerWidth <= 768;

            if (isMobile) {
                // --- Logika Mobile ---
                // Tampilkan modal popup baru
                const popupTextArea = document.getElementById('popup-prompt-textarea');
                if(popupTextArea) popupTextArea.value = textToCopy;
                showModal('prompt-text-popup'); 
                
                // Reset tombol copy di dalam popup
                const popupCopyBtn = document.getElementById('popup-copy-btn');
                if (popupCopyBtn) {
                    popupCopyBtn.classList.remove('copied');
                    popupCopyBtn.querySelector('span:last-child').textContent = 'Salin Prompt';
                }
            } else {
                // --- Logika Desktop ---
                // Langsung salin ke clipboard
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const textSpan = btn.querySelector('span:last-child');
                    const originalText = "Salin Prompt";
                    btn.classList.add('copied');
                    textSpan.textContent = 'Berhasil Tersalin!';
                    setTimeout(() => {
                        btn.classList.remove('copied');
                        textSpan.textContent = originalText;
                    }, 2000);
                }).catch(err => console.error('Gagal menyalin: ', err));
            }
        });

        // ==========================================================
        // [PERBAIKAN - LOGIKA BERBEDA UNTUK MOBILE vs DESKTOP]
        // ==========================================================
        const viewModalGenerateBtn = document.getElementById('view-modal-generate-btn');
        if (viewModalGenerateBtn) {
            viewModalGenerateBtn.addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const textToCopy = decodeURIComponent(btn.dataset.promptText);
                const isMobile = window.innerWidth <= 768; // Deteksi mobile

                if (isMobile) {
                    // ============
                    // LOGIKA MOBILE: Langsung buka tab baru.
                    // ============
                    // Pengguna harus menyalin manual (sesuai tooltip baru).
                    window.open('https://gemini.google.com/app', '_blank');

                } else {
                    // ============
                    // LOGIKA DESKTOP: Salin otomatis lalu buka tab.
                    // ============
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        
                        const textSpan = btn.querySelector('span:last-child');
                        const originalText = "Generate";
                        
                        if (textSpan) {
                            btn.classList.add('copied');
                            textSpan.textContent = 'Prompt Tersalin!';
                        }

                        // Buka tab baru
                        window.open('https://gemini.google.com/app', '_blank');

                        // Kembalikan tombol ke normal
                        setTimeout(() => {
                            btn.classList.remove('copied');
                            if (textSpan) {
                                textSpan.textContent = originalText;
                            }
                        }, 2500);

                    }).catch(err => {
                        console.error('Gagal menyalin: ', err);
                        Swal.fire({ icon: 'error', title: 'Oops...', text: 'Gagal menyalin prompt ke clipboard.' });
                    });
                }
            });
        }
        // ==========================================================
        // AKHIR DARI PERBAIKAN
        // ==========================================================
        
        // Tombol Like di dalam modal
        const viewModalLikeBtn = document.getElementById('view-modal-like-btn');
        if (viewModalLikeBtn) {
            viewModalLikeBtn.addEventListener('click', (e) => {
                const promptId = e.currentTarget.dataset.id;
                if (promptId) {
                    toggleLikePrompt(promptId);
                }
            });
        }
    }

    // Tombol copy di dalam modal popup (khusus mobile)
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

    // Tombol Navigasi (Next/Prev) di modal view
    if (modalNavPrev) modalNavPrev.addEventListener('click', () => navigateToPrompt(-1));
    if (modalNavNext) modalNavNext.addEventListener('click', () => navigateToPrompt(1));

    // Menutup modal jika klik di luar area konten
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                // Jangan tutup modal edit/tambah jika klik di luar
                if (modal.id === 'prompt-text-popup' || modal.id === 'prompt-modal') return;
                hideModal(modal.id);
            }
        });
    });
    
    // --- Listener untuk Filter dan Kontrol Header ---
    searchBtn.addEventListener('click', () => searchOverlay.classList.toggle('active'));
    [categoryFilter, textFilterDesktop, textFilterMobile, sortByFilter].forEach(el => {
        if (el) el.addEventListener('input', applyFilters);
    });
    if(addPromptLinkMobile) addPromptLinkMobile.addEventListener('click', (e) => { e.preventDefault(); showModal('prompt-modal'); });
    
    // --- Listener untuk Navigasi Bawah (Mobile) ---
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
            // [PEMBARUAN] Ganti alert dengan Toast
            Swal.fire({
                icon: 'info',
                title: 'Segera Hadir!',
                text: 'Fitur ganti tema akan segera hadir!',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        });
    }

    // Tombol 'X' pada preview gambar di modal edit
    if(deleteImageBtn) {
        deleteImageBtn.addEventListener('click', () => {
            imagePreviewWrapper.style.display = 'none';
            fileInputWrapper.style.display = 'block';
            document.getElementById('prompt-imageUrl').value = '';
            promptImagePreview.src = '';
            document.getElementById('prompt-imageFile').required = true;
        });
    }

    // Tombol 'Reset Filter'
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            categoryFilter.value = 'all';
            textFilterDesktop.value = '';
            textFilterMobile.value = '';
            sortByFilter.value = 'title_asc';
            applyFilters();
        });
    }


    // =========================================================================
    // [BARU] Menangani Tombol Escape (Esc) untuk Menutup Modal
    // =========================================================================
    document.addEventListener('keydown', (event) => {
        // Cek apakah tombol yang ditekan adalah 'Escape'
        if (event.key === 'Escape' || event.key === 'Esc') {
            
            // Ambil semua modal yang sedang terbuka (yang memiliki style 'display: flex')
            const viewModal = document.getElementById('view-prompt-modal');
            const loginModal = document.getElementById('login-modal');
            const popupModal = document.getElementById('prompt-text-popup');

            // 1. Prioritaskan menutup modal view utama (sesuai permintaan Anda)
            if (viewModal && viewModal.style.display === 'flex') {
                hideModal('view-prompt-modal');
                return; // Hentikan eksekusi
            }
            
            // 2. Tutup juga modal popup prompt di mobile
            if (popupModal && popupModal.style.display === 'flex') {
                hideModal('prompt-text-popup');
                return; // Hentikan eksekusi
            }

            // 3. Tutup juga modal login
            if (loginModal && loginModal.style.display === 'flex') {
                hideModal('login-modal');
                return; // Hentikan eksekusi
            }

            // Kita sengaja tidak menutup 'prompt-modal' (modal edit/tambah)
            // agar pengguna tidak sengaja kehilangan data form saat menekan Esc.
        }
    });


    // =========================================================================
    // 10. INITIALIZATION
    // =========================================================================

    // ================================================================
    // ▼▼▼ PERUBAHAN FUNGSI ADMIN ADA DI SINI ▼▼▼
    // ================================================================
    // Listener utama status autentikasi
    auth.onAuthStateChanged(async (user) => { // 1. Jadikan async
        if (user) {
            // 2. Ambil token, 'true' memaksa refresh untuk mendapatkan claim terbaru
            const tokenResult = await user.getIdTokenResult(true); 
            
            // 3. Simpan user
            currentUser = user;
            
            // 4. (PENTING) Simpan status admin di objek currentUser
            currentUser.isAdmin = tokenResult.claims.admin === true;
            
            if (currentUser.isAdmin) {
                console.log("Login sebagai ADMIN terdeteksi!"); // Pesan opsional untuk debug
            }

        } else {
            // User logout
            currentUser = null;
        }
        
        // 5. Panggil updateAuthStateUI yang akan memicu render ulang
        updateAuthStateUI(user);
        // 'applyFilters()' sudah dipanggil di dalam 'updateAuthStateUI'
        // untuk me-render ulang kartu dengan tombol admin yang sesuai.
    });
    // ================================================================
    // ▲▲▲ AKHIR DARI PERUBAHAN FUNGSI ADMIN ▲▲▲
    // ================================================================


    // Mulai ambil data saat halaman dimuat
    fetchAndRenderPrompts();
    
    // Set tahun di footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
});