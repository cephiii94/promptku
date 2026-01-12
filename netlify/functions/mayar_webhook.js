// netlify/functions/mayar-webhook.js
// VERSI CERDAS: Support Lookup SKU Mayar

const admin = require('firebase-admin');

// --- BRI FIX: RAKIT KREDENSIAL DARI ENV VARS TERPISAH (HEMAT MEMORI) ---
if (!admin.apps.length) {
    // Pastikan private key diformat benar (mengatasi masalah newline \n di env var)
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
    // 1. Cek Metode
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 2. Cek Keamanan (Secret dari URL)
    const mySecret = process.env.MAYAR_WEBHOOK_SECRET;
    const incomingSecret = event.queryStringParameters.secret;

    if (mySecret && incomingSecret !== mySecret) {
        console.log("Secret Key Salah! 🥷");
        return { statusCode: 403, body: 'Forbidden' };
    }

    try {
        const payload = JSON.parse(event.body);
        console.log("Laporan Masuk:", payload);

        // Ambil data Email & SKU dari Mayar
        const emailPembeli = payload.customer_email || payload.email; 
        const incomingSku = payload.product_code || payload.sku; 

        if (!emailPembeli || !incomingSku) {
            return { statusCode: 400, body: 'Data tidak lengkap.' };
        }

        // --- LOGIKA BARU: CARI ID ASLI ---
        let realPromptId = incomingSku; // Default: anggap SKU = ID

        // Coba cari di database: "Prompt mana yang punya mayarSku = incomingSku?"
        const promptQuery = await db.collection('prompts')
                                    .where('mayarSku', '==', incomingSku)
                                    .limit(1)
                                    .get();

        if (!promptQuery.empty) {
            // KETEMU! Pakai ID asli dokumennya
            realPromptId = promptQuery.docs[0].id;
            console.log(`SKU Mayar ${incomingSku} diterjemahkan menjadi ID: ${realPromptId}`);
        } else {
            console.log(`Peringatan: Tidak ada prompt dengan mayarSku '${incomingSku}'. Mencoba pakai SKU langsung sebagai ID.`);
        }
        // --------------------------------

        // Cari User
        const userQuery = await db.collection('users').where('email', '==', emailPembeli).limit(1).get();

        if (userQuery.empty) {
            console.log(`User ${emailPembeli} tidak ditemukan.`);
            return { statusCode: 404, body: 'User not found' };
        }

        const userDoc = userQuery.docs[0];

        // Update Database User
        await userDoc.ref.update({
            ownedPrompts: admin.firestore.FieldValue.arrayUnion(realPromptId)
        });

        console.log(`Sukses! Prompt ${realPromptId} dibuka untuk ${emailPembeli}`);
        return { statusCode: 200, body: 'Webhook Success' };

    } catch (error) {
        console.error("Error:", error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};