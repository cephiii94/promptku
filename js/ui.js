// [TAMBAHAN] js/ui.js - Render Pagination Controls

export const renderPagination = (totalItems, itemsPerPage, currentPage, container, onPageChange) => {
    if (!container) return;
    container.innerHTML = ''; // Bersihkan container

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Jika data kosong atau cuma 1 halaman, tidak perlu tombol
    if (totalItems === 0 || totalPages <= 1) return;

    // --- Helper untuk bikin tombol ---
    const createBtn = (text, page, isActive = false, isDisabled = false, extraClass = '') => {
        const btn = document.createElement('button');
        btn.className = `page-btn ${extraClass} ${isActive ? 'active' : ''}`;
        btn.innerHTML = text; // Bisa teks atau icon HTML
        if (isDisabled) btn.disabled = true;
        
        if (!isDisabled && !isActive) {
            btn.addEventListener('click', () => {
                onPageChange(page); // Panggil fungsi di main.js saat diklik
            });
        }
        return btn;
    };

    // 1. Tombol PREV (<)
    const prevBtn = createBtn('<span class="material-icons">chevron_left</span>', currentPage - 1, false, currentPage === 1, 'prev-btn');
    container.appendChild(prevBtn);

    // 2. Logika Tombol Angka (Maksimal 5 tombol biar rapi)
    const maxVisibleButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);

    if (endPage - startPage + 1 < maxVisibleButtons) {
        startPage = Math.max(1, endPage - maxVisibleButtons + 1);
    }

    // Tombol Halaman Pertama (1) jika jauh
    if (startPage > 1) {
        container.appendChild(createBtn('1', 1, false, false, 'num-btn'));
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.style.cssText = 'padding:0 5px; color:#aaa;';
            dots.textContent = '...';
            container.appendChild(dots);
        }
    }

    // Loop Tombol Angka Tengah
    for (let i = startPage; i <= endPage; i++) {
        container.appendChild(createBtn(i, i, i === currentPage, false, 'num-btn'));
    }

    // Tombol Halaman Terakhir jika jauh
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.style.cssText = 'padding:0 5px; color:#aaa;';
            dots.textContent = '...';
            container.appendChild(dots);
        }
        container.appendChild(createBtn(totalPages, totalPages, false, false, 'num-btn'));
    }

    // 3. Tombol NEXT (>)
    const nextBtn = createBtn('<span class="material-icons">chevron_right</span>', currentPage + 1, false, currentPage === totalPages, 'next-btn');
    container.appendChild(nextBtn);
};