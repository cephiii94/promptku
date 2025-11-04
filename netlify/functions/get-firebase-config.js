/*
 * netlify/functions/get-firebase-config.js
 * Fungsi ini akan mengambil environment variables dari Netlify 
 * dan mengirimkannya ke frontend dengan aman.
 */
exports.handler = async (event, context) => {
    
    // Validasi sederhana: Pastikan semua keys ada
    if (!process.env.FIREBASE_API_KEY || !process.env.FIREBASE_PROJECT_ID) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Konfigurasi server tidak lengkap.' })
        };
    }

    // Buat objek konfigurasi dari Environment Variables
    const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID
    };

    // Kirim konfigurasi sebagai JSON
    return {
        statusCode: 200,
        body: JSON.stringify(firebaseConfig)
    };
};