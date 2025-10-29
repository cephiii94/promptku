/*
 * File ini adalah backend aman kita (Netlify Function).
 * Ia akan berjalan di server Netlify, bukan di browser pengguna.
 */

// Netlify Node 18+ sudah memiliki 'fetch' secara global.
// const fetch = require('node-fetch'); // HANYA perlukan jika Anda menggunakan Node 16 atau lebih lama.

exports.handler = async (event) => {
    // 1. Hanya izinkan method POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // 2. Ambil API key dari Netlify Environment Variables (RAHASIA)
        // KITA AKAN SET INI DI DASHBOARD NETLIFY
        const apiKey = process.env.GEMINI_API_KEY; 
        
        if (!apiKey) {
            console.error("API key tidak ditemukan.");
            throw new Error("API key tidak dikonfigurasi di server.");
        }

        // 3. Parse data mentah dari body request (yang dikirim index.html)
        const data = JSON.parse(event.body);
        const { core, characterDetails, actionDetails, atmosphereDetails, style, quality, negative } = data;

        // 4. Buat ulang System Prompt dan User Query (Logika yang sama persis seperti di HTML kita sebelumnya)
        // Ini sekarang berjalan di server, aman.
        const systemPrompt = `Anda adalah seorang 'Prompt Engineer' ahli, spesialis dalam membuat prompt untuk model AI generatif gambar (seperti gemini-2.5-flash-image-preview). Tugas Anda adalah mengambil input sederhana dari pengguna dan mengubahnya menjadi prompt yang sangat deskriptIF, kaya akan detail sinematik, pencahayaan, dan komposisi untuk menghasilkan gambar berkualitas tinggi.

Aturan:
1.  Jawab HANYA dengan prompt yang sudah diperkaya. Jangan tambahkan basa-basi atau penjelasan.
2.  Selalu gunakan bahasa Inggris untuk prompt gambar.
3.  Gabungkan semua elemen (inti, karakter, aksi, suasana, gaya) menjadi satu paragraf yang mengalir dan deskriptif.
4.  Perhatikan input 'Character Details'. Jika ada beberapa karakter (Karakter 1, Karakter 2, dst.), pastikan Anda mendeskripsikan SETIAP karakter tersebut secara jelas di dalam prompt akhir. Jika ada link referensi wajah (dalam format '(referensi wajah: [URL])'), INTEGRASIKAN LINK ini ke dalam deskripsi karakter tersebut di prompt akhir.
5.  Secara kreatif tambahkan detail spesifik tentang pencahayaan, komposisi, dan kualitas.
6.  Jika ada prompt negatif, tambahkan di akhir dengan format '. Avoid: [negatives].'`;
        
        let userQueryParts = [`Core Prompt: ${core}`];
        if (characterDetails) userQueryParts.push(`Character Details:\n${characterDetails}`);
        if (actionDetails) userQueryParts.push(`Action/Interaction: ${actionDetails}`);
        if (atmosphereDetails) userQueryParts.push(`Atmosphere/Setting: ${atmosphereDetails}`);
        if (style) userQueryParts.push(`Style: ${style}`);
        if (quality) userQueryParts.push(`Quality Keywords: ${quality}`);
        if (negative) userQueryParts.push(`Negative Prompt: ${negative}`);
        const userQuery = `Tolong ubah input berikut menjadi prompt gambar yang deskriptif dan spesifik (dalam bahasa Inggris):\n\n${userQueryParts.join('\n')}`;

        // 5. Panggil Google API dari backend
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
        };

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error('Google API Error:', errorBody);
            throw new Error(`Google API error (${apiResponse.status}): ${errorBody}`);
        }

        const result = await apiResponse.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error('Respon AI tidak valid:', result);
            throw new Error("Respon AI tidak valid.");
        }

        // 6. Kembalikan respons (HANYA teks) ke frontend (index.html)
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text.trim() }) // Kirim balik sebagai { text: "..." }
        };

    } catch (error) {
        console.error('Error di Netlify Function:', error);
        // Kirim pesan error kembali ke frontend
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
