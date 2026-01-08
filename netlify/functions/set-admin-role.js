const admin = require('firebase-admin');

// --- KONFIGURASI ---
const ADMIN_KEY = process.env.ADMIN_SET_KEY || "kunci-rahasia-super-sulit-ditebak";

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

// --- INISIALISASI FIREBASE ADMIN ---
// Kita lakukan di luar handler agar tidak init ulang berkali-kali (caching)
if (!admin.apps.length) {
  try {
    // 1. Cek Kelengkapan Variabel Dulu (Debugging)
    if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error("Variabel FIREBASE_PRIVATE_KEY atau FIREBASE_CLIENT_EMAIL belum diset di Netlify!");
    }

    // 2. Format Private Key
    // Netlify kadang menyimpan enter sebagai text "\n", kita ubah jadi Enter beneran.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
      })
    });
    console.log("Firebase Admin Berhasil Init!");

  } catch (e) {
    console.error("GAGAL INIT FIREBASE:", e.message);
    // Kita biarkan error ini, nanti ditangkap di handler
  }
}

exports.handler = async (event, context) => {
  // Handle Pre-flight request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: 'OK' };
  }

  // --- CEK STATUS INIT ---
  // Kalau admin gagal init tadi, kita langsung lapor ke Tuan di browser
  if (!admin.apps.length) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        message: 'Server Gagal Login ke Firebase (Init Failed).',
        detail: 'Cek Environment Variables di Netlify: PRIVATE_KEY atau CLIENT_EMAIL mungkin kosong/salah format.',
        hint: 'Pastikan sudah Deploy (Trigger Deploy) setelah update Environment Variables.'
      })
    };
  }

  const { email, key } = event.queryStringParameters;

  // Cek Kunci Rahasia
  if (key !== ADMIN_KEY) {
    return { 
      statusCode: 401, 
      headers,
      body: 'Kunci admin (key) salah!' 
    };
  }

  if (!email) {
    return { 
      statusCode: 400, 
      headers,
      body: 'Email wajib diisi!' 
    };
  }

  try {
    // Cari user
    const user = await admin.auth().getUserByEmail(email);
    
    // Set Admin
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    return {
      statusCode: 200,
      headers,
      body: `SUKSES! User ${email} (UID: ${user.uid}) sekarang adalah ADMIN.`
    };

  } catch (error) {
    return { 
      statusCode: 500, 
      headers,
      body: `Gagal saat setAdmin: ${error.message} (Pastikan user sudah daftar)` 
    };
  }
};