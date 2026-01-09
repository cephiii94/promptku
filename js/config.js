// js/config.js

// 1. Daftar Kategori Resmi
export const OFFICIAL_CATEGORIES = [
    "Character",
    "Filter",
    "Effect",
    "Anime",
    "Lainnya"
];

// 2. Konfigurasi Cloudinary
export const CLOUDINARY_CLOUD_NAME = "dx4pxe7ji"; 

// 3. Fungsi Init Firebase
export async function initFirebase() {
    // Ambil config dari Netlify Function (Sama seperti logika lama)
    try {
        const response = await fetch('/.netlify/functions/get-firebase-config');
        if (!response.ok) throw new Error('Gagal mengambil konfigurasi Firebase.');
        const firebaseConfig = await response.json();
        
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        return { 
            auth: firebase.auth(), 
            db: firebase.firestore() 
        };
    } catch (error) {
        console.error("Firebase Init Error:", error);
        return { auth: null, db: null };
    }
}