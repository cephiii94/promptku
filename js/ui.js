// js/ui.js

// === 1. DOM SELECTORS ===
export const els = {
  promptGrid: document.getElementById("prompt-grid"),
  categoryFilter: document.getElementById("filter-input"),
  sortByFilter: document.getElementById("sort-filter"), // [BARU] Sort Filter
  textFilterDesktop: document.getElementById("filter-input"),
  textFilterMobile: document.getElementById("filter-input-mobile"),
  clearSearchBtn: document.getElementById("clear-search-btn"),
  homeCategoryList: document.getElementById("home-category-list"),
  paginationContainer: document.getElementById("pagination-container"),

  // Auth & Header
  authButtonsDesktop: document.getElementById("auth-buttons-desktop"),
  userProfileDesktop: document.getElementById("user-profile-desktop"),
  headerAvatar: document.getElementById("header-avatar"),
  dropdownUsername: document.getElementById("dropdown-username"),
  dropdownEmail: document.getElementById("dropdown-email"),
  loginBtnDesktop: document.getElementById("login-btn-desktop"),
  logoutBtnDesktop: document.getElementById("logout-btn-desktop"),
  dropdownTrigger: document.getElementById("profile-dropdown-trigger"),
  profileDropdown: document.getElementById("profile-dropdown-menu"),

  // Mobile Nav
  navAuthContainer: document.getElementById("nav-auth-container"),
  navAddPrompt: document.getElementById("nav-add-prompt"),
  navAddPromptMobile: document.getElementById("nav-add-prompt-mobile"),
  navSearch: document.getElementById("nav-search"),
  searchOverlay: document.getElementById("search-form-overlay"),
  bottomNavMobile: document.querySelector(".bottom-nav-mobile"),

  // Forms & Modals
  loginForm: document.getElementById("login-form"),
  promptForm: document.getElementById("prompt-form"),

  // Form Inputs
  promptCategoryInput: document.getElementById("prompt-category"),
  promptPremiumCheck: document.getElementById("prompt-isPremium"),
  mayarLinkContainer: document.getElementById("mayar-link-container"),
  promptMayarLink: document.getElementById("prompt-mayarLink"),
  promptMayarSku: document.getElementById("prompt-mayarSku"),
  promptTextInput: document.getElementById("prompt-text"),

  // Image Handling
  imagePreviewWrapper: document.getElementById("image-preview-wrapper"),
  fileInputWrapper: document.getElementById("file-input-wrapper"),
  promptImagePreview: document.getElementById("prompt-image-preview"),
  deleteImageBtn: document.getElementById("delete-image-btn"),

  // Modal Nav
  modalNavPrev: document.getElementById("modal-nav-prev"),
  modalNavNext: document.getElementById("modal-nav-next"),
};

// === 2. MODAL UTILS ===
export const showModal = (modalId) => {
  if (els.bottomNavMobile) els.bottomNavMobile.style.display = "none";
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "flex";
};

export const hideModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
  if (els.bottomNavMobile) els.bottomNavMobile.style.display = "flex";
};

// === 3. RENDER FUNCTIONS ===
export const populateCategoryOptions = (
  categories,
  activeCategory,
  onChipClick
) => {
  // Dropdown Form Upload
  if (els.promptCategoryInput) {
    els.promptCategoryInput.innerHTML =
      '<option value="" disabled selected>-- Pilih Kategori --</option>';
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      els.promptCategoryInput.appendChild(option);
    });
  }

  // Chips Home
  if (els.homeCategoryList) {
    els.homeCategoryList.innerHTML = "";

    const allChip = document.createElement("button");
    allChip.className = `category-chip ${
      activeCategory === "all" ? "active" : ""
    }`;
    allChip.textContent = "Semua";
    allChip.dataset.value = "all";
    allChip.addEventListener("click", () => onChipClick("all"));
    els.homeCategoryList.appendChild(allChip);

    categories.forEach((category) => {
      const chip = document.createElement("button");
      chip.className = `category-chip ${
        activeCategory === category ? "active" : ""
      }`;
      chip.textContent = category;
      chip.dataset.value = category;
      chip.addEventListener("click", () => onChipClick(category));
      els.homeCategoryList.appendChild(chip);
    });
  }
};

export const renderPrompts = (
  prompts,
  currentUser,
  currentPage,
  itemsPerPage
) => {
  if (!els.promptGrid) return;

  if (!prompts.length) {
    els.promptGrid.innerHTML =
      '<p style="text-align:center; width:100%; padding: 2rem; color: #666;">Tidak ada prompt yang ditemukan.</p>';
    return;
  }

  const allCardsHTML = prompts
    .map((prompt, index) => {
      const absoluteIndex = (currentPage - 1) * itemsPerPage + index;

      // 1. Admin/Owner Actions
      let adminActions = "";
      if (
        currentUser &&
        (prompt.creatorId === currentUser.uid || currentUser.isAdmin === true)
      ) {
        adminActions = `
            <div class="card-actions" style="gap: 4px; align-items: center;">
                <button type="button" class="action-btn" 
                    style="width: auto; padding: 0 8px; font-size: 11px; background: rgba(0,0,0,0.7); border-radius: 4px;"
                    onclick="event.stopPropagation(); navigator.clipboard.writeText('${prompt.id}'); Swal.fire({toast: true, position: 'top-end', icon: 'success', title: 'ID Disalin!', showConfirmButton: false, timer: 1000});">
                    ID
                </button>
                <button class="action-btn edit-btn" data-id="${prompt.id}"><span class="material-icons">edit</span><span class="tooltip">Edit</span></button>
                <button class="action-btn delete-btn" data-id="${prompt.id}"><span class="material-icons">delete</span><span class="tooltip">Hapus</span></button>
            </div>`;
      }

      const overlayCategoryHtml = prompt.category
        ? `<span class="image-overlay-text" data-filter-type="category" data-filter-value="${prompt.category}">${prompt.category}</span>`
        : "";

      // =========================================================
      // [PERBAIKAN] DEFINISI VARIABEL isOwned (YANG TADI HILANG)
      // =========================================================
      const isOwned =
        currentUser &&
        ((currentUser.ownedPrompts &&
          currentUser.ownedPrompts.includes(prompt.id)) ||
          currentUser.isAdmin ||
          currentUser.uid === prompt.creatorId);
      // =========================================================

      // 2. Logika Tombol Overlay (PREMIUM vs GRATIS)
      let actionButtonHtml = "";

      // KONDISI 1: Premium & Belum Punya -> Tombol BELI
      if (prompt.isPremium && !isOwned) {
          actionButtonHtml = `
              <button class="copy-btn-overlay premium-btn pay-btn" data-mayar-link="${prompt.mayarLink}" style="background: #F59E0B; border-color: #D97706; color: white;">
                  <span class="material-icons">shopping_cart</span>
                  <span class="copy-text" style="display:inline; margin-left:4px;">Beli</span>
              </button>`;

      // KONDISI 2 (BARU): Premium & SUDAH Punya -> Tombol SUDAH BELI
      } else if (prompt.isPremium && isOwned) {
          // Kita kasih warna hijau biar kelihatan beda
          actionButtonHtml = `
              <button class="copy-btn-overlay" data-prompt-text="${encodeURIComponent(prompt.promptText || "")}" style="background: #10B981; border-color: #059669; color: white;">
                  <span class="material-icons">check_circle</span>
                  <span class="copy-text">Sudah Beli (Salin)</span>
              </button>`;

      // KONDISI 3: Gratisan -> Tombol SALIN Biasa
      } else {
          actionButtonHtml = `
              <button class="copy-btn-overlay" data-prompt-text="${encodeURIComponent(prompt.promptText || "")}">
                  <span class="material-icons">content_copy</span>
                  <span class="copy-text">Salin</span>
              </button>`;
      } 

      const premiumBadge = prompt.isPremium
        ? `<span style="position: absolute; top: 10px; right: 10px; background: #F59E0B; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; z-index: 5;">PREMIUM</span>`
        : "";

      const tagsHtml =
        prompt.tags && Array.isArray(prompt.tags) && prompt.tags.length > 0
          ? `<div class="card-tags-overlay">
                ${prompt.tags
                  .map(
                    (tag) =>
                      `<span class="tag-overlay" data-filter-type="tag" data-filter-value="${tag}">${tag}</span>`
                  )
                  .join("")}
               </div>`
          : "";

      const displayImage =
        prompt.imageUrl || "https://placehold.co/400x300?text=No+Image";

      return `
            <div class="card">
                <div class="card-image-container" data-id="${
                  prompt.id
                }" data-index="${absoluteIndex}" data-action="view-prompt">
                    <img src="${displayImage}" alt="Hasil gambar: ${
        prompt.title
      }" loading="lazy">
                    <span class="card-expand-hint material-icons">open_in_full</span>
                    ${overlayCategoryHtml}
                    ${premiumBadge}
                    ${adminActions}
                    <div class="card-prompt-overlay">
                        <div class="overlay-info">
                            <h4 class="overlay-title">${
                              prompt.title || "Tanpa Judul"
                            }</h4>
                            <span class="overlay-user">by ${
                              prompt.user || "Anonymous"
                            }</span>
                            ${tagsHtml}
                        </div>
                        ${actionButtonHtml}
                    </div>
                </div>
            </div>`;
    })
    .join("");
  els.promptGrid.innerHTML = allCardsHTML;
};

export const renderPagination = (totalPages, currentPage, onPageChange) => {
  if (!els.paginationContainer) return;

  let html = `
        <button class="page-btn prev-btn" ${
          currentPage === 1 ? "disabled" : ""
        }>
            <span class="material-icons">chevron_left</span>
        </button>
    `;

  const maxVisibleButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);

  if (endPage - startPage + 1 < maxVisibleButtons) {
    startPage = Math.max(1, endPage - maxVisibleButtons + 1);
  }

  if (startPage > 1) {
    html += `<button class="page-btn num-btn" data-page="1">1</button>`;
    if (startPage > 2)
      html += `<span style="padding:0 5px; color:#aaa;">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn num-btn ${
      i === currentPage ? "active" : ""
    }" data-page="${i}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1)
      html += `<span style="padding:0 5px; color:#aaa;">...</span>`;
    html += `<button class="page-btn num-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  html += `
        <button class="page-btn next-btn" ${
          currentPage === totalPages ? "disabled" : ""
        }>
            <span class="material-icons">chevron_right</span>
        </button>
    `;

  els.paginationContainer.innerHTML = html;

  // Attach Listeners
  els.paginationContainer.querySelectorAll(".num-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      onPageChange(parseInt(btn.dataset.page))
    );
  });
  els.paginationContainer
    .querySelector(".prev-btn")
    ?.addEventListener("click", () => {
      if (currentPage > 1) onPageChange(currentPage - 1);
    });
  els.paginationContainer
    .querySelector(".next-btn")
    ?.addEventListener("click", () => {
      if (currentPage < totalPages) onPageChange(currentPage + 1);
    });
};

// === 4. AUTH STATE UI (LOGIKA DIPERBAIKI: LANGSUNG KE DIV) ===
// File: js/ui.js

export const updateAuthStateUI = (
  user,
  isAdmin,
  onLoginClick,
  onLogoutClick
) => {
  // 1. Ambil elemen Navigasi User Mobile (Si Bunglon)
  const navUserMobile = document.getElementById("nav-user-mobile");

  // Reset Pointer (agar bisa diklik)
  if (navUserMobile) navUserMobile.style.cursor = "pointer";

  if (user) {
    // =======================
    // KONDISI: SUDAH LOGIN
    // =======================

    // A. UI Desktop (Tetap sama)
    if (els.authButtonsDesktop) els.authButtonsDesktop.style.display = "none";
    if (els.userProfileDesktop) els.userProfileDesktop.style.display = "flex";

    if (els.headerAvatar)
      els.headerAvatar.src =
        user.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          user.displayName || "User"
        )}&background=2563EB&color=fff`;
    if (els.dropdownUsername) {
      let nameHTML = user.displayName || "Pengguna";
      if (isAdmin)
        nameHTML += ` <span style="background-color: #EF4444; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; vertical-align: middle; margin-left: 6px; font-weight: 700;">ADMIN</span>`;
      els.dropdownUsername.innerHTML = nameHTML;
    }
    if (els.dropdownEmail) els.dropdownEmail.textContent = user.email;

    // B. UI Mobile: Ubah tombol jadi PROFIL
    if (navUserMobile) {
      navUserMobile.innerHTML = `
                <span class="material-icons">person</span>
                <span class="nav-label">Profil</span>
            `;
      navUserMobile.href = "profile.html"; // Arahkan ke halaman profil

      // Hapus event listener 'Login' sebelumnya (PENTING!)
      // Cara termudah: clone node untuk membuang semua event listener lama
      const newNav = navUserMobile.cloneNode(true);
      navUserMobile.parentNode.replaceChild(newNav, navUserMobile);
    }

    // C. Munculkan Tombol (+) FAB
    if (els.navAddPromptMobile)
      els.navAddPromptMobile.classList.remove("hidden");
  } else {
    // =======================
    // KONDISI: BELUM LOGIN (TAMU)
    // =======================

    // A. UI Desktop
    if (els.authButtonsDesktop) els.authButtonsDesktop.style.display = "block";
    if (els.userProfileDesktop) els.userProfileDesktop.style.display = "none";

    // B. UI Mobile: Ubah tombol jadi MASUK (LOGIN)
    if (navUserMobile) {
      navUserMobile.innerHTML = `
                <span class="material-icons">login</span>
                <span class="nav-label">Masuk</span>
            `;
      navUserMobile.href = "#"; // Jangan pindah halaman

      // Pasang Event Listener untuk Buka Modal Login
      // Kita clone dulu biar bersih dari event lama
      const newNav = navUserMobile.cloneNode(true);
      navUserMobile.parentNode.replaceChild(newNav, navUserMobile);

      newNav.addEventListener("click", (e) => {
        e.preventDefault();
        onLoginClick(); // Panggil fungsi buka modal
      });
    }

    // C. Sembunyikan Tombol (+) FAB
    if (els.navAddPromptMobile) els.navAddPromptMobile.classList.add("hidden");
  }
};

// === 5. FORM FILLING HELPER ===
export const fillPromptModal = (data, isAdmin) => {
  const titleText = data
    ? `Edit Prompt (ID: ${data.id})`
    : "Tambah Prompt Baru";
  document.getElementById("modal-title").innerText = titleText;
  document.getElementById("prompt-id").value = data?.id || "";
  document.getElementById("prompt-title").value = data?.title || "";
  document.getElementById("prompt-socialUrl").value = data?.socialUrl || "";

  if (els.promptCategoryInput)
    els.promptCategoryInput.value = data?.category || "";

  els.promptTextInput.value = data?.promptText || "";
  document.getElementById("prompt-imageUrl").value = data?.imageUrl || "";
  document.getElementById("prompt-tags").value =
    data?.tags && Array.isArray(data.tags) ? data.tags.join(", ") : "";

  // Premium Check
  const isPrem = data?.isPremium || false;
  if (els.promptPremiumCheck) els.promptPremiumCheck.checked = isPrem;
  if (els.promptMayarLink) els.promptMayarLink.value = data?.mayarLink || "";
  if (els.promptMayarSku) els.promptMayarSku.value = data?.mayarSku || "";

  const premiumContainer = document.getElementById("premium-container");
  if (premiumContainer) {
    if (isAdmin) {
      premiumContainer.style.display = "flex"; // Munculkan kalau Admin
    } else {
      premiumContainer.style.display = "none"; // Sembunyikan kalau User Biasa
      // Reset nilai kalau user biasa (biar gak sengaja ke-submit)
      if (els.promptPremiumCheck) els.promptPremiumCheck.checked = false;
    }
  }

  // Toggle UI Premium Input
  if (els.mayarLinkContainer) {
    if (isPrem) {
      els.mayarLinkContainer.style.display = "block";
      if (els.promptMayarLink) els.promptMayarLink.required = true;
      if (els.promptTextInput)
        els.promptTextInput.placeholder =
          "Tulis deskripsi singkat / teaser di sini. JANGAN TULIS PROMPT ASLI!";
    } else {
      els.mayarLinkContainer.style.display = "none";
      if (els.promptMayarLink) els.promptMayarLink.required = false;
      if (els.promptTextInput) els.promptTextInput.placeholder = "Isi Prompt";
    }
  }

  // Image Input Toggle
  const fileInput = document.getElementById("prompt-imageFile");
  if (data && data.imageUrl) {
    els.promptImagePreview.src = data.imageUrl;
    els.imagePreviewWrapper.style.display = "block";
    els.fileInputWrapper.style.display = "none";
    fileInput.required = false;
  } else {
    els.promptImagePreview.src = "";
    els.imagePreviewWrapper.style.display = "none";
    els.fileInputWrapper.style.display = "block";
    fileInput.required = true;
  }
};

// === 6. FULL VIEW MODAL ===
export const showFullViewModal = (
  data,
  currentUser,
  currentViewIndex,
  totalItems
) => {
  const modalTitle = document.querySelector(
    "#view-prompt-modal .modal-prompt-side h2"
  );
  if (modalTitle) modalTitle.textContent = data.title;

  const modalImg = document.getElementById("view-modal-image");
  if (modalImg) modalImg.src = data.imageUrl;

  const modalPromptText = document.getElementById("view-modal-prompt-text");
  const authorText = document.getElementById("view-modal-author-text");
  const authorLink = document.getElementById("view-modal-author-link");

  const copyBtn = document.getElementById("view-modal-copy-btn");
  const generateBtn = document.getElementById("view-modal-generate-btn");

  // Logic Premium di Modal
// === GANTI BLOK INI DI DALAM FUNGSI showFullViewModal (js/ui.js) ===

  // 1. Cek Kepemilikan (Sama seperti di Grid)
  const isOwned = currentUser && (
      (currentUser.ownedPrompts && currentUser.ownedPrompts.includes(data.id)) ||
      currentUser.isAdmin ||
      currentUser.uid === data.creatorId
  );

  // 2. Logic Tampilan (Premium vs Gratis/Owned)
  if (data.isPremium && !isOwned) {
    // --- KONDISI A: Premium & BELUM BELI (Terkunci) ---
    if (modalPromptText) {
      modalPromptText.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #D97706; background: #FFFBEB; border-radius: 8px;">
                <span class="material-icons" style="font-size: 48px; margin-bottom: 1rem;">lock</span><br>
                <strong>Prompt Ini Terkunci (Premium)</strong><br>
                <p style="margin-top: 10px; color: #4B5563;">${
                  data.promptText ||
                  "Dapatkan akses penuh ke prompt berkualitas tinggi ini dengan membelinya."
                }</p>
            </div>`;
    }
    if (generateBtn) generateBtn.style.display = "none";

    // Ubah Tombol jadi "Beli Sekarang" (Orange)
    if (copyBtn) {
      copyBtn.classList.remove("login-btn");
      copyBtn.classList.add("pay-btn");
      copyBtn.style.backgroundColor = "#F59E0B";
      copyBtn.style.borderColor = "#D97706";
      copyBtn.style.color = "#fff";
      copyBtn.innerHTML = `<span class="material-icons">shopping_cart</span><span>Beli Sekarang</span>`;

      copyBtn.dataset.mayarLink = data.mayarLink;
      copyBtn.dataset.isPremium = "true"; // Agar mentrigger checkout
    }

  } else {
    // --- KONDISI B: Gratis ATAU SUDAH BELI (Terbuka) ---
    
    if (modalPromptText) modalPromptText.textContent = data.promptText;
    
    if (generateBtn) {
      generateBtn.style.display = "flex";
      generateBtn.dataset.promptText = encodeURIComponent(data.promptText);
    }
    
    if (copyBtn) {
      copyBtn.classList.add("login-btn");
      copyBtn.classList.remove("pay-btn");
      
      // Cek: Jika ini Premium TAPI Sudah Beli -> Kasih Tampilan Spesial (Hijau)
      if (data.isPremium && isOwned) {
          copyBtn.style.backgroundColor = "#10B981"; // Hijau
          copyBtn.style.borderColor = "#059669";
          copyBtn.style.color = "#fff";
          copyBtn.innerHTML = `<span class="material-icons">check_circle</span><span>Sudah Beli (Salin)</span>`;
      } else {
          // Tampilan Standar Gratisan
          copyBtn.style.backgroundColor = ""; 
          copyBtn.style.borderColor = "";
          copyBtn.style.color = "";
          copyBtn.innerHTML = `<span class="material-icons">file_open</span><span>Lihat Prompt</span>`;
      }

      copyBtn.dataset.promptText = encodeURIComponent(data.promptText);
      copyBtn.dataset.isPremium = "false"; // Agar mentrigger fungsi salin
    }
  }

  // Author Info
  if (authorText && authorLink) {
    if (data.user && data.socialUrl) {
      authorText.textContent = "Prompt by: ";
      authorLink.href = data.socialUrl;
      authorLink.textContent = data.user;
      authorLink.style.display = "inline";
    } else if (data.user) {
      authorText.textContent = "Prompt by: " + data.user;
      authorLink.style.display = "none";
    } else {
      authorText.textContent = "";
      authorLink.style.display = "none";
    }
  }

  // Modal Nav Logic
  if (els.modalNavPrev)
    els.modalNavPrev.style.display = currentViewIndex === 0 ? "none" : "flex";
  if (els.modalNavNext)
    els.modalNavNext.style.display =
      currentViewIndex === totalItems - 1 ? "none" : "flex";

  // Like Button Logic
  const likeBtn = document.getElementById("view-modal-like-btn");
  const likeCountSpan = document.getElementById("view-modal-like-count");
  if (likeBtn && likeCountSpan) {
    likeBtn.dataset.id = data.id;
    likeCountSpan.textContent = data.likeCount || 0;
    const isLiked =
      currentUser && data.likedBy && data.likedBy.includes(currentUser.uid);
    if (isLiked) {
      likeBtn.classList.add("liked");
      likeBtn.querySelector(".material-icons").textContent = "favorite";
    } else {
      likeBtn.classList.remove("liked");
      likeBtn.querySelector(".material-icons").textContent = "favorite_border";
    }
  }

  showModal("view-prompt-modal");
};

export const toggleClearButton = () => {
  if (!els.clearSearchBtn || !els.textFilterDesktop) return;
  if (els.textFilterDesktop.value.trim().length > 0) {
    els.clearSearchBtn.classList.remove("hidden");
  } else {
    els.clearSearchBtn.classList.add("hidden");
  }
};
