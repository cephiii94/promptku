// File: netlify/functions/generate-image.js
// INI ADALAH KODE UNTUK MEMANGGIL API GEMINI (TEKS)

exports.handler = async (event) => {
    
    // 1. Ambil API Key (sekarang seharusnya sudah terbaca setelah restart)
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Error: GEMINI_API_KEY tidak diatur. Restart server 'netlify dev' Anda." })
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
    // KONEKSI KE API GOOGLE GEMINI (TEKS)
    // ===================================================================
    // Perhatikan: Model ini (gemini-1.5-flash) adalah untuk TEKS.
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    try {
        // Kami akan meminta Gemini untuk "menyempurnakan prompt", bukan membuat gambar
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                // Ini adalah format payload untuk Gemini API (teks)
                "contents": [
                    {
                        "parts": [
                            { "text": `Anda adalah asisten AI. Seseorang memberi Anda prompt untuk image generator. Sempurnakan prompt ini agar lebih baik, tapi kembalikan HANYA teks prompt yang sudah disempurnakan. Prompt asli: "${userPrompt}"` }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API Error:", errorData);
            throw new Error(errorData.error.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        
        // Mengambil HASIL TEKS dari balasan Gemini
        const generatedText = data.candidates[0].content.parts[0].text;

        // ===============================================================
        // INI ADALAH MASALAH SELANJUTNYA
        // ===============================================================
        // Frontend Anda (image-generator.html) mengharapkan balasan:
        // { "imageUrl": "http://..." }
        //
        // Tapi API ini mengembalikan TEKS, bukan URL gambar.
        // Kita akan tetap mengirim balasan yang salah formatnya
        // untuk membuktikan bahwa API-nya merespons.
        
        return {
            statusCode: 200,
            // Balasan ini akan GAGAL di frontend, tapi membuktikan API Key Anda benar
            body: JSON.stringify({ 
                message: "API Gemini (Teks) Berhasil!", 
                hasilTeks: generatedText 
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