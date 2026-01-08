// File: netlify/functions/set-admin-role.js
const admin = require('firebase-admin');

// [UPDATE] Inisialisasi menggunakan Variabel Terpisah (Lebih Aman & Mudah)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Penting: Mengubah karakter \n menjadi baris baru yang asli
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
      })
    });
  } catch (e) {
    console.error("Gagal inisialisasi Firebase Admin:", e);
  }
}

// Kunci pengaman agar tidak sembarang orang bisa set admin
// Bri sarankan Tuan ganti string ini atau set env var ADMIN_SET_KEY di Netlify
const ADMIN_KEY = process.env.ADMIN_SET_KEY || "kunci-rahasia-super-sulit-ditebak";

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: 'OK' };
  }

  const { email, key } = event.queryStringParameters;

  // Cek Kunci Rahasia
  if (key !== ADMIN_KEY) {
    return { 
      statusCode: 401, 
      headers,
      body: 'Kunci admin (key) salah atau tidak valid!' 
    };
  }

  // Cek Email
  if (!email) {
    return { 
      statusCode: 400, 
      headers,
      body: 'Parameter email wajib diisi!' 
    };
  }

  try {
    // 1. Cari user berdasarkan email
    const user = await admin.auth().getUserByEmail(email);
    
    // 2. Berikan "Stempel" Admin (Custom Claims)
    // claim 'admin: true' inilah yang dibaca oleh Security Rules Firestore
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    return {
      statusCode: 200,
      headers,
      body: `SUKSES! User ${email} (UID: ${user.uid}) sekarang resmi menjadi ADMIN.`
    };

  } catch (error) {
    console.error("Error setting admin role:", error);
    return { 
      statusCode: 500, 
      headers,
      body: `Gagal: ${error.message} (Pastikan user sudah sign-up/terdaftar dulu di Authentication)` 
    };
  }
};