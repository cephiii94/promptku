const admin = require("firebase-admin");

// 1. Setup Database LAMA (Sumber)
const serviceAccountLama = require("./kunci-lama.json");
const appLama = admin.initializeApp({
  credential: admin.credential.cert(serviceAccountLama)
}, "lama");
const dbLama = appLama.firestore();

// 2. Setup Database BARU (Tujuan)
const serviceAccountBaru = require("./kunci-baru.json");
const appBaru = admin.initializeApp({
  credential: admin.credential.cert(serviceAccountBaru)
}, "baru");
const dbBaru = appBaru.firestore();

async function migratePrompts() {
  console.log("🚀 Mulai memindahkan data...");

  // Ambil semua data dari collection 'prompts' di project lama
  const snapshot = await dbLama.collection("prompts").get();

  if (snapshot.empty) {
    console.log("Tidak ada data di project lama.");
    return;
  }

  let count = 0;
  
  // Loop setiap dokumen
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const docId = doc.id; // Kita pakai ID yang sama persis

    // Tulis ke project baru
    await dbBaru.collection("prompts").doc(docId).set(data);
    
    count++;
    console.log(`✅ Berhasil memindahkan: ${docId}`);
  }

  console.log(`🎉 Selesai! Total ${count} prompts berhasil dipindah.`);
}

migratePrompts();