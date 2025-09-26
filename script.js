document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // 1. SETUP & CONFIGURATION
    // =========================================================================

    const firebaseConfig = {
        apiKey: "AIzaSyD5dhh4a3835uJGxxvKL27KcTAtu0f7bT4",
        authDomain: "all-auth-1509.firebaseapp.com",
        projectId: "all-auth-1509",
        storageBucket: "all-auth-1509.appspot.com",
        messagingSenderId: "23681152443",
        appId: "1:23681152443:web:8f86c9b89e14c90692809e",
        measurementId: "G-D3Y0WHY83V"
    };

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
    const addPromptLinkDesktop = document.getElementById('add-prompt-link');
    const addPromptLinkMobile = document.getElementById('add-prompt-link-mobile');
    const authContainerDesktop = document.getElementById('auth-container-desktop');
    const authContainerMobile = document.getElementById('auth-container-mobile');
    const searchBtn = document.getElementById('search-btn');
    const searchOverlay = document.getElementById('search-form-overlay');
    const loginForm = document.getElementById('login-form');
    const promptForm = document.getElementById('prompt-form');

    // =========================================================================
    // 3. APPLICATION STATE
    // =========================================================================

    let allPrompts = [];
    let currentUser = null;

    // =========================================================================
    // 4. DATA FETCHING & FILTERING
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
    // 5. RENDERING LOGIC
    // =========================================================================

    const renderPrompts = (promptsToRender) => {
        if (!promptsToRender.length) {
            promptGrid.innerHTML = '<p>Tidak ada prompt yang ditemukan.</p>';
            return;
        }

        const allCardsHTML = promptsToRender.map(prompt => {
            const adminActions = currentUser ? `
                <div class="card-actions">
                    <button class="action-btn edit-btn" data-id="${prompt.id}">Edit</button>
                    <button class="action-btn delete-btn" data-id="${prompt.id}">Hapus</button>
                </div>` : '';

            const categoryTag = prompt.category ? `<span class="tag tag-category" data-filter-type="category" data-filter-value="${prompt.category}">${prompt.category}</span>` : '';
            const otherTags = (prompt.tags && Array.isArray(prompt.tags)) ? prompt.tags.map(tag => `<span class="tag" data-filter-type="tag" data-filter-value="${tag}">${tag}</span>`).join('') : '';

            return `
                <div class="card">
                    <div class="card-image-container">
                        <img src="${prompt.outputImage}" alt="Hasil gambar dari prompt: ${prompt.title}">
                        <span class="image-overlay-text">Hasil Generator</span>
                    </div>
                    <div class="card-content">
                        <div class="card-header">
                            <div>
                                <h3 class="card-title">${prompt.title}</h3>
                                <span class="card-user">by User</span>
                            </div>
                        </div>
                        <button class="copy-btn" data-prompt-text="${encodeURIComponent(prompt.promptText)}">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
                            <span class="copy-text">Salin</span>
                        </button>
                        <div class="prompt-wrapper">
                            <textarea readonly class="prompt-textarea">${prompt.promptText}</textarea>
                        </div>
                        <div class="card-tags">
                            ${categoryTag}
                            ${otherTags}
                        </div>
                    </div>
                    ${adminActions}
                </div>`;
        }).join('');

        promptGrid.innerHTML = allCardsHTML;
    };

    // =========================================================================
    // 6. AUTHENTICATION & CRUD OPERATIONS
    // =========================================================================

    const loginUser = (email, password) => {
        auth.signInWithEmailAndPassword(email, password)
            .then(() => hideModal('login-modal'))
            .catch(error => alert(`Login Gagal: ${error.message}`));
    };

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
    // 7. MODAL & UI LOGIC
    // =========================================================================

    const showModal = (modalId, data = null) => {
        const modal = document.getElementById(modalId);
        if (modalId === 'prompt-modal') {
            promptForm.reset();
            document.getElementById('modal-title').innerText = data ? 'Edit Prompt' : 'Tambah Prompt Baru';
            document.getElementById('prompt-id').value = data?.id || '';
            document.getElementById('prompt-title').value = data?.title || '';
            document.getElementById('prompt-category').value = data?.category || '';
            document.getElementById('prompt-text').value = data?.promptText || '';
            document.getElementById('prompt-inputImage').value = data?.inputImage || '';
            document.getElementById('prompt-outputImage').value = data?.outputImage || '';
            document.getElementById('prompt-tags').value = (data?.tags && Array.isArray(data.tags)) ? data.tags.join(', ') : '';
        }
        modal.style.display = 'flex';
    };

    const hideModal = (modalId) => {
        document.getElementById(modalId).style.display = 'none';
    };

    const updateAuthStateUI = (user) => {
        if (user) {
            // Logged In State
            authContainerDesktop.innerHTML = `<button class="auth-button logout-btn" id="logout-btn-desktop"><span class="material-icons">logout</span>Logout</button>`;
            authContainerMobile.innerHTML = `<button class="auth-icon-btn logout" id="logout-btn-mobile-icon"><span class="material-icons">logout</span><span class="tooltip">Logout</span></button>`;
            
            document.getElementById('logout-btn-desktop').addEventListener('click', logoutUser);
            document.getElementById('logout-btn-mobile-icon').addEventListener('click', logoutUser);

            addPromptLinkDesktop.style.display = 'inline-flex';
            addPromptLinkMobile.style.display = 'flex';
        } else {
            // Logged Out State
            authContainerDesktop.innerHTML = `<button class="auth-button login-btn" id="login-btn-desktop"><span class="material-icons">login</span>Login</button>`;
            authContainerMobile.innerHTML = `<button class="auth-icon-btn" id="login-btn-mobile-icon"><span class="material-icons">login</span><span class="tooltip">Login</span></button>`;

            document.getElementById('login-btn-desktop').addEventListener('click', () => showModal('login-modal'));
            document.getElementById('login-btn-mobile-icon').addEventListener('click', () => showModal('login-modal'));

            addPromptLinkDesktop.style.display = 'none';
            addPromptLinkMobile.style.display = 'none';
        }
    };


    // =========================================================================
    // 8. EVENT LISTENERS
    // =========================================================================

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loginUser(
            document.getElementById('login-email').value,
            document.getElementById('login-password').value
        );
    });

    promptForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = {
            id: document.getElementById('prompt-id').value,
            title: document.getElementById('prompt-title').value,
            category: document.getElementById('prompt-category').value,
            promptText: document.getElementById('prompt-text').value,
            inputImage: document.getElementById('prompt-inputImage').value,
            outputImage: document.getElementById('prompt-outputImage').value,
            tags: document.getElementById('prompt-tags').value,
        };
        savePrompt(formData);
    });

    promptGrid.addEventListener('click', (e) => {
        const target = e.target;
        const editBtn = target.closest('.edit-btn');
        const deleteBtn = target.closest('.delete-btn');
        const copyBtn = target.closest('.copy-btn');
        const clickedTag = target.closest('.tag');

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
    
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => hideModal(btn.dataset.modal));
    });

    searchBtn.addEventListener('click', () => {
        searchOverlay.classList.toggle('active');
        if (searchOverlay.classList.contains('active')) textFilterMobile.focus();
    });

    [categoryFilter, textFilterDesktop, textFilterMobile].forEach(el => {
        el.addEventListener('input', applyFilters);
    });

    [addPromptLinkDesktop, addPromptLinkMobile].forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            showModal('prompt-modal');
        });
    });

    // =========================================================================
    // 9. INITIALIZATION
    // =========================================================================

    auth.onAuthStateChanged(user => {
        currentUser = user;
        updateAuthStateUI(user);
        applyFilters(); // Re-render cards to show/hide admin buttons
    });

    fetchAndRenderPrompts();
});