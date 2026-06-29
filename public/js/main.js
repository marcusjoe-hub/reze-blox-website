// public/js/main.js
// ------------------------------------------------------------
// Small shared browser behaviors for the whole site.
// This file is intentionally simple for beginners.
// ------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  setupMobileNav();
  setupRobloxFormValidation();
  setupAdminDashboardTools();
  setupDangerousAdminConfirm();
});

function setupMobileNav() {
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navLinks = document.querySelector('[data-nav-links]');

  if (!navToggle || !navLinks) return;

  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

function setupRobloxFormValidation() {
  const form = document.querySelector('#robloxForm');
  const input = document.querySelector('#robloxUsername');
  const error = document.querySelector('#robloxError');

  if (!form || !input || !error) return;

  form.addEventListener('submit', (event) => {
    const trimmedUsername = input.value.trim();

    if (!trimmedUsername) {
      event.preventDefault();
      error.textContent = 'Please enter your Roblox username before continuing.';
      input.focus();
      return;
    }

    if (trimmedUsername.length > 20) {
      event.preventDefault();
      error.textContent = 'Roblox usernames cannot be longer than 20 characters.';
      input.focus();
      return;
    }

    // Store the trimmed value before the real POST request is sent.
    // Server-side validation still runs too. Never trust only frontend validation.
    input.value = trimmedUsername;
    form.classList.add('submitting');
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Loading...';
    }
  });
}

function setupAdminDashboardTools() {
  const searchInput = document.querySelector('#adminSearch');
  const tableBody = document.querySelector('#submissionsTableBody');
  const emptyState = document.querySelector('#adminEmptyState');
  const refreshButton = document.querySelector('#refreshAdminBtn');

  if (!tableBody) return;

  const rows = Array.from(tableBody.querySelectorAll('tr'));

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const searchTerm = searchInput.value.trim().toLowerCase();
      let visibleCount = 0;

      rows.forEach((row) => {
        const discordUsername = row.dataset.discord || '';
        const shouldShow = discordUsername.includes(searchTerm);
        row.classList.toggle('hidden', !shouldShow);
        if (shouldShow) visibleCount += 1;
      });

      if (emptyState) {
        emptyState.textContent = rows.length ? 'No submissions match your search.' : 'No submissions yet.';
        emptyState.classList.toggle('hidden', visibleCount !== 0);
      }
    });
  }

  // Phase 3: Export CSV is now a secure backend link to /admin/export.csv.
  // Refresh simply reloads the admin page to fetch the newest Supabase data.
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

function setupDangerousAdminConfirm() {
  const dangerForm = document.querySelector('[data-danger-clear-form]');

  if (!dangerForm) return;

  dangerForm.addEventListener('submit', (event) => {
    const confirmed = confirm('Are you SURE you want to delete ALL submissions? This cannot be undone.');

    if (!confirmed) {
      event.preventDefault();
    }
  });
}
