        // --- Konstanta Modal ---
        const openModalButton = document.getElementById('openModalButton');
        const closeModalButton = document.getElementById('closeModalButton');
        const howToModal = document.getElementById('howToModal');
        
        // --- Konstanta Form ---
        const generateButton = document.getElementById('generateButton');
        const copyButton = document.getElementById('copyButton');
        const corePromptEl = document.getElementById('corePrompt');
        const styleMediumEl = document.getElementById('styleMedium');
        const addCharacterButton = document.getElementById('addCharacterButton');
        const characterContainer = document.getElementById('characterContainer');
        const actionDetailsEl = document.getElementById('actionDetails'); 
        const atmosphereDetailsEl = document.getElementById('atmosphereDetails');
        const qualityEl = document.getElementById('quality');
        const negativeEl = document.getElementById('negative');
        const finalPromptEl = document.getElementById('finalPrompt');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const buttonText = document.getElementById('buttonText');
        const resultLoaderEl = document.getElementById('resultLoader');

        // --- Event Listener untuk Modal (Menggunakan kelas .modal dari styles.css) ---
        openModalButton.addEventListener('click', () => {
            howToModal.style.display = 'flex';
        });

        closeModalButton.addEventListener('click', () => {
            howToModal.style.display = 'none';
        });

        howToModal.addEventListener('click', (event) => {
            if (event.target === howToModal) {
                howToModal.style.display = 'none';
            }
        });
        // ----------------------------------------


        // --- [PERUBAHAN] FUNGSI Menambah Field Karakter (Menggunakan kelas CSS baru) ---
        let characterCounter = 0; 
        function addNewCharacterField() {
            characterCounter++;
            const charId = `character-${characterCounter}`;

            // [PERUBAHAN] Menggunakan kelas CSS baru: .character-field-wrapper
            const fieldWrapper = document.createElement('div');
            fieldWrapper.className = 'character-field-wrapper'; 

            const detailTextarea = document.createElement('textarea');
            detailTextarea.id = `${charId}-detail`;
            detailTextarea.className = 'character-field'; // Ini adalah textarea
            detailTextarea.placeholder = `Detail Karakter #${characterCounter} (misal: pria, jaket kulit, rambut hitam)`;
            detailTextarea.rows = 2;

            const refLinkInput = document.createElement('input');
            refLinkInput.type = 'url'; 
            refLinkInput.id = `${charId}-ref-link`;
            refLinkInput.className = 'character-ref-link'; // Ini adalah input
            refLinkInput.placeholder = 'Link Gambar Referensi Wajah (Opsional)';

            // [PERUBAHAN] Menggunakan kelas CSS baru: .remove-char-btn
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'remove-char-btn';
            removeButton.innerHTML = '&times;'; 
            removeButton.addEventListener('click', () => {
                fieldWrapper.remove();
            });

            fieldWrapper.appendChild(detailTextarea);
            fieldWrapper.appendChild(refLinkInput); 
            fieldWrapper.appendChild(removeButton);
            characterContainer.appendChild(fieldWrapper);
        }

        addCharacterButton.addEventListener('click', addNewCharacterField);
        addNewCharacterField(); // Tambah satu saat dimuat

        // === FUNGSI PANGGIL NETLIFY (Logika tetap sama) ===
        document.getElementById('prompt-form').addEventListener('submit', async (e) => {
            e.preventDefault(); // Mencegah submit form standar

            const core = corePromptEl.value.trim();
            const style = styleMediumEl.value;

            const characterFields = document.querySelectorAll('.character-field');
            const characterRefLinks = document.querySelectorAll('.character-ref-link');
            const characterDetailsList = [];
            
            characterFields.forEach((field, index) => {
                const detail = field.value.trim();
                const refLink = characterRefLinks[index] ? characterRefLinks[index].value.trim() : '';
                if (detail) {
                    let characterDescription = `Karakter ${index + 1}: ${detail}`;
                    if (refLink) {
                        characterDescription += ` (referensi wajah: ${refLink})`; 
                    }
                    characterDetailsList.push(characterDescription);
                }
            });
            const characterDetails = characterDetailsList.join('\n');
            
            const actionDetails = actionDetailsEl.value.trim();
            const atmosphereDetails = atmosphereDetailsEl.value.trim();
            const quality = qualityEl.value.trim();
            const negative = negativeEl.value.trim();

            if (!core) {
                finalPromptEl.value = "Harap isi 'Prompt Inti' terlebih dahulu.";
                return;
            }

            // Tampilkan status loading
            generateButton.disabled = true;
            loadingSpinner.classList.remove('hidden');
            buttonText.textContent = 'Memproses AI...';
            finalPromptEl.classList.add('hidden'); // Sembunyikan textarea
            copyButton.classList.add('hidden'); // Sembunyikan tombol salin
            resultLoaderEl.classList.remove('hidden'); // Tampilkan skeleton

            const functionEndpoint = '/.netlify/functions/generate-prompt';
            const payload = { core, characterDetails, actionDetails, atmosphereDetails, style, quality, negative };

            try {
                const response = await fetch(functionEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorResult = await response.json();
                    throw new Error(errorResult.error || `Server error (${response.status})`);
                }

                const result = await response.json();
                
                if (result.text) {
                    finalPromptEl.value = result.text.trim();
                } else {
                    finalPromptEl.value = 'Maaf, server tidak memberikan respons yang valid.';
                }

            } catch (error) {
                finalPromptEl.value = `Gagal terhubung ke server: ${error.message}.`;
            } finally {
                // Sembunyikan status loading
                generateButton.disabled = false;
                loadingSpinner.classList.add('hidden');
                buttonText.textContent = 'Buat Prompt Cerdas (AI)';
                
                resultLoaderEl.classList.add('hidden'); // Sembunyikan skeleton
                finalPromptEl.classList.remove('hidden'); // Tampilkan textarea
                copyButton.classList.remove('hidden'); // Tampilkan tombol salin
            }
        });

        // --- Fungsi Salin (Disesuaikan untuk tombol baru) ---
        copyButton.addEventListener('click', () => {
            if (finalPromptEl.classList.contains('hidden') || !finalPromptEl.value || finalPromptEl.value.startsWith("Harap isi")) {
                return;
            }

            finalPromptEl.select();
            finalPromptEl.setSelectionRange(0, 99999); 
            
            try {
                document.execCommand('copy');
                copyButton.classList.add('copied'); // Gunakan kelas 'copied' dari styles.css
                
                setTimeout(() => {
                    copyButton.classList.remove('copied');
                }, 1500);

            } catch (err) {
                console.error('Gagal menyalin teks: ', err);
            }
            
            window.getSelection().removeAllRanges();
        });