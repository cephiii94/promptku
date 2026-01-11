// netlify/functions/mayar-webhook.js

const admin = require('firebase-admin');

// 1. Inisialisasi Firebase Admin (Hanya sekali)
if (!admin.apps.length) {
    // Kita akan simpan kunci JSON di Environment Variable Netlify biar aman
    // Nanti Bri ajarkan cara settingnya di langkah selanjutnya.
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
    // Hanya terima metode POST (standar Webhook)
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 2. Cek Keamanan (Secret Key)
    // Kita cocokan password yang dikirim Mayar dengan yang ada di Netlify
    // Mayar biasanya kirim secret lewat header atau body. 
    // Untuk simpelnya, kita asumsikan Tuan set header 'x-mayar-secret' di Dashboard Mayar nanti.
    const mySecret = process.env.MAYAR_WEBHOOK_SECRET;
    const incomingSecret = event.headers['x-mayar-secret'] || event.headers['X-Mayar-Secret'];

    if (mySecret && incomingSecret !== mySecret) {
        console.log("Secret Key Salah! Maling? 🥷");
        return { statusCode: 403, body: 'Forbidden' };
    }

    try {
        const payload = JSON.parse(event.body);
        console.log("Dapat Laporan dari Mayar:", payload);

        // 3. Ambil Data Penting
        // CATATAN: Struktur data Mayar bisa berubah, cek dokumentasi Mayar/Logs Tuan.
        // Asumsi: Mayar kirim email pembeli & kode produk.
        
        // PENTING: Saat buat produk di Mayar, isi kolom "SKU" atau "Kode Barang" dengan ID PROMPT dari Firestore!
        const emailPembeli = payload.customer_email || payload.email; 
        const idPrompt = payload.product_code || payload.sku; 

        if (!emailPembeli || !idPrompt) {
            return { statusCode: 400, body: 'Data email atau SKU/Product Code tidak lengkap.' };
        }

        // 4. Cari User di Firestore berdasarkan Email
        const userQuery = await db.collection('users').where('email', '==', emailPembeli).limit(1).get();

        if (userQuery.empty) {
            console.log(`User dengan email ${emailPembeli} belum daftar di Promptku.`);
            // Opsional: Bisa buat user baru otomatis, tapi untuk sekarang kita skip/error aja.
            return { statusCode: 404, body: 'User not found in Promptku database' };
        }

        const userDoc = userQuery.docs[0];

        // 5. Update Database (Buka Gembok!) 🔓
        await userDoc.ref.update({
            // Tambahkan ID Prompt ke array 'ownedPrompts' tanpa duplikat
            ownedPrompts: admin.firestore.FieldValue.arrayUnion(idPrompt)
        });

        console.log(`Sukses! Prompt ${idPrompt} dibuka untuk ${emailPembeli}`);
        return { statusCode: 200, body: 'Webhook Success' };

    } catch (error) {
        console.error("Webhook Error:", error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};