// --- 1. SETUP FIREBASE (Sama seperti Webhook) ---
const admin = require('firebase-admin');

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

exports.handler = async (event) => {
    // 1. Hanya izinkan method POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // 2. Ambil API key dari Netlify Environment Variables
        const apiKey = process.env.GEMINI_API_KEY; 
        if (!apiKey) throw new Error("API key tidak dikonfigurasi di server.");

        // 3. Parse data
        const data = JSON.parse(event.body);
        const { userId, core, characterDetails, actionDetails, atmosphereDetails, style, quality, negative } = data;

        // --- CEK SALDO USER (TRANSACTON) ---
        if (!userId) {
            return { statusCode: 401, body: JSON.stringify({ error: "User ID diperlukan." }) };
        }

        const COST = 5; // Biaya per generate (Promtium)

        await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new Error("User tidak ditemukan.");
            }

            const currentToken = userDoc.data().token || 0;
            if (currentToken < COST) {
                // Lempar error khusus agar bisa ditangkap di catch bawah
                throw new Error("INSUFFICIENT_FUNDS");
            }

            // Potong saldo
            transaction.update(userRef, {
                token: currentToken - COST,
                lastUsage: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        // -----------------------------------

        // 4. Buat system prompt (Sama seperti sebelumnya)
        const systemPrompt = `Anda adalah seorang 'Prompt Engineer' ahli, spesialis dalam membuat prompt untuk model AI generatif gambar (seperti gemini-2.5-flash-image-preview). Tugas Anda adalah mengambil input sederhana dari pengguna dan mengubahnya menjadi prompt yang sangat deskriptIF, kaya akan detail sinematik, pencahayaan, dan komposisi untuk menghasilkan gambar berkualitas tinggi.

Aturan:
1.  Jawab HANYA dengan prompt yang sudah diperkaya. Jangan tambahkan basa-basi atau penjelasan.
2.  Selalu gunakan bahasa Inggris untuk prompt gambar.
3.  Gabungkan semua elemen (inti, karakter, aksi, suasana, gaya) menjadi satu paragraf yang mengalir dan deskriptif.
4.  Perhatikan input 'Character Details'. Jika ada beberapa karakter, pastikan Anda mendeskripsikan SETIAP karakter tersebut secara jelas. INTEGRASIKAN LINK referensi wajah jika ada.
5.  Secara kreatif tambahkan detail spesifik tentang pencahayaan, komposisi, dan kualitas.
6.  Jika ada prompt negatif, tambahkan di akhir dengan format '. Avoid: [negatives].'`;
        
        // ... (Logic penyusunan userQuery sama)
        let userQueryParts = [`Core Prompt: ${core}`];
        if (characterDetails) userQueryParts.push(`Character Details:\n${characterDetails}`);
        if (actionDetails) userQueryParts.push(`Action/Interaction: ${actionDetails}`);
        if (atmosphereDetails) userQueryParts.push(`Atmosphere/Setting: ${atmosphereDetails}`);
        if (style) userQueryParts.push(`Style: ${style}`);
        if (quality) userQueryParts.push(`Quality Keywords: ${quality}`);
        if (negative) userQueryParts.push(`Negative Prompt: ${negative}`);
        const userQuery = `Tolong ubah input berikut menjadi prompt gambar yang deskriptif dan spesifik (dalam bahasa Inggris):\n\n${userQueryParts.join('\n')}`;

        // 5. Panggil Google API
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            throw new Error(`Google API error (${apiResponse.status}): ${errorBody}`);
        }

        const result = await apiResponse.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error("Respon AI tidak valid.");

        // 6. Return response + sisa saldo (optional, tapi bagus buat UI)
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text.trim(), deducted: COST }) 
        };

    } catch (error) {
        console.error('Error:', error);
        
        // Handle Insufficient Funds khusus
        if (error.message.includes("INSUFFICIENT_FUNDS")) {
             return {
                statusCode: 402, // Payment Required
                body: JSON.stringify({ error: "Saldo Promtium tidak cukup. Harap Top Up." })
            };
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
