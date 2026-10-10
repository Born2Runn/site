// On importe les modules Firebase en direct
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";

// --- À REMPLACER PAR TON CONFIGURATION FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyB3yWGx_A4Np7Fb4VlSSbG-dL1c_fTMvR8",
  authDomain: "born2run-9def0.firebaseapp.com",
  databaseURL: "https://born2run-9def0-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "born2run-9def0",
  storageBucket: "born2run-9def0.firebasestorage.app",
  messagingSenderId: "1058732311172",
  appId: "1:1058732311172:web:c55ac488a1e2065e86b8d1",
  measurementId: "G-DK0WV3T0TZ"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. ÉTAT GLOBAL
    // =========================================================================
    let sessions = [];
    let registeredRunners = [];
    
    let isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    let currentParticipants = [];
    const ADMIN_KEY = "admin123";

    // =========================================================================
    // 2. SYNCHRONISATION EN TEMPS RÉEL (FIREBASE)
    // =========================================================================
    
    // Écouter les changements des courses en direct
    const sessionsRef = ref(db, 'sessions');
    onValue(sessionsRef, (snapshot) => {
        const data = snapshot.val();
        sessions = data ? data : [];
        updateAllViews(); // Se met à jour tout seul chez tout le monde !
    });

    // Écouter les changements des coureurs inscrits en direct
    const runnersRef = ref(db, 'runners');
    onValue(runnersRef, (snapshot) => {
        const data = snapshot.val();
        registeredRunners = data ? data : [];
        renderGlobalRunners();
        renderSelectableRunners();
    });

    // =========================================================================
    // 3. FONCTIONS D'AFFICHAGE ET CALCULS
    // =========================================================================

    function calculatePace(distance, time) {
        if (!distance || distance === 0) return "0:00 /km";
        const pace = time / distance;
        const minutes = Math.floor(pace);
        const seconds = Math.round((pace - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
    }

    function formatTimeDisplay(totalMinutes) {
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`;
        return `${m} min`;
    }

    function updateAdminUI() {
        const adminAddBtn = document.getElementById('nav-add-run');
        const adminElements = document.querySelectorAll('.admin-only');
        const loginArea = document.getElementById('admin-login-area');
        const logoutArea = document.getElementById('admin-logout-area');
        const desktopBadge = document.getElementById('admin-status-badge');
        const mobileBadge = document.getElementById('mobile-admin-status-badge');

        if (isAdmin) {
            if (adminAddBtn) adminAddBtn.classList.remove('hidden');
            adminElements.forEach(el => el.classList.remove('hidden'));
            if (loginArea) loginArea.classList.add('hidden');
            if (logoutArea) logoutArea.classList.remove('hidden');
            
            if (desktopBadge) {
                desktopBadge.innerHTML = '<i class="fa-solid fa-unlock"></i> Administrateur';
                desktopBadge.style.color = 'var(--primary-color)';
            }
            if (mobileBadge) {
                mobileBadge.innerHTML = '<i class="fa-solid fa-unlock"></i> Admin';
                mobileBadge.style.color = 'var(--primary-color)';
            }
        } else {
            if (adminAddBtn) adminAddBtn.classList.add('hidden');
            adminElements.forEach(el => el.classList.add('hidden'));
            if (loginArea) loginArea.classList.remove('hidden');
            if (logoutArea) logoutArea.classList.add('hidden');
            
            if (desktopBadge) {
                desktopBadge.innerHTML = '<i class="fa-solid fa-lock"></i> Mode Visiteur';
                desktopBadge.style.color = 'var(--text-muted)';
            }
            if (mobileBadge) {
                mobileBadge.innerHTML = '<i class="fa-solid fa-lock"></i> Visiteur';
                mobileBadge.style.color = 'var(--text-muted)';
            }
            
            const viewAddRun = document.getElementById('view-add-run');
            if (viewAddRun && viewAddRun.classList.contains('active')) {
                const leaderboardBtn = document.querySelector('[data-target="view-leaderboard"]');
                if (leaderboardBtn) leaderboardBtn.click();
            }
        }
        renderHistory(); 
    }

    function renderGlobalRunners() {
        const container = document.getElementById('global-runners-list');
        if (!container) return;
        container.innerHTML = '';

        if (registeredRunners.length === 0) {
            container.innerHTML = '<p class="empty-msg">Aucun coureur pré-enregistré.</p>';
        } else {
            registeredRunners.forEach((name, index) => {
                const badge = document.createElement('div');
                badge.className = 'participant-badge';
                badge.innerHTML = `${name} <i class="fa-solid fa-xmark remove-global-runner" data-index="${index}"></i>`;
                container.appendChild(badge);
            });
        }
        renderLeaderboard(); 
    }

    function renderSelectableRunners() {
        const container = document.getElementById('selectable-runners-list');
        if (!container) return;
        container.innerHTML = '';

        if (registeredRunners.length === 0 && currentParticipants.length === 0) {
            container.innerHTML = '<p class="empty-msg" style="margin-left:0;">Tapez un nom ci-dessus pour commencer.</p>';
            return;
        }

        registeredRunners.forEach((name) => {
            const badge = document.createElement('div');
            badge.className = `runner-select-badge ${currentParticipants.includes(name) ? 'selected' : ''}`;
            badge.textContent = name;
            
            badge.addEventListener('click', () => {
                if (currentParticipants.includes(name)) {
                    currentParticipants = currentParticipants.filter(p => p !== name);
                    badge.classList.remove('selected');
                } else {
                    currentParticipants.push(name);
                    badge.classList.add('selected');
                }
            });
            container.appendChild(badge);
        });
    }

    function renderLatestSessions() {
        const card = document.getElementById('latest-session-card');
        const container = document.getElementById('latest-sessions-container');
        if (!card || !container) return;

        if (sessions.length === 0) {
            card.classList.add('hidden');
            return;
        }

        const sortedSessions = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestDate = sortedSessions[0].date;
        const latestSessions = sortedSessions.filter(s => s.date === latestDate);

        container.innerHTML = '';
        card.classList.remove('hidden');

        latestSessions.forEach(session => {
            const dateObj = new Date(session.date);
            const dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            const participantsStr = session.participants && session.participants.length > 0 ? session.participants.join(', ') : 'Aucun';

            const sessionCard = document.createElement('div');
            sessionCard.className = 'latest-session-item';
            
            sessionCard.innerHTML = `
                <div class="latest-session-date">
                    <i class="fa-solid fa-calendar-day"></i> ${dateStr}
                </div>
                <div class="latest-session-stats">
                    <div class="latest-session-stat">
                        <span>Distance</span>
                        <span>${parseFloat(session.distance).toFixed(2)} km</span>
                    </div>
                    <div class="latest-session-stat">
                        <span>Temps</span>
                        <span>${formatTimeDisplay(session.time)}</span>
                    </div>
                    <div class="latest-session-stat">
                        <span>Allure</span>
                        <span style="color: var(--primary-color);">${calculatePace(session.distance, session.time)}</span>
                    </div>
                </div>
                <div class="latest-session-participants">
                    <i class="fa-solid fa-users"></i> ${participantsStr}
                </div>
            `;
            container.appendChild(sessionCard);
        });
    }

    function renderLeaderboard() {
        const tbody = document.getElementById('leaderboard-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const stats = {};
        
        registeredRunners.forEach(runner => {
            const name = runner.toLowerCase().trim();
            stats[name] = { displayName: runner, totalDistance: 0, totalTime: 0, runsCount: 0 };
        });

        sessions.forEach(session => {
            if (session.participants) {
                session.participants.forEach(participant => {
                    const name = participant.toLowerCase().trim();
                    if (!stats[name]) {
                        stats[name] = { displayName: participant, totalDistance: 0, totalTime: 0, runsCount: 0 };
                    }
                    stats[name].totalDistance += parseFloat(session.distance);
                    stats[name].totalTime += parseInt(session.time);
                    stats[name].runsCount += 1;
                });
            }
        });

        const runnersArray = Object.values(stats).sort((a, b) => b.totalDistance - a.totalDistance);

        if (runnersArray.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Aucun coureur enregistré.</td></tr>`;
            return;
        }

        runnersArray.forEach((runner, index) => {
            const tr = document.createElement('tr');
            let rankClass = '', rankDisplay = '-';
            
            const hasRun = runner.runsCount > 0;

            if (hasRun) {
                rankDisplay = index + 1;
                if (index === 0) { rankClass = 'rank-1'; rankDisplay = '<i class="fa-solid fa-medal"></i> 1er'; } 
                else if (index === 1) { rankClass = 'rank-2'; rankDisplay = '2ème'; } 
                else if (index === 2) { rankClass = 'rank-3'; rankDisplay = '3ème'; }
            }

            const distDisplay = hasRun ? `${runner.totalDistance.toFixed(2)} km` : 'N/D';
            const timeDisplay = hasRun ? formatTimeDisplay(runner.totalTime) : 'N/D';
            const paceDisplay = hasRun ? calculatePace(runner.totalDistance, runner.totalTime) : 'N/D';
            const runsDisplay = hasRun ? `${runner.runsCount} session(s)` : 'N/D';

            tr.innerHTML = `
                <td class="${rankClass}">${rankDisplay}</td>
                <td style="font-weight: bold; text-transform: capitalize;">${runner.displayName}</td>
                <td>${runsDisplay}</td>
                <td>${distDisplay}</td>
                <td>${timeDisplay}</td>
                <td style="color: ${hasRun ? 'var(--primary-color)' : 'var(--text-muted)'};">${paceDisplay}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderHistory() {
        const tbody = document.getElementById('history-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        const sortedSessions = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sortedSessions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Aucun historique disponible.</td></tr>`;
            return;
        }

        sortedSessions.forEach(session => {
            const tr = document.createElement('tr');
            const dateObj = new Date(session.date);
            const dateStr = dateObj.toLocaleDateString('fr-FR');
            const participantsStr = session.participants && session.participants.length > 0 ? session.participants.join(', ') : 'Aucun';

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${participantsStr}</td>
                <td>${parseFloat(session.distance).toFixed(2)} km</td>
                <td>${formatTimeDisplay(session.time)}</td>
                <td>${calculatePace(session.distance, session.time)}</td>
                <td class="admin-only ${isAdmin ? '' : 'hidden'}">
                    <button class="action-btn delete-session-btn" data-id="${session.id}" title="Supprimer la session">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function updateAllViews() {
        renderLatestSessions();
        renderLeaderboard();
        renderHistory();
    }

    // =========================================================================
    // 4. ÉCOUTEURS D'ÉVÉNEMENTS (EVENT LISTENERS)
    // =========================================================================

    // --- Navigation ---
    const navItems = document.querySelectorAll('.nav-links li');
    const views = document.querySelectorAll('.view');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            if (!targetId) return;

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            views.forEach(view => {
                view.classList.remove('active');
                view.classList.add('hidden');
            });
            
            const targetView = document.getElementById(targetId);
            if (targetView) {
                targetView.classList.remove('hidden');
                targetView.classList.add('active');
                if (targetId === 'view-add-run') {
                    currentParticipants = [];
                    renderSelectableRunners();
                }
            }
        });
    });

    // --- Thème ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        let isLightMode = localStorage.getItem('theme') === 'light';
        const updateThemeUI = () => {
            document.body.setAttribute('data-theme', isLightMode ? 'light' : 'dark');
            themeToggleBtn.textContent = isLightMode ? 'Passer au thème Sombre' : 'Passer au thème Clair';
        };
        themeToggleBtn.addEventListener('click', () => {
            isLightMode = !isLightMode;
            localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
            updateThemeUI();
        });
        updateThemeUI();
    }

    // --- Connexion Admin ---
    function triggerLogin() {
        const keyInput = document.getElementById('admin-key');
        if (keyInput && keyInput.value === ADMIN_KEY) {
            isAdmin = true;
            sessionStorage.setItem('isAdmin', 'true');
            keyInput.value = '';
            updateAdminUI();
        } else {
            alert('Clé incorrecte.');
        }
    }
    const btnLoginAdmin = document.getElementById('btn-login-admin');
    if (btnLoginAdmin) btnLoginAdmin.addEventListener('click', triggerLogin);
    
    const keyInput = document.getElementById('admin-key');
    if (keyInput) {
        keyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                triggerLogin();
            }
        });
    }

    const btnLogoutAdmin = document.getElementById('btn-logout-admin');
    if (btnLogoutAdmin) {
        btnLogoutAdmin.addEventListener('click', () => {
            isAdmin = false;
            sessionStorage.setItem('isAdmin', 'false');
            updateAdminUI();
        });
    }

    // --- Ajout Global de Coureur (Sauvegarde sur Firebase) ---
    function addGlobalRunner() {
        const input = document.getElementById('new-runner-name');
        if (!input) return;
        const name = input.value.trim();
        
        if (name && !registeredRunners.some(r => r.toLowerCase() === name.toLowerCase())) {
            registeredRunners.push(name);
            set(ref(db, 'runners'), registeredRunners); // Envoi direct vers Firebase
            input.value = '';
        } else if (name) {
            input.value = ''; 
        }
    }
    const btnAddGlobalRunner = document.getElementById('btn-add-global-runner');
    if (btnAddGlobalRunner) btnAddGlobalRunner.addEventListener('click', addGlobalRunner);
    
    const inputGlobalRunner = document.getElementById('new-runner-name');
    if (inputGlobalRunner) {
        inputGlobalRunner.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); 
                addGlobalRunner();
            }
        });
    }

    const globalRunnersList = document.getElementById('global-runners-list');
    if (globalRunnersList) {
        globalRunnersList.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-global-runner')) {
                const index = e.target.getAttribute('data-index');
                registeredRunners.splice(index, 1);
                set(ref(db, 'runners'), registeredRunners); // Mise à jour Firebase
            }
        });
    }

    // --- Ajout Rapide de Coureur ---
    function handleQuickAddRunner() {
        const input = document.getElementById('quick-add-runner');
        if (!input) return;
        const name = input.value.trim();
        
        if (name) {
            const existingRunner = registeredRunners.find(r => r.toLowerCase() === name.toLowerCase());
            const finalName = existingRunner || name;

            if (!existingRunner) {
                registeredRunners.push(finalName);
                set(ref(db, 'runners'), registeredRunners); // Envoi direct vers Firebase
            }

            if (!currentParticipants.includes(finalName)) {
                currentParticipants.push(finalName);
            }
            
            input.value = '';
            renderSelectableRunners();
        }
    }
    const btnQuickAdd = document.getElementById('btn-quick-add');
    if (btnQuickAdd) btnQuickAdd.addEventListener('click', handleQuickAddRunner);

    const quickAddInput = document.getElementById('quick-add-runner');
    if (quickAddInput) {
        quickAddInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); 
                handleQuickAddRunner();
            }
        });
    }

    // --- Formulaire : Enregistrer la Course (Sauvegarde sur Firebase) ---
    const runForm = document.getElementById('run-form');
    const submitBtn = document.getElementById('submit-btn');

    if (runForm && submitBtn) {
        submitBtn.addEventListener('click', () => {
            if (!runForm.checkValidity()) {
                runForm.reportValidity();
                return;
            }
            
            const dateInput = document.getElementById('run-date').value;
            const distanceEl = document.getElementById('run-distance');
            const distanceInput = distanceEl ? parseFloat(distanceEl.value) : 0;
            
            const hoursEl = document.getElementById('run-hours');
            const minutesEl = document.getElementById('run-minutes');
            const hoursValue = hoursEl ? parseInt(hoursEl.value) || 0 : 0;
            const minutesValue = minutesEl ? parseInt(minutesEl.value) || 0 : 0;
            const timeInput = (hoursValue * 60) + minutesValue;

            if (currentParticipants.length === 0) {
                alert('Veuillez sélectionner au moins un participant pour cette session.');
                return;
            }

            if (dateInput && distanceInput > 0 && timeInput > 0) {
                const newSession = {
                    id: Date.now(),
                    date: dateInput,
                    distance: distanceInput,
                    time: timeInput,
                    participants: [...currentParticipants]
                };

                sessions.push(newSession);
                set(ref(db, 'sessions'), sessions); // Envoi direct vers Firebase
                
                runForm.reset();
                if (hoursEl) hoursEl.value = "0";
                if (minutesEl) minutesEl.value = "30";

                currentParticipants = [];
                
                const leaderboardBtn = document.querySelector('[data-target="view-leaderboard"]');
                if (leaderboardBtn) leaderboardBtn.click();
            } else {
                alert('Veuillez entrer une distance et un temps valides.');
            }
        });
    }

    // --- Suppression d'une session ---
    const historyBody = document.getElementById('history-body');
    if (historyBody) {
        historyBody.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-session-btn');
            if (deleteBtn && isAdmin) {
                const id = parseInt(deleteBtn.getAttribute('data-id'));
                if (confirm('Êtes-vous sûr de vouloir supprimer cette session pour tout le groupe ?')) {
                    sessions = sessions.filter(s => s.id !== id);
                    set(ref(db, 'sessions'), sessions); // Mise à jour Firebase
                }
            }
        });
    }

    // =========================================================================
    // 5. INITIALISATION
    // =========================================================================
    const hoursSelect = document.getElementById('run-hours');
    const minutesSelect = document.getElementById('run-minutes');
    if (hoursSelect && minutesSelect) {
        for (let i = 0; i <= 24; i++) {
            let opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i.toString().padStart(2, '0');
            hoursSelect.appendChild(opt);
        }
        for (let i = 0; i <= 59; i++) {
            let opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i.toString().padStart(2, '0');
            minutesSelect.appendChild(opt);
        }
        hoursSelect.value = "0";
        minutesSelect.value = "30";
    }

    const runDateInput = document.getElementById('run-date');
    if (runDateInput) runDateInput.valueAsDate = new Date();
    
    updateAdminUI(); 
});