// netlify/functions/mayar_webhook.js
// VERSI MULTI-PRODUK: Support Token & Premium Membership 💎

const admin = require('firebase-admin');

// --- 1. SETUP FIREBASE (Sama seperti sebelumnya) ---
if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY 
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
        : undefined;

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        })
    });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
    // --- 2. VALIDASI BASIC ---
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const mySecret = process.env.MAYAR_WEBHOOK_SECRET;
    const incomingSecret = event.queryStringParameters.secret;

    if (mySecret && incomingSecret !== mySecret) {
        console.warn("⚠️ Akses ditolak: Secret Key salah.");
        return { statusCode: 403, body: 'Forbidden' };
    }

    try {
        // --- 3. BACA DATA MAYAR ---
        const payload = JSON.parse(event.body);
        console.log("📨 Payload Masuk:", JSON.stringify(payload));

        const dataPaket = payload.data || {}; 
        const emailPembeli = dataPaket.customerEmail;
        const statusTransaksi = dataPaket.transactionStatus;
        // Kita ambil nama produk, lalu kita 'trim' (hapus spasi depan/belakang) biar aman
        const productName = dataPaket.productName ? dataPaket.productName.trim() : ""; 

        if (!emailPembeli || statusTransaksi !== 'paid') {
            console.log(`ℹ️ Transaksi diabaikan (Email kosong atau status bukan paid).`);
            return { statusCode: 200, body: 'Ignored' };
        }

        // --- 4. CARI USER ---
        const userQuery = await db.collection('users')
                                    .where('email', '==', emailPembeli)
                                    .limit(1)
                                    .get();

        if (userQuery.empty) {
            console.error(`❌ User ${emailPembeli} tidak ditemukan.`);
            return { statusCode: 200, body: 'User not found' };
        }

        const userDoc = userQuery.docs[0];
        
        // --- 5. LOGIKA POLISI LALU LINTAS (ROUTER PRODUK) 🚦 ---
        // Variabel penampung update apa yang mau dilakukan
        let updateData = {}; 

        // Cek Nama Produk (Sesuaikan STRING ini dengan nama persis di Mayar Tuan)
        switch (productName) {
            case 'Paket Token Hemat': // Contoh nama di Mayar
            case 'Paket Token':       // Jaga-jaga kalau namanya beda dikit
                console.log("🪙 Mendeteksi pembelian TOKEN");
                updateData = {
                    token: admin.firestore.FieldValue.increment(5), // Nambah 5
                    lastTransaction: admin.firestore.FieldValue.serverTimestamp()
                };
                break;

            case 'Membership Premium': // Contoh nama di Mayar
            case 'Akun Sultan':        // Nama lain misal Tuan iseng
                console.log("💎 Mendeteksi pembelian PREMIUM");
                updateData = {
                    isPremium: true, // Set flag jadi User Premium
                    premiumSince: admin.firestore.FieldValue.serverTimestamp(),
                    // Opsional: Kasih bonus token juga kalau beli premium
                    token: admin.firestore.FieldValue.increment(10) 
                };
                break;

            default:
                console.warn(`⚠️ Produk "${productName}" dibayar tapi tidak dikenali di kode.`);
                // Jangan error, return success aja biar Mayar gak retry terus
                return { statusCode: 200, body: `Product ${productName} not handled.` };
        }

        // --- 6. EKSEKUSI UPDATE DATABASE ---
        await userDoc.ref.update(updateData);

        console.log(`✅ Sukses update user ${emailPembeli} untuk produk: ${productName}`);
        return { statusCode: 200, body: 'Webhook Processed Successfully' };

    } catch (error) {
        console.error("🔥 Error:", error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};