// Menggunakan fetch bawaan (Node 18+)
// const fetch = require('node-fetch');

// API Key dari .env (pastikan di-set di terminal atau hardcode temporary saat run)
const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyCFNGXL8Xr7xK7Iu20C6-Uc4XUqNCraN5M'; 

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    try {
        console.log("Fetching available models...");
        const response = await fetch(url);
        
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Error ${response.status}: ${err}`);
        }

        const data = await response.json();
        const models = data.models || [];
        
        console.log(`\nFound ${models.length} models:`);
        models.forEach(m => {
            if (m.name.includes('gemini')) {
                console.log(`- ${m.name.replace('models/', '')}`);
                console.log(`  Support: ${m.supportedGenerationMethods.join(', ')}`);
            }
        });
        
    } catch (error) {
        console.error("Failed:", error.message);
    }
}

listModels();
