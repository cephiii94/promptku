// netlify/functions/mayar_webhook.js
// VERSI SUPER: Token + Membership + Produk Satuan (SKU) 🦸‍♂️

const admin = require('firebase-admin');

// 1. SETUP FIREBASE
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
    // 2. CEK METHOD & SECRET
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const mySecret = process.env.MAYAR_WEBHOOK_SECRET;
    if (mySecret && event.queryStringParameters.secret !== mySecret) {
        console.warn("⚠️ Secret Key Salah!");
        return { statusCode: 403, body: 'Forbidden' };
    }

    try {
        // 3. PARSE DATA
        const payload = JSON.parse(event.body);
        const data = payload.data || payload; // Jaga-jaga struktur beda
        
        const emailRaw = data.customerEmail || data.email;
        const emailPembeli = emailRaw ? emailRaw.toLowerCase() : "";
        
        let status = data.transactionStatus || data.status || "";
        status = status.toLowerCase(); // [FIX] Case insensitive

        const productName = data.productName ? data.productName.trim() : "";
        
        // PRIORITAS UTAMA: productId (karena ini yang muncul di paylod Produk_Demo Tuan)
        const incomingSku = data.productCode || data.sku || data.product_code || data.productId || data.id;

        console.log(`📨 Webhook Masuk: ${emailPembeli} | Status: ${status} | SKU: ${incomingSku}`);
        console.log("📦 Full Payload (Debug):", JSON.stringify(data)); // [DEBUG]

        // Hanya proses yang sudah dibayar
        if (status !== 'paid' && status !== 'settled' && status !== 'success') { // [ADD] 'success' just in case
            console.log("⚠️ Status belum paid/settled, diabaikan.");
            return { statusCode: 200, body: 'Ignored: Not paid yet' };
        }

        // Cari User
        const userQuery = await db.collection('users').where('email', '==', emailPembeli).limit(1).get();
        if (userQuery.empty) {
            console.error(`❌ User ${emailPembeli} tidak ditemukan.`);
            return { statusCode: 200, body: 'User not found' };
        }
        const userDoc = userQuery.docs[0];

        // 4. LOGIKA UTAMA (ROUTER) 🚦
        let updateData = {};
        let logMessage = "";

        // -- CEK 1: APAKAH INI TOP UP TOKEN / MEMBER? --
        // (Kita cek SKU/Product ID dulu biar lebih sakti, baru fallback ke Nama)
        
        switch (incomingSku) {
            // --- TOKEN PACKS ---
            // --- PROMTIUM PACKS ---
            // 1. Paket Coba-coba (50 Promtium)
            case '36ecd528-5e6e-4903-bc32-bf76d9d5cf20': 
                updateData = { 
                    token: admin.firestore.FieldValue.increment(50),
                    lastTopUp: admin.firestore.FieldValue.serverTimestamp()
                };
                logMessage = "🪙 Top Up Promtium +50";
                break;

            // 2. Paket Hemat (150 Promtium)
            case '276517df-ba82-45a4-b2d0-667e8bbbb1a0': 
                updateData = { 
                    token: admin.firestore.FieldValue.increment(150),
                    lastTopUp: admin.firestore.FieldValue.serverTimestamp()
                };
                logMessage = "🪙 Top Up Promtium +150";
                break;
            
            // 3. Paket Standar (200 Promtium)
            case 'e3fa41de-6c27-4ac6-8c84-905885c3fc89': 
                updateData = { 
                    token: admin.firestore.FieldValue.increment(200),
                    lastTopUp: admin.firestore.FieldValue.serverTimestamp()
                };
                logMessage = "🪙 Top Up Promtium +200";
                break;

             // 4. Paket Jumbo (300 + 10 Bonus)
            case '2829f4d4-bee9-41c7-94c1-ba08c26d1a3b': 
                updateData = { 
                    token: admin.firestore.FieldValue.increment(310),
                    lastTopUp: admin.firestore.FieldValue.serverTimestamp()
                };
                logMessage = "🪙 Top Up Promtium +310";
                break;

            // --- MEMBERSHIP ---
            case '1f489245-8118-4dd5-b44a-9caa0d3d9f91':
                updateData = { 
                    isPremium: true,
                    premiumSince: admin.firestore.FieldValue.serverTimestamp()
                };
                logMessage = "💎 Upgrade ke Premium Member (Sultan)";
                break;

            default:
                // Kalo SKU khusus diatas gak kena, kita coba cek logic lama (berdasarkan Nama)
                let handled = false;

                if (productName === 'Paket Token Hemat' || productName === 'Paket Token') {
                     updateData = { 
                        token: admin.firestore.FieldValue.increment(5), // Default lama
                        lastTopUp: admin.firestore.FieldValue.serverTimestamp()
                    };
                    logMessage = "🪙 Top Up Token +5 (Legacy Name)";
                    handled = true;
                } 
                else if (productName === 'Membership Premium' || productName === 'Akun Sultan') {
                    updateData = { 
                        isPremium: true,
                        premiumSince: admin.firestore.FieldValue.serverTimestamp()
                    };
                    logMessage = "💎 Upgrade ke Premium Member (Legacy Name)";
                    handled = true;
                }

                if (!handled) {
                    // -- CEK 2: JIKA BUKAN TOKEN/MEMBER, MUNGKIN BELI PROMPT SATUAN?
                    if (incomingSku) {
                        console.log(`🔍 Bukan paket rutin. Mencari prompt dengan SKU: ${incomingSku}...`);
                        
                        // Cari prompt di DB yang punya mayarSku sama
                        const promptQuery = await db.collection('prompts')
                                                  .where('mayarSku', '==', incomingSku)
                                                  .limit(1)
                                                  .get();
                        
                        if (!promptQuery.empty) {
                            const promptId = promptQuery.docs[0].id;
                            
                            // Masukkan ID Prompt ke Array ownedPrompts user
                            updateData = {
                                ownedPrompts: admin.firestore.FieldValue.arrayUnion(promptId)
                            };
                            logMessage = `🛍️ Membeli Prompt Satuan (ID: ${promptId})`;
                        } else {
                            console.warn(`⚠️ SKU '${incomingSku}' dibayar tapi tidak ada di Database Prompts.`);
                            return { statusCode: 200, body: 'Product SKU not found in DB' };
                        }
                    } else {
                        console.warn(`⚠️ Produk '${productName}' tidak dikenali logic.`);
                        return { statusCode: 200, body: 'Product unhandled' };
                    }
                }
                break;
        }

        // 5. EKSEKUSI UPDATE
        await userDoc.ref.update(updateData);
        console.log(`✅ SUKSES: ${logMessage} untuk ${emailPembeli}`);

        return { statusCode: 200, body: 'Webhook Success' };

    } catch (error) {
        console.error("🔥 Error:", error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};