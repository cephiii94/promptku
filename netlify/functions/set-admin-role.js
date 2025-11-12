// File: netlify/functions/set-admin-role.js
// Panggil fungsi ini SEKALI SAJA secara manual untuk mendaftarkan admin
// Contoh: .../set-admin-role?email=email.admin@gmail.com&key=RAHASIAANDA

const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error("Gagal inisialisasi Firebase Admin:", e);
  }
}

// Ganti ini dengan kunci rahasia Anda sendiri
const ADMIN_KEY = process.env.ADMIN_SET_KEY || "kunci-rahasia-super-sulit-ditebak";

// ▼▼▼ PERBAIKAN: Menambahkan header CORS ▼▼▼
const headers = {
  'Access-Control-Allow-Origin': '*', // Mengizinkan semua domain (termasuk blob:/localhost)
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS' // Hanya izinkan GET dan OPTIONS
};
// ▲▲▲ AKHIR PERBAIKAN ▲▲▲

exports.handler = async (event, context) => {
  // ▼▼▼ PERBAIKAN: Menangani pre-flight request (OPTIONS) ▼▼▼
  // Browser akan mengirim request OPTIONS dulu untuk cek izin CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: 'OK'
    };
  }
  // ▲▲▲ AKHIR PERBAIKAN ▲▲▲

  const { email, key } = event.queryStringParameters;

  if (key !== ADMIN_KEY) {
    return { 
      statusCode: 401, 
      headers, // Kirim header di setiap respon
      body: 'Invalid admin key' 
    };
  }

  if (!email) {
    return { 
      statusCode: 400, 
      headers, // Kirim header di setiap respon
      body: 'Missing email parameter' 
    };
  }

  try {
    // 1. Cari user berdasarkan email
    const user = await admin.auth().getUserByEmail(email);
    
    // 2. Set Custom Claim
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    return {
      statusCode: 200,
      headers, // Kirim header di setiap respon
      body: `Berhasil! User ${email} (UID: ${user.uid}) sekarang adalah admin.`
    };

  } catch (error) {
    console.error("Error setting admin role:", error);
    return { 
      statusCode: 500, 
      headers, // Kirim header di setiap respon
      body: `Error: ${error.message}` 
    };
  }
};