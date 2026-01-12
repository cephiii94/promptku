// netlify/functions/mayar-webhook.js

const admin = require('firebase-admin');

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
    // 1. Cek Metode
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 2. Cek Keamanan (UBAHAN DISINI)
    // Kita ambil secret dari URL (?secret=...)
    const mySecret = process.env.MAYAR_WEBHOOK_SECRET;
    const incomingSecret = event.queryStringParameters.secret; // <--- BACA DARI URL

    if (mySecret && incomingSecret !== mySecret) {
        console.log("Secret Key Salah/Tidak Ada di URL! 🥷");
        return { statusCode: 403, body: 'Forbidden' };
    }

    try {
        const payload = JSON.parse(event.body);
        console.log("Laporan Masuk:", payload);

        // Ambil data Email & SKU
        const emailPembeli = payload.customer_email || payload.email; 
        const idPrompt = payload.product_code || payload.sku; 

        if (!emailPembeli || !idPrompt) {
            return { statusCode: 400, body: 'Data tidak lengkap (Butuh Email & SKU).' };
        }

        // Cari User
        const userQuery = await db.collection('users').where('email', '==', emailPembeli).limit(1).get();

        if (userQuery.empty) {
            console.log(`User ${emailPembeli} tidak ditemukan.`);
            return { statusCode: 404, body: 'User not found' };
        }

        const userDoc = userQuery.docs[0];

        // Update Database
        await userDoc.ref.update({
            ownedPrompts: admin.firestore.FieldValue.arrayUnion(idPrompt)
        });

        console.log(`Sukses! Prompt ${idPrompt} dibuka untuk ${emailPembeli}`);
        return { statusCode: 200, body: 'Webhook Success' };

    } catch (error) {
        console.error("Error:", error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};