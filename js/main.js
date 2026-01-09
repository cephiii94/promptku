// js/main.js
import { initFirebase } from './config.js';
// [PENTING] Bri tambahkan 'renderPagination' di import ini
import { renderPrompts, showModal, hideModal, populateCategoryOptions, renderPagination } from './ui.js';
import { loginUser, logoutUser, updateAuthStateUI } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Inisialisasi Firebase & Elemen DOM
    const { auth, db } = await initFirebase();
    
    // --- STATE VARIABLES (Data & Halaman) ---
    let allPrompts = [];            // Data mentah dari Database
    let currentFilteredPrompts = []; // Data yang sedang aktif (bisa hasil filter/search)
    let currentUser = null;

    // Setting Pagination
    let currentPage = 1;
    const itemsPerPage = 12; // Jumlah kartu per halaman

    // Ambil Elemen DOM Penting
    const promptGrid = document.getElementById('prompt-grid');
    const paginationContainer = document.getElementById('pagination-container'); // [BARU] Container tombol
    const categoryFilter = document.getElementById('category-filter');
    const promptCategorySelect = document.getElementById('prompt-category');
    const homeCategoryList = document.getElementById('home-category-list');
    
    // UI Elements Bundle untuk Auth
    const uiElements = {
        authButtonsDesktop: document.getElementById('auth-buttons-desktop'),
        userProfileDesktop: document.getElementById('user-profile-desktop'),
        headerAvatar: document.getElementById('header-avatar'),
        dropdownUsername: document.getElementById('dropdown-username'),
        dropdownEmail: document.getElementById('dropdown-email'),
        navAddPrompt: document.getElementById('nav-add-prompt'),
        navAddPromptMobile: document.getElementById('nav-add-prompt-mobile'),
        authContainerMobile: document.getElementById('auth-container-mobile')
    };

    // 2. [FUNGSI BARU] Update Tampilan (Grid + Pagination)
    // Ini otak utamanya! Dia yang memotong data sebelum ditampilkan.
    const updateDisplay = () => {
        // A. Hitung data mana yang harus tampil (Slice)
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const promptsToShow = currentFilteredPrompts.slice(start, end);

        // B. Render Kartu Prompt (Panggil fungsi UI)
        renderPrompts(promptsToShow, promptGrid, currentUser);

        // C. Render Tombol Halaman (Panggil fungsi UI)
        renderPagination(
            currentFilteredPrompts.length, 
            itemsPerPage, 
            currentPage, 
            paginationContainer, 
            (newPage) => {
                // Callback: Apa yang terjadi kalau tombol angka diklik?
                currentPage = newPage;
                updateDisplay(); // Render ulang dengan halaman baru
                window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll ke atas otomatis
            }
        );
    };

    // 3. Fetch Data Awal
    populateCategoryOptions(homeCategoryList, categoryFilter, promptCategorySelect);
    
    // Fetch Prompts dari Firestore
    if (db) {
        try {
            const snapshot = await db.collection("prompts").get();
            allPrompts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Set data aktif awal = semua data
            currentFilteredPrompts = allPrompts; 
            
            // Panggil updateDisplay (Bukan renderPrompts langsung)
            updateDisplay(); 

        } catch (error) {
            console.error("Error fetching prompts:", error);
            if(promptGrid) promptGrid.innerHTML = '<p class="text-center">Gagal memuat data.</p>';
        }
    }

    // 4. Listener Auth State
    if (auth) {
        auth.onAuthStateChanged(user => {
            currentUser = user;
            updateAuthStateUI(user, uiElements);
            
            // Re-render tampilan saat status login berubah
            // (Supaya tombol edit/delete muncul/hilang)
            updateDisplay(); 
        });
    }

    // 5. Global Event Listeners (Delegation)
    document.addEventListener('click', (e) => {
        // Tombol Login
        const loginBtn = e.target.closest('#login-btn-desktop, #login-btn-mobile, #login-btn-mobile-icon');
        if (loginBtn) {
            e.preventDefault();
            showModal('auth-modal'); 
        }

        // Tombol Logout
        const logoutBtn = e.target.closest('#logout-btn-desktop, #logout-btn-mobile-icon');
        if (logoutBtn) {
            e.preventDefault();
            if(auth) logoutUser(auth);
        }

        // Tombol Close Modal
        if (e.target.closest('.close-btn')) {
            const modalId = e.target.closest('.close-btn').dataset.modal;
            hideModal(modalId);
        }
    });

    // Listener Form Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            if(auth) loginUser(auth, email, password);
        });
    }
});