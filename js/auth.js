// auth.js
// =========================================================================
// LOGIKA AUTENTIKASI
// =========================================================================

export const loginUser = (auth, email, password, onSuccess) => {
    return auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            if(onSuccess) onSuccess();
            Swal.fire({
                icon: 'success',
                title: 'Login Berhasil!',
                text: 'Selamat datang kembali.',
                timer: 1500,
                showConfirmButton: false
            });
        })
        .catch(error => Swal.fire({ icon: 'error', title: 'Login Gagal', text: error.message }));
};

export const logoutUser = (auth) => {
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

// Tambahkan ini di js/auth.js (setelah logoutUser)

// [REFACTORED] Updated to return Promise for better UI control in main.js
export const registerUser = (auth, email, password, fullName) => {
    return auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            return user.updateProfile({
                displayName: fullName
            });
        });
        // Error handling will be done in main.js
};