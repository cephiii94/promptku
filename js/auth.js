// js/auth.js
import { hideModal, showModal } from './ui.js';

export const loginUser = async (auth, email, password) => {
    try {
        await auth.signInWithEmailAndPassword(email, password);
        hideModal('login-modal');
        hideModal('auth-modal'); // Jaga-jaga kalau pakai modal auth baru
        Swal.fire({
            icon: 'success',
            title: 'Login Berhasil!',
            timer: 1500,
            showConfirmButton: false
        });
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Login Gagal', text: error.message });
    }
};

export const logoutUser = async (auth) => {
    Swal.fire({
        title: 'Yakin mau keluar?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Keluar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await auth.signOut();
            Swal.fire({ icon: 'success', title: 'Berhasil Logout', timer: 1500, showConfirmButton: false });
        }
    });
};

// Fungsi Raksasa untuk Update UI saat Login/Logout
export const updateAuthStateUI = (user, uiElements) => {
    const { 
        authButtonsDesktop, userProfileDesktop, headerAvatar, dropdownUsername, dropdownEmail,
        navAddPrompt, navAddPromptMobile, authContainerMobile, navAuthContainer 
    } = uiElements;

    if (user) {
        // === USER LOGIN ===
        if(authButtonsDesktop) authButtonsDesktop.style.display = 'none';
        if(userProfileDesktop) userProfileDesktop.style.display = 'flex';
        
        // Update Avatar & Nama
        if(headerAvatar) headerAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}`;
        if(dropdownUsername) dropdownUsername.textContent = user.displayName || 'Pengguna';
        if(dropdownEmail) dropdownEmail.textContent = user.email;

        // Tampilkan tombol Add Prompt
        if(navAddPrompt) navAddPrompt.style.display = 'flex';
        if(navAddPromptMobile) navAddPromptMobile.classList.remove('hidden');

        // Update Mobile Nav (Logout)
        if(authContainerMobile) authContainerMobile.innerHTML = `<button class="auth-icon-btn logout" id="logout-btn-mobile-icon"><span class="material-icons">logout</span></button>`;
        
    } else {
        // === USER LOGOUT ===
        if(authButtonsDesktop) authButtonsDesktop.style.display = 'block';
        if(userProfileDesktop) userProfileDesktop.style.display = 'none';

        // Sembunyikan tombol Add Prompt
        if(navAddPrompt) navAddPrompt.style.display = 'none';
        if(navAddPromptMobile) navAddPromptMobile.classList.add('hidden');

        // Update Mobile Nav (Login)
        if(authContainerMobile) authContainerMobile.innerHTML = `<button class="auth-icon-btn" id="login-btn-mobile-icon"><span class="material-icons">login</span></button>`;
    }
};