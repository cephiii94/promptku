// File: netlify/functions/generate-image.js
// KODE INI UNTUK MEMANGGIL API GEMINI 2.5 FLASH IMAGE (NANO BANANA)
// DENGAN KONFIGURASI YANG BENAR

exports.handler = async (event) => {
    
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Error: GEMINI_API_KEY tidak diatur. Pastikan file .env ada dan 'netlify dev' sudah di-restart." })
        };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Metode tidak diizinkan' }) };
    }

    let userPrompt;
    try {
        userPrompt = JSON.parse(event.body).prompt;
        if (!userPrompt) throw new Error("Prompt tidak boleh kosong.");
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ message: `Gagal membaca request: ${error.message}` }) };
    }

    // ===================================================================
    // KONEKSI KE API GOOGLE GEMINI (IMAGE GENERATION)
    // ===================================================================
    
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            // Ini adalah format payload untuk Gemini Image Generation
            body: JSON.stringify({
                "contents": [
                    { "parts": [{ "text": userPrompt }] }
                ],
                // ================== [PERUBAHAN DI SINI] ==================
                "generationConfig": {
                    // Kita TIDAK menggunakan 'responseMimeType'.
                    // Kita menggunakan 'responseModalities' untuk meminta gambar.
                    "responseModalities": ["IMAGE"] 
                }
                // ==========================================================
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API Error:", errorData);
            // Ini akan menampilkan error dari Google jika masih ada
            throw new Error(errorData.error.message || `API Error: ${response.status}`);
        }

        const data = await response.json();

        // Logika ini SUDAH BENAR. Model ini akan mengembalikan 'inlineData'
        const part = data.candidates[0].content.parts[0];
        if (!part.inlineData || !part.inlineData.data) {
            console.error("Format balasan tidak dikenal:", data);
            
            // Cek apakah ada 'text' (jika model menolak promptnya)
            if(part.text) {
                throw new Error(`API menolak prompt: ${part.text}`);
            }
            
            throw new Error("Format balasan dari API tidak dikenal (tidak ada inlineData).");
        }
        
        const imageBase64 = part.inlineData.data;
        const imageUrl = `data:image/png;base64,${imageBase64}`;

        // ===============================================================
        // KIRIM BALASAN SUKSES KE FRONTEND
        // ===============================================================
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                imageUrl: imageUrl
            })
        };

    } catch (error) {
        console.error("Handler Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: `Internal Server Error: ${error.message}` })
        };
    }
};