/*
Ini adalah server sederhana Anda (Netlify Function).
Tugasnya adalah menerima permintaan dari browser,
membuat signature rahasia menggunakan API SECRET Anda,
dan mengirimkannya kembali ke browser.

Browser TIDAK PERNAH melihat API SECRET Anda.
*/

// Impor library Cloudinary
const cloudinary = require('cloudinary').v2;

// Ini adalah fungsi utama yang akan dijalankan Netlify
exports.handler = async (event, context) => {
  try {
    // 1. Ambil Kunci Rahasia Anda dari Netlify Environment Variables
    // (Anda akan mengaturnya di dashboard Netlify, BUKAN di kode ini)
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

    // 2. Konfigurasikan Cloudinary dengan kunci rahasia
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true
    });

    // 3. Buat timestamp (waktu saat ini)
    const timestamp = Math.round((new Date()).getTime() / 1000);

    // 4. Tentukan parameter yang ingin Anda "kunci" dengan signature
    // Kita "mengunci" timestamp dan upload_preset
    const paramsToSign = {
      timestamp: timestamp,
      upload_preset: 'galeri-prompt-uploads' // HARUS SAMA dengan yang ada di script.js
    };

    // 5. Buat signature rahasianya
    const signature = cloudinary.utils.api_sign_request(paramsToSign, CLOUDINARY_API_SECRET);

    // 6. Kirim signature, timestamp, dan API Key (API Key boleh publik) kembali ke browser
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature: signature,
        timestamp: timestamp,
        api_key: CLOUDINARY_API_KEY
      })
    };
  } catch (error) {
    console.error('Error generating signature:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Gagal membuat signature' })
    };
  }
};
