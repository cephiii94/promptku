// config.js
// =========================================================================
// KONFIGURASI & HELPER
// =========================================================================

export const OFFICIAL_CATEGORIES = [
    "Character",
    "Filter",
    "Effect",
    "Anime",
    "Lainnya"
];

export const CLOUDINARY_CLOUD_NAME = "dx4pxe7ji"; 

// Helper: Ekstrak Username dari URL Sosmed
export const extractUsernameFromUrl = (url) => {
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

// Helper: Inisialisasi Firebase (Mengambil config dari Netlify)
export async function initFirebase() {
    let firebaseConfig;
    try {
        const response = await fetch('/.netlify/functions/get-firebase-config');
        if (!response.ok) throw new Error('Gagal mengambil konfigurasi Firebase.');
        firebaseConfig = await response.json();
    } catch (error) {
        console.error("Config Error:", error);
        return null;
    }

    if (firebaseConfig && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else if (!firebase.apps.length) {
        console.error("Firebase config missing.");
        return null;
    }

    return {
        auth: firebase.auth(),
        db: firebase.firestore()
    };
}