const API_URL = 'https://script.google.com/macros/s/AKfycbx002vezB-aD9o-czvnMURfqtCwP4l8rUCffrngZbT38ZSX8QZHvS3UF0n796UTYFoA/exec';
const ADMIN_PASSWORD = '1';

const state = {
    theme: 'light', currentTerm: null,
    terms: [], members: [], projects: [],
    evaluations: [], clubScores: [], deptScores: [],
    confessions: [], evidences: {},
    bugReports: [],
    activeProjectParticipantsSetup: [],
    scoreDeptFilter: 'ALL',
    evidenceDeptFilter: 'ALL',
    msDeptFilter: 'ALL',
    loginDeptFilter: 'ALL',
    pinDeptFilter: 'ALL',
    msSelectedIds: [],
    currentEvidenceMemberId: null,
    // Auth
    currentUser: null,
    userRole: 'guest',
    userPins: [],
    initialLoading: true
};

document.addEventListener('DOMContentLoaded', async () => {
    initTheme(); setupNavigation(); setupEvalTabs(); setupSearchableDropdowns();
    if (API_URL) { await loadDataFromAPI(); } else { seedMockData(); }
    initPhotobooth();
    initPinInputs();
    showLoginScreen();
});

function renderAllViews() {
    renderTerms(); renderMembers(); renderProjects();
    updateDashboardStats(); populateSelectDropdowns();
    renderEvidenceFolders();
    renderPinManagement();
    renderLoginMemberSelector();
}

async function loadDataFromAPI() {
    state.initialLoading = true;
    renderAllViews();
    
    const loader = document.getElementById('global-loader');
    if (loader) loader.style.display = 'flex';
    try {
        const r = await fetch(API_URL);
        const d = await r.json();
        if (d.status === 'success') {
            state.terms = d.terms || []; state.members = d.members || [];
            state.projects = d.projects || []; state.evaluations = d.evaluations || [];
            state.clubScores = d.clubScores || []; state.deptScores = d.deptScores || [];
            state.announcements = d.announcements || [];
            state.bugReports = d.bugReports || [];
            state.userPins = d.userPins || [];
            if (d.evidences) {
                d.evidences.forEach(ev => {
                    if (ev.memberId) {
                        state.evidences[ev.memberId] = { photos: [], newPhotos: [], label: ev.label || '', photoCount: ev.photoCount || 0 };
                    }
                });
            }
            if (d.evidenceImages) {
                d.evidenceImages.forEach(img => {
                    if (state.evidences[img.memberId]) {
                        state.evidences[img.memberId].photos.push(img.image);
                    }
                });
            }
            if (state.terms.length > 0) {
                state.currentTerm = state.terms[state.terms.length - 1].id;
                document.getElementById('active-term-label').innerText = state.terms[state.terms.length - 1].name;
            } else { document.getElementById('active-term-label').innerText = 'Kho dữ liệu TRỐNG'; }
        } else {
            console.error('API Error:', d.message);
        }
    } catch (e) {
        console.error('Network Error:', e.message);
    } finally {
        state.initialLoading = false;
        if (loader) loader.style.display = 'none';
        renderAllViews();
    }
}

function retryLoadData() {
    loadDataFromAPI();
}

async function syncToBackend(action, payload) {
    if (!API_URL) return;
    try {
        fetch(`${API_URL}?action=${action}`, { method: 'POST', body: JSON.stringify(payload) })
            .then(r => r.json()).then(res => console.log(`Sync (${action}):`, res))
            .catch(err => console.error(`Sync failed (${action}):`, err));
    } catch (e) { console.error(e); }
}

// THEME
function initTheme() {
    const btn = document.getElementById('theme-btn');
    btn.addEventListener('click', () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', state.theme);
        btn.innerHTML = state.theme === 'dark'
            ? '<i class="fa-solid fa-sun"></i> Chế độ Sáng'
            : '<i class="fa-solid fa-moon"></i> Chế độ Tối';
    });
}

// NAVIGATION
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            if (targetId === 'eval-view') calculateFinalScores();
            if (targetId === 'dashboard-view') updateDashboardStats();
            if (targetId === 'feedback-view') { renderFeedbacks(); renderConfessions(); }
            if (targetId === 'evidence-view') renderEvidenceFolders();
            if (targetId === 'photobooth-view') startCamera();
            if (targetId === 'bug-report-view') renderBugReports();
            if (targetId === 'pin-management-view') renderPinManagement();
            // Auto-close sidebar on mobile
            if (window.innerWidth <= 768) {
                closeMobileSidebar();
            }
        });
    });
}

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    sidebar.classList.toggle('mobile-open');
    backdrop.classList.toggle('active');
    document.body.classList.toggle('sidebar-open');
}

function closeMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    sidebar.classList.remove('mobile-open');
    backdrop.classList.remove('active');
    document.body.classList.remove('sidebar-open');
}

function setupEvalTabs() {
    document.querySelectorAll('.eval-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.eval-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.eval-pane').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.getAttribute('data-eval')).classList.add('active');
        });
    });
}

// MODALS
function openModal(id, extra) {
    document.getElementById(id).classList.add('active');
    if (id === 'project-modal') { state.activeProjectParticipantsSetup = []; renderParticipantList(); }
    if (id === 'announcement-modal') {
        const idField = document.getElementById('ann-id');
        // Chỉ reset nếu có extra (tức là mở từ nút Tạo mới, còn nếu truyền từ editAnnouncement thì không được gọi với extra là GLOBAL/DEPT bởi vì editAnnouncement mở trực tiếp không qua extra)
        if (extra) {
            if (idField) idField.value = '';
            document.getElementById('ann-title').value = '';
            document.getElementById('ann-content').value = '';
            document.getElementById('ann-type').value = extra;
            document.getElementById('ann-modal-title').innerText = extra === 'GLOBAL' ? 'Đăng Tin Toàn CLB' : 'Đăng Tin Ban';
            document.getElementById('ann-dept-group').style.display = extra === 'DEPT' ? 'block' : 'none';
            document.getElementById('ann-preview').style.display = 'flex';
            document.getElementById('ann-preview').innerHTML = `
                <div class="drop-circle" style="width:40px;height:40px;font-size:1rem;">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <div class="drop-text" style="flex-direction:row;align-items:center;gap:12px;">
                    <strong>Nhấn để tải ảnh</strong>
                </div>`;
        }
    }
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    const f = document.querySelector(`#${id} form`);
    if (f) f.reset();
}

// MOCK DATA
function seedMockData() {
    state.terms = [{ id: 'term_12', name: 'Nhiệm kỳ 12 (2024-2025)', bcn: { pres: 'Admin', vp: '', ld: '', rr: '', er: '', eb: '' } }];
    state.currentTerm = 'term_12';
    state.members = [
        { id: 'm1', name: 'Nguyễn Văn A', class: 'CQ60-HR', cohort: '12', dept: 'L&D', major: 'Quản trị NNL' },
        { id: 'm2', name: 'Trần Thị B', class: 'CQ60-MKT', cohort: '12', dept: 'ER', major: 'Marketing' },
        { id: 'm3', name: 'Lê Văn C', class: 'CQ61-KT', cohort: '12', dept: 'R&R', major: 'Kế toán' },
        { id: 'm4', name: 'Phạm Bình D', class: 'CQ61-HR', cohort: '12', dept: 'L&D', major: 'Quản trị NNL' },
        { id: 'm5', name: 'Hoàng Thái E', class: 'CQ61-MKT', cohort: '12', dept: 'EB', major: 'Truyền thông' },
    ];
    state.projects = [
        {
            id: 'p1', name: 'Teambuilding 2024', term: 'term_12', type: 'internal', status: 'finish', hasPL: true,
            participants: [{ memberId: 'm1', role: 'PL' }, { memberId: 'm2', role: 'CT' }, { memberId: 'm3', role: 'CT' }]
        },
        {
            id: 'p2', name: 'Job Fair 2025', term: 'term_12', type: 'event', status: 'running', hasPL: true,
            participants: [{ memberId: 'm2', role: 'TL' }, { memberId: 'm4', role: 'CT' }, { memberId: 'm5', role: 'SP' }]
        }
    ];
    document.getElementById('active-term-label').innerText = state.terms[0].name;
}

// SEARCHABLE DROPDOWNS
function setupSearchableDropdowns() {
    document.addEventListener('click', e => {
        if (!e.target.closest('.searchable-dropdown-container'))
            document.querySelectorAll('.searchable-dropdown').forEach(d => d.classList.remove('active'));
    });
    document.querySelectorAll('.searchable-input').forEach(inp => {
        inp.addEventListener('keyup', function () {
            const f = this.value.toLowerCase();
            this.nextElementSibling.querySelectorAll('li').forEach(li => {
                li.style.display = li.textContent.toLowerCase().includes(f) ? '' : 'none';
            });
        });
    });
}

function toggleDropdown(id) {
    document.querySelectorAll('.searchable-dropdown').forEach(d => { if (d.id !== id) d.classList.remove('active'); });
    document.getElementById(id).classList.toggle('active');
    if (document.getElementById(id).classList.contains('active'))
        document.getElementById(id).querySelector('input').focus();
}

function fillSearchableDropdown(listId, data, valKey, labelKey, fmtCb, hiddenId, btnId, cb) {
    const ul = document.getElementById(listId);
    if (!ul) return;
    ul.innerHTML = '';
    data.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = fmtCb ? fmtCb(item) : item[labelKey];
        li.dataset.val = item[valKey];
        li.dataset.label = fmtCb ? item[labelKey] : item[labelKey];
        li.onclick = () => {
            document.getElementById(hiddenId).value = li.dataset.val;
            document.getElementById(btnId).innerHTML = fmtCb ? fmtCb(item) : item[labelKey];
            document.getElementById(btnId).nextElementSibling.classList.remove('active');
            if (cb) cb(li.dataset.val);
        };
        ul.appendChild(li);
    });
}

function populateSelectDropdowns() {
    fillSearchableDropdown('list-club-member', state.members, 'id', 'name',
        m => `<strong>${m.name}</strong> - ${m.dept}`, 'eval-club-member', 'btn-club-member');
    fillSearchableDropdown('list-dept-member', state.members, 'id', 'name',
        m => `<strong>${m.name}</strong> - ${m.dept}`, 'eval-dept-member', 'btn-dept-member');
    const termProjects = state.projects.filter(p => p.term === state.currentTerm);
    fillSearchableDropdown('list-prj', termProjects, 'id', 'name',
        p => `<strong>${p.name}</strong>`, 'eval-prj-id', 'btn-prj', loadPrjMembersForEval);
    const fb = document.getElementById('filter-feedback-prj');
    let opts = '<option value="ALL">Toàn bộ Dự án</option>';
    termProjects.forEach(p => opts += `<option value="${p.id}">${p.name}</option>`);
    fb.innerHTML = opts;
}

// ==========================================
// MEMBERS MODULE
// ==========================================
function renderMembers() {
    const tbody = document.getElementById('members-tbody');
    const empty = document.getElementById('members-empty');
    const txt = document.getElementById('search-member').value.toLowerCase();
    const dept = document.getElementById('filter-dept').value;
    tbody.innerHTML = '';
    let filtered = state.members.filter(m =>
        m.name.toLowerCase().includes(txt) && (dept === 'ALL' || m.dept === dept));
    empty.style.display = filtered.length === 0 ? 'block' : 'none';
    filtered.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${m.name}</strong></td>
            <td><span class="version-badge">${m.dept}</span></td>
            <td>${m.cohort}</td><td>${m.class}</td><td>${m.major}</td>
            <td><div class="action-btns">
                <button class="btn-icon" onclick="openMemberDetail('${m.id}')" title="Chi tiết"><i class="fa-solid fa-eye"></i></button>
                <button class="btn-icon" onclick="editMember('${m.id}')" title="Sửa"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon delete" onclick="deleteMember('${m.id}')" title="Xóa"><i class="fa-solid fa-trash"></i></button>
            </div></td>`;
        tbody.appendChild(tr);
    });
}

function saveMember() {
    const id = document.getElementById('member-id').value;
    const m = {
        id: id || 'm_' + Date.now(),
        name: document.getElementById('m-name').value,
        class: document.getElementById('m-class').value,
        cohort: document.getElementById('m-cohort').value,
        major: document.getElementById('m-major').value,
        dept: document.getElementById('m-dept').value,
    };
    if (id) state.members = state.members.map(x => x.id === id ? m : x);
    else state.members.push(m);
    syncToBackend('save_member', m);
    closeModal('member-modal'); renderMembers(); populateSelectDropdowns(); renderEvidenceFolders();
}

function processBatchMembers() {
    const raw = document.getElementById('bm-data').value.trim();
    if (!raw) return alert('Vui lòng paste dữ liệu!');
    const defaultCohort = document.getElementById('bm-cohort').value.trim();
    const defaultClass = document.getElementById('bm-class').value.trim();
    const lines = raw.split('\n');
    let added = 0, dupes = [];
    lines.forEach((line, idx) => {
        if (!line.trim()) return;
        const cols = line.split('\t');
        let name = cols[0] ? cols[0].trim() : '';
        let dept = cols[1] ? cols[1].trim() : 'Chưa rõ';
        const up = dept.toUpperCase();
        if (up.includes('L&D') || up.includes('LD')) dept = 'L&D';
        else if (up.includes('R&R') || up.includes('RR')) dept = 'R&R';
        else if (up.includes('ER')) dept = 'ER';
        else if (up.includes('EB')) dept = 'EB';
        if (!name) return;
        // Duplicate check
        const isDupe = state.members.some(m => m.name.toLowerCase().trim() === name.toLowerCase().trim());
        if (isDupe) { dupes.push(name); return; }
        const m = { id: 'm_' + Date.now() + '_' + idx, name, class: defaultClass, cohort: defaultCohort, major: defaultClass, dept };
        state.members.push(m);
        syncToBackend('save_member', m);
        added++;
    });
    let msg = '';
    if (added > 0) msg += `✅ Đã thêm ${added} thành viên.\n`;
    if (dupes.length > 0) msg += `⚠️ ${dupes.length} tên BỊ BỎ QUA vì đã tồn tại:\n${dupes.join(', ')}`;
    if (added === 0 && dupes.length === 0) return alert('Không phân tích được dữ liệu hợp lệ.');
    alert(msg);
    if (added > 0) {
        document.getElementById('bm-data').value = '';
        closeModal('batch-member-modal');
        renderMembers(); populateSelectDropdowns(); renderEvidenceFolders();
    }
}

function editMember(id) {
    const m = state.members.find(x => x.id === id);
    if (!m) return;
    document.getElementById('member-id').value = m.id;
    document.getElementById('m-name').value = m.name;
    document.getElementById('m-class').value = m.class;
    document.getElementById('m-cohort').value = m.cohort;
    document.getElementById('m-major').value = m.major;
    document.getElementById('m-dept').value = m.dept;
    openModal('member-modal');
}

function deleteMember(id) {
    if (confirm('Chắc chắn xoá?')) {
        state.members = state.members.filter(x => x.id !== id);
        renderMembers(); populateSelectDropdowns(); renderEvidenceFolders();
    }
}

function openMemberDetail(mId) {
    const m = state.members.find(x => x.id === mId);
    if (!m) return;
    document.getElementById('md-name').innerText = m.name;
    document.getElementById('md-dept').innerText = 'Ban ' + m.dept;
    document.getElementById('md-cohort').innerText = m.cohort;
    document.getElementById('md-class').innerText = m.class;
    document.getElementById('md-major').innerText = m.major;
    const tbody = document.getElementById('md-projects-tbody');
    tbody.innerHTML = '';
    let joined = 0;
    state.projects.filter(p => p.term === state.currentTerm).forEach(p => {
        const px = p.participants.find(x => x.memberId === mId);
        if (px) {
            joined++;
            tbody.innerHTML += `<tr><td><strong>${p.name}</strong></td><td>${p.type === 'internal' ? '2.3 Nội bộ' : '2.2 Sự kiện'}</td><td>${px.role}</td></tr>`;
        }
    });
    if (joined === 0) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">Chưa tham gia CT nào</td></tr>';
    openModal('member-detail-modal');
}

// ==========================================
// PROJECTS MODULE
// ==========================================
function renderProjects() {
    const grid = document.getElementById('projects-grid');
    const empty = document.getElementById('projects-empty');
    const txt = document.getElementById('search-project').value.toLowerCase();
    grid.innerHTML = '';
    const list = state.projects.filter(p => p.term === state.currentTerm && p.name.toLowerCase().includes(txt));
    if (list.length === 0) { empty.style.display = 'flex'; return; }
    empty.style.display = 'none';
    list.forEach(p => {
        const isInt = p.type === 'internal';
        const typeLabel = isInt ? 'Nội bộ' : 'Sự kiện CLB';
        const typeBadge = isInt ? 'badge-internal' : 'badge-event';
        const statusMap = { setup: ['badge-setup', '⚙️ Setup'], running: ['badge-running', '🟢 Running'], finish: ['badge-finish', '✅ Finish'] };
        const [sCls, sLbl] = statusMap[p.status || 'setup'] || statusMap['setup'];
        const div = document.createElement('div');
        div.className = 'project-card';
        div.innerHTML = `
            <div class="project-header">
                <h3>${p.name}</h3>
                <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
                    <span class="project-type-badge ${typeBadge}">${typeLabel}</span>
                    <span class="project-type-badge ${sCls}">${sLbl}</span>
                </div>
            </div>
            <div class="project-stats">
                <span><i class="fa-solid fa-users"></i> ${p.participants.length} nhân sự</span>
                <span><i class="fa-solid fa-sitemap"></i> ${p.hasPL ? 'Có PL' : 'Không PL'}</span>
            </div>
            <div style="display:flex;justify-content:flex-end;">
                <button class="btn-secondary btn-sm" onclick="editProject('${p.id}')">Quản lý NS</button>
                <button class="btn-icon delete" style="margin-left:8px;" onclick="deleteProject('${p.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        grid.appendChild(div);
    });
}

function renderParticipantList() {
    const ul = document.getElementById('p-participant-list');
    ul.innerHTML = '';
    state.activeProjectParticipantsSetup.forEach(p => {
        const name = p.name || state.members.find(m => m.id === p.memberId)?.name || 'Unknown';
        ul.innerHTML += `
            <li class="participant-row">
                <span><strong>${name}</strong> — ${p.role}</span>
                <button type="button" class="btn-icon delete" onclick="removeParticipant('${p.memberId}')"><i class="fa-solid fa-xmark"></i></button>
            </li>`;
    });
}

function removeParticipant(mId) {
    state.activeProjectParticipantsSetup = state.activeProjectParticipantsSetup.filter(x => x.memberId !== mId);
    renderParticipantList();
}

function saveProject() {
    const id = document.getElementById('p-id').value;
    const p = {
        id: id || 'p_' + Date.now(),
        name: document.getElementById('p-name').value,
        term: document.getElementById('p-term').value,
        type: document.getElementById('p-type').value,
        status: document.getElementById('p-status').value,
        hasPL: document.getElementById('p-has-pl').checked,
        participants: [...state.activeProjectParticipantsSetup]
    };
    if (id) state.projects = state.projects.map(x => x.id === id ? p : x);
    else state.projects.push(p);
    syncToBackend('save_project', p);
    closeModal('project-modal'); renderProjects(); updateDashboardStats(); populateSelectDropdowns();
}

function editProject(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) return;
    document.getElementById('p-id').value = p.id;
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-term').value = p.term;
    document.getElementById('p-type').value = p.type;
    document.getElementById('p-status').value = p.status || 'setup';
    document.getElementById('p-has-pl').checked = p.hasPL;
    state.activeProjectParticipantsSetup = JSON.parse(JSON.stringify(p.participants));
    openModal('project-modal');
    renderParticipantList();

    // Specific logic for user role in projects
    if (state.userRole === 'user') {
        document.querySelectorAll('#p-participant-list .btn-icon.delete').forEach(btn => btn.style.display = 'none');
    }
}

function deleteProject(id) {
    if (confirm('Chắc chắn xoá?')) {
        state.projects = state.projects.filter(x => x.id !== id);
        renderProjects(); updateDashboardStats(); populateSelectDropdowns();
    }
}

// ==========================================
// TERMS MODULE
// ==========================================
function renderTerms() {
    const list = document.getElementById('terms-list');
    list.innerHTML = '';
    state.terms.forEach(t => {
        const isActive = t.id === state.currentTerm;
        list.innerHTML += `
            <div class="term-item">
                <div class="term-info">
                    <h4>${t.name}</h4>
                    <p>Chủ nhiệm: <strong>${t.bcn?.pres || '...'}</strong> | Phó CN: <strong>${t.bcn?.vp || '...'}</strong></p>
                </div>
                <div>
                    ${isActive ? '<span class="badge-active">Đang hoạt động</span>' : `<button class="btn-secondary btn-sm" onclick="setActiveTerm('${t.id}')">Chọn làm hiện tại</button>`}
                    <button class="btn-icon" onclick="editTerm('${t.id}')"><i class="fa-solid fa-pen"></i></button>
                </div>
            </div>`;
    });
    let opts = '';
    state.terms.forEach(t => opts += `<option value="${t.id}">${t.name}</option>`);
    document.getElementById('p-term').innerHTML = opts;
}

function setActiveTerm(id) {
    state.currentTerm = id;
    const t = state.terms.find(x => x.id === id);
    document.getElementById('active-term-label').innerText = t.name;
    renderTerms(); renderProjects(); updateDashboardStats(); populateSelectDropdowns();
}

function editTerm(id) {
    const t = state.terms.find(x => x.id === id);
    if (!t) return;
    document.getElementById('t-id').value = t.id;
    document.getElementById('t-name').value = t.name;
    document.getElementById('t-bcn-president').value = t.bcn?.pres || '';
    document.getElementById('t-bcn-vp').value = t.bcn?.vp || '';
    document.getElementById('t-head-ld').value = t.bcn?.ld || '';
    document.getElementById('t-head-rr').value = t.bcn?.rr || '';
    document.getElementById('t-head-er').value = t.bcn?.er || '';
    document.getElementById('t-head-eb').value = t.bcn?.eb || '';
    openModal('term-modal');
}

function saveTerm() {
    const id = document.getElementById('t-id').value;
    const t = {
        id: id || 't_' + Date.now(),
        name: document.getElementById('t-name').value,
        bcn: {
            pres: document.getElementById('t-bcn-president').value,
            vp: document.getElementById('t-bcn-vp').value,
            ld: document.getElementById('t-head-ld').value,
            rr: document.getElementById('t-head-rr').value,
            er: document.getElementById('t-head-er').value,
            eb: document.getElementById('t-head-eb').value
        }
    };
    if (id) state.terms = state.terms.map(x => x.id === id ? t : x);
    else state.terms.push(t);
    syncToBackend('save_term', t);
    closeModal('term-modal'); renderTerms();
}

// ==========================================
// DASHBOARD & ANNOUNCEMENTS
// ==========================================
let currentAnnDeptFilter = 'ALL';

function updateDashboardStats() {
    document.getElementById('stat-total-members').innerText = state.members.length;
    document.getElementById('stat-total-projects').innerText = state.projects.filter(p => p.term === state.currentTerm).length;
    document.getElementById('stat-evaluated').innerText = state.evaluations.filter(e => e.term === state.currentTerm).length;
    renderAnnouncements();
}

function renderAnnouncements() {
    const gList = document.getElementById('global-announcements-list');
    const dList = document.getElementById('dept-announcements-list');
    if (!gList || !dList) return;

    const globalAnns = (state.announcements || []).filter(a => a.type === 'GLOBAL').reverse();
    const deptAnns = (state.announcements || []).filter(a => a.type === 'DEPT' && (currentAnnDeptFilter === 'ALL' || a.dept === currentAnnDeptFilter)).reverse();

    gList.innerHTML = globalAnns.length ? globalAnns.map(a => renderAnnCard(a)).join('') : '<div class="empty-mini">Chưa có thông báo toàn CLB.</div>';
    dList.innerHTML = deptAnns.length ? deptAnns.map(a => renderAnnCard(a)).join('') : '<div class="empty-mini">Chưa có thông báo ban này.</div>';
}

function renderAnnCard(ann) {
    const date = new Date(ann._timestamp || Date.now()).toLocaleDateString('vi-VN');
    const isDept = ann.type === 'DEPT';
    const imgHtml = ann.image ? `<img src="${ann.image}" class="ann-card-image" alt="Announcement Image">` : '';
    return `
        <div class="announcement-card prio-${ann.priority}">
            ${imgHtml}
            <h4 style="color:var(--primary);">${ann.title}</h4>
            <p>${ann.content}</p>
            <div class="ann-card-footer">
                <span class="ann-dept-tag"><i class="fa-solid fa-building-user"></i> ${ann.dept || 'Toàn CLB'}</span>
                <span class="ann-date-tag"><i class="fa-solid fa-clock"></i> ${date}</span>
                <div class="action-btns" style="margin-left:auto; display:flex; gap:8px;">
                     <button class="btn-icon" onclick="editAnnouncement('${ann.id}')" title="Sửa"><i class="fa-solid fa-pen"></i></button>
                     <button class="btn-icon delete" onclick="deleteAnnouncement('${ann.id}')" title="Xóa"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>
    `;
}

function filterDeptAnn(dept) {
    currentAnnDeptFilter = dept;
    document.querySelectorAll('.dept-pills .pill').forEach(p => {
        p.classList.toggle('active', p.innerText.includes(dept) || (dept === 'ALL' && p.innerText === 'Tất cả'));
    });
    renderAnnouncements();
}

async function saveAnnouncement() {
    const hiddenId = document.getElementById('ann-id') ? document.getElementById('ann-id').value : '';
    const title = document.getElementById('ann-title').value;
    const content = document.getElementById('ann-content').value;
    const imgPreview = document.querySelector('#ann-preview img');
    const imageBase64 = imgPreview ? imgPreview.src : null;

    if (!title || !content) return alert('Vui lòng nhập đủ tiêu đề và nội dung');

    const ann = {
        id: hiddenId || 'ann_' + Date.now(),
        type: document.getElementById('ann-type').value,
        title: title,
        content: content,
        image: imageBase64,
        dept: document.getElementById('ann-dept-select').value,
        priority: document.getElementById('ann-priority').value,
        term: state.currentTerm
    };

    if (!state.announcements) state.announcements = [];

    if (hiddenId) {
        // Tìm và sửa
        state.announcements = state.announcements.map(x => x.id === hiddenId ? { ...ann, _timestamp: x._timestamp } : x);
        syncToBackend('save_announcement', ann);
    } else {
        // Thêm mới
        const newAnn = { ...ann, _timestamp: new Date().toISOString() };
        state.announcements.push(newAnn);
        syncToBackend('save_announcement', newAnn);
    }

    closeModal('announcement-modal');
    renderAnnouncements();

    // Reset preview
    document.getElementById('ann-preview').style.display = 'flex';
    document.getElementById('ann-preview').innerHTML = `
        <div class="drop-circle" style="width:40px;height:40px;font-size:1rem;">
            <i class="fa-solid fa-cloud-arrow-up"></i>
        </div>
        <div class="drop-text" style="flex-direction:row;align-items:center;gap:12px;">
            <strong>Nhấn để tải ảnh</strong>
        </div>`;
    document.getElementById('ann-image-input').value = '';
}

function editAnnouncement(id) {
    const ann = (state.announcements || []).find(x => x.id === id);
    if (!ann) return;
    document.getElementById('ann-id').value = ann.id;
    document.getElementById('ann-type').value = ann.type;
    document.getElementById('ann-title').value = ann.title;
    document.getElementById('ann-content').value = ann.content;
    document.getElementById('ann-dept-select').value = ann.dept || 'L&D';
    document.getElementById('ann-priority').value = ann.priority || 'NORMAL';

    // Ảnh
    const preview = document.getElementById('ann-preview');
    if (ann.image) {
        preview.style.display = 'flex';
        preview.innerHTML = `
            <div class="preview-img-wrapper" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;">
                <img src="${ann.image}" style="max-height:80px; max-width:100%; border-radius:8px; object-fit:contain;">
                <button class="remove-img-btn" onclick="removeImagePreview('ann-preview', 'ann-image-input')">&times;</button>
            </div>`;
    } else {
        preview.style.display = 'flex';
        preview.innerHTML = `
            <div class="drop-circle" style="width:40px;height:40px;font-size:1rem;">
                <i class="fa-solid fa-cloud-arrow-up"></i>
            </div>
            <div class="drop-text" style="flex-direction:row;align-items:center;gap:12px;">
                <strong>Nhấn để tải ảnh</strong>
            </div>`;
    }

    document.getElementById('ann-modal-title').innerText = ann.type === 'GLOBAL' ? 'Sửa Tin Toàn CLB' : 'Sửa Tin Ban';
    document.getElementById('ann-dept-group').style.display = ann.type === 'DEPT' ? 'block' : 'none';

    document.getElementById('announcement-modal').classList.add('active');
}

function deleteAnnouncement(id) {
    if (confirm('Chắc chắn xoá thông báo này?')) {
        state.announcements = state.announcements.filter(x => x.id !== id);
        syncToBackend('delete_announcement', { id: id });
        renderAnnouncements();
    }
}


// ==========================================
// SCORE FILTER
// ==========================================
function setScoreDeptFilter(btn, dept) {
    state.scoreDeptFilter = dept;
    document.querySelectorAll('[data-score-dept]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    calculateFinalScores();
}

// ==========================================
// EVALUATION ENGINE
// ==========================================
function avgArr(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, c) => a + c.score, 0) / arr.length;
}

function calculateMemberProjectScore(mId) {
    const termProjects = state.projects.filter(p => p.term === state.currentTerm);
    let total = 0, count = 0;
    termProjects.forEach(prj => {
        const pt = prj.participants.find(p => p.memberId === mId);
        if (!pt || pt.role === 'SP') return;
        const evals = state.evaluations.filter(e => e.prjId === prj.id && e.targetId === mId);
        if (evals.length === 0) return;
        const avg = avgArr(evals);
        if (avg > 0) { total += avg; count++; }
    });
    return count > 0 ? total / count : 0;
}

function calculateMemberClubScore(mId) {
    let disc = 10;
    const ce = state.clubScores.find(x => x.memberId === mId && x.term === state.currentTerm);
    if (ce) disc += ce.disciplinePoints;
    disc = Math.max(0, Math.min(10, disc));
    const termProjects = state.projects.filter(p => p.term === state.currentTerm);
    let evCt = 0, evSp = 0, inCt = 0;
    termProjects.forEach(prj => {
        const pt = prj.participants.find(p => p.memberId === mId);
        if (!pt) return;
        if (prj.type === 'event') { if (pt.role === 'SP') evSp++; else evCt++; }
        else if (prj.type === 'internal') inCt++;
    });
    function mapE(c) { if (c >= 3) return 10; if (c === 2) return 9; if (c === 1) return 8; return 6; }
    function mapI(c) { if (c >= 3) return 10; if (c === 2) return 9; if (c === 1) return 8; return 7; }
    const evScore = Math.max(mapE(evCt), mapE(evSp));
    const inScore = mapI(inCt);
    const brand = ce ? ce.brandScore : 7;
    return disc * 0.3 + evScore * 0.3 + inScore * 0.2 + brand * 0.2;
}

function calculateFinalScores() {
    const tbody = document.getElementById('score-tbody');
    tbody.innerHTML = '';
    const searchTxt = (document.getElementById('search-score') ? document.getElementById('search-score').value : '').toLowerCase();
    const dFilter = state.scoreDeptFilter;
    const filtered = state.members.filter(m =>
        m.name.toLowerCase().includes(searchTxt) && (dFilter === 'ALL' || m.dept === dFilter));
    filtered.forEach(member => {
        const mId = member.id;
        const prjScore = calculateMemberProjectScore(mId);
        const clubScore = calculateMemberClubScore(mId);
        const de = state.deptScores.find(x => x.memberId === mId && x.term === state.currentTerm);
        const deptScore = de ? de.totalScore : 0;
        const total = (prjScore + clubScore + deptScore) / 3;
        let grade = 'Can co gang';
        let gradeVi = 'Cần Cố Gắng';
        if (total >= 8.5) { grade = 'Xuat Sac'; gradeVi = 'Xuất Sắc'; }
        else if (total >= 7) { grade = 'Kha'; gradeVi = 'Khá'; }
        else if (total >= 5) { grade = 'Dat'; gradeVi = 'Đạt'; }
        const gradeColors = { 'Xuat Sac': '#f59e0b', 'Kha': '#10b981', 'Dat': '#0D8ABC', 'Can co gang': '#ef4444' };
        const gc = gradeColors[grade] || '#ef4444';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${member.name}</strong><br><span style="font-size:0.75rem;color:#94a3b8">Ban ${member.dept} - ${member.class}</span></td>
            <td><span style="color:#38bdf8;font-weight:700">${prjScore.toFixed(2)}</span></td>
            <td><span style="color:#10b981;font-weight:700">${clubScore.toFixed(2)}</span></td>
            <td><span style="color:#f59e0b;font-weight:700">${deptScore.toFixed(2)}</span></td>
            <td><strong style="font-size:1.2rem;color:var(--primary)">${total.toFixed(2)}</strong></td>
            <td><span style="background:${gc}22;color:${gc};border:1px solid ${gc}44;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:700">${gradeVi}</span></td>
            <td><button class="btn-secondary btn-sm" onclick="showScoreDetail('${mId}')"><i class="fa-solid fa-list-ul"></i> Chi tiết</button></td>`;
        tbody.appendChild(tr);
    });
}

// ==========================================
// SCORE DETAIL MODAL
// ==========================================
function showScoreDetail(mId) {
    const member = state.members.find(m => m.id === mId);
    if (!member) return;
    document.getElementById('score-detail-title').innerText = 'Chi tiet diem: ' + member.name;
    const prjScore = calculateMemberProjectScore(mId);
    const clubScore = calculateMemberClubScore(mId);
    const de = state.deptScores.find(x => x.memberId === mId && x.term === state.currentTerm);
    const deptScore = de ? de.totalScore : 0;
    const total = ((prjScore + clubScore + deptScore) / 3).toFixed(2);
    const termProjects = state.projects.filter(p => p.term === state.currentTerm);

    // Project rows
    let prjRows = '';
    termProjects.forEach(prj => {
        const pt = prj.participants.find(p => p.memberId === mId);
        if (!pt || pt.role === 'SP') return;
        const evals = state.evaluations.filter(e => e.prjId === prj.id && e.targetId === mId);
        if (evals.length === 0) {
            prjRows += `<tr><td><strong>${prj.name}</strong></td><td>${pt.role}</td><td colspan="9" style="color:#94a3b8">Chua co danh gia</td></tr>`;
            return;
        }
        const avg = n => (evals.reduce((s, e) => s + (e[n] || 0), 0) / evals.length).toFixed(1);
        const sc = (evals.reduce((s, e) => s + (e.score || 0), 0) / evals.length).toFixed(2);
        prjRows += `<tr><td><strong>${prj.name}</strong></td><td>${pt.role}</td><td>${evals.length}</td>
            <td>${avg('c1')}</td><td>${avg('c2')}</td><td>${avg('c3')}</td><td>${avg('c4')}</td><td>${avg('c5')}</td><td>${avg('c6')}</td><td>${avg('c7')}</td>
            <td><strong style="color:#38bdf8">${sc}</strong></td></tr>`;
    });

    // Club details
    const ce = state.clubScores.find(x => x.memberId === mId && x.term === state.currentTerm);
    let disc = 10 + (ce ? ce.disciplinePoints : 0);
    disc = Math.max(0, Math.min(10, disc));
    let evCt = 0, evSp = 0, inCt = 0;
    termProjects.forEach(prj => {
        const pt = prj.participants.find(p => p.memberId === mId);
        if (!pt) return;
        if (prj.type === 'event') { if (pt.role === 'SP') evSp++; else evCt++; }
        else if (prj.type === 'internal') inCt++;
    });
    const mapE2 = c => c >= 3 ? 10 : c === 2 ? 9 : c === 1 ? 8 : 6;
    const mapI2 = c => c >= 3 ? 10 : c === 2 ? 9 : c === 1 ? 8 : 7;
    const evScore = Math.max(mapE2(evCt), mapE2(evSp));
    const inScore = mapI2(inCt);
    const brand = ce ? ce.brandScore : 7;
    const reasons = (ce && ce.reasons && ce.reasons.length > 0)
        ? ce.reasons.map(r => `<span style="display:inline-block;background:#1e293b;padding:2px 8px;border-radius:6px;font-size:0.78rem;margin:2px">${r}</span>`).join('')
        : '<i style="color:#94a3b8">Khong co ghi chu</i>';

    // Dept details
    const deptCri = de && de.criteria ? de.criteria : null;
    let deptRows = '';
    if (deptCri) {
        const criArr = [
            ['Tinh than trach nhiem (x0.1)', deptCri.rule, 0.1],
            ['Quan he TB/PB (x0.1)', deptCri.hRel, 0.1],
            ['Quan he TV ban (x0.1)', deptCri.mRel, 0.1],
            ['Ho tro team khac (x0.2)', deptCri.sup, 0.2],
            ['CV Teambuilding (x0.1)', deptCri.q1, 0.1],
            ['CV Trung thu (x0.2)', deptCri.q2, 0.2],
            ['CV Tuyen CTV (x0.2)', deptCri.q3, 0.2]
        ];
        deptRows = criArr.map(([lbl, val, w]) => `<tr><td>${lbl}</td><td>${val || 0}/10</td><td>${((val || 0) * w).toFixed(2)}</td></tr>`).join('');
        if (deptCri.bonus) deptRows += `<tr><td>Diem cong dong gop</td><td>+${deptCri.bonus}</td><td>${deptCri.bonus}</td></tr>`;
    } else {
        deptRows = `<tr><td colspan="3" style="color:#94a3b8">Chua nhap diem Ban. Tam tinh: ${deptScore.toFixed(2)}</td></tr>`;
    }

    document.getElementById('score-detail-body').innerHTML = `
        <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
            <button id="btn-download-pdf" class="btn-lux" style="background: linear-gradient(135deg, #dca306 0%, #f59e0b 100%); color: white; border: none; padding: 10px 24px; font-weight: 600; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 10px rgba(220,163,6,0.3);" onclick="downloadPDF('${mId}')">
                <i class="fa-solid fa-file-pdf"></i> Tải báo cáo PDF
            </button>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 24px; align-items: stretch;">
            <div style="flex: 1 1 250px; text-align:center; padding:20px; background:rgba(13,138,188,0.06); border-radius:16px; border:1px solid rgba(13,138,188,0.2); display: flex; flex-direction: column; justify-content: center;">
                <div style="font-size:3rem;font-weight:900;color:#38bdf8">${total}</div>
                <p style="color:#94a3b8;margin-top:4px">Tổng Điểm = (Điểm Project + Điểm CLB + Điểm Ban) / 3</p>
                <div style="display:flex;justify-content:center;gap:32px;margin-top:16px">
                    <div><div style="font-size:1.4rem;font-weight:700;color:#38bdf8">${prjScore.toFixed(2)}</div><div style="font-size:0.78rem;color:#94a3b8">Project</div></div>
                    <div><div style="font-size:1.4rem;font-weight:700;color:#10b981">${clubScore.toFixed(2)}</div><div style="font-size:0.78rem;color:#94a3b8">CLB</div></div>
                    <div><div style="font-size:1.4rem;font-weight:700;color:#f59e0b">${deptScore.toFixed(2)}</div><div style="font-size:0.78rem;color:#94a3b8">Ban</div></div>
                </div>
            </div>
            <div style="flex: 1 1 300px; background: white; padding: 24px; border-radius: 24px; border: 1px solid #e2e8f0; display: flex; justify-content: center; align-items: center; min-height: 280px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
                <canvas id="member-radar-chart" style="max-height: 260px; width: 100%;"></canvas>
            </div>
        </div>
        <div class="score-detail-section">
            <h4>3. Điểm Project: ${prjScore.toFixed(2)}/10</h4>
            <div style="overflow-x:auto"><table class="score-detail-table">
                <thead><tr><th>Du an</th><th>Role</th><th>So DG</th><th>C1</th><th>C2</th><th>C3</th><th>C4</th><th>C5</th><th>C6</th><th>C7</th><th>TB</th></tr></thead>
                <tbody>${prjRows || '<tr><td colspan="11" style="color:#94a3b8;text-align:center">Chua tham gia project nao</td></tr>'}</tbody>
            </table></div>
            <div class="score-formula-box">C1=Nhiet tinh • C2=Trach nhiem • C3=Tu duy • C4=Chuyen mon • C5=Hoc hoi • C6=Hoan thanh • C7=Quan he<br>Diem = TB cac tieu chi / TB cac project tham gia</div>
        </div>
        <div class="score-detail-section">
            <h4>2. Điểm CLB: ${clubScore.toFixed(2)}/10</h4>
            <table class="score-detail-table">
                <thead><tr><th>Tieu chi</th><th>Gia tri</th><th>Trong so</th><th>Thanh phan</th></tr></thead>
                <tbody>
                    <tr><td>2.1 Ky luat (Base 10 + ${ce ? ce.disciplinePoints : 0})</td><td>${disc}/10</td><td>x0.3</td><td>${(disc * 0.3).toFixed(2)}</td></tr>
                    <tr><td>2.2 Su kien (TC: ${evCt}, HT: ${evSp})</td><td>${evScore}/10</td><td>x0.3</td><td>${(evScore * 0.3).toFixed(2)}</td></tr>
                    <tr><td>2.3 Noi bo (${inCt} CT)</td><td>${inScore}/10</td><td>x0.2</td><td>${(inScore * 0.2).toFixed(2)}</td></tr>
                    <tr><td>2.4 Hinh anh CLB</td><td>${brand}/10</td><td>x0.2</td><td>${(brand * 0.2).toFixed(2)}</td></tr>
                </tbody>
            </table>
            <div class="score-formula-box">Ly do ky luat: ${reasons}<br>Cong thuc: 0.3xKyLuat + 0.3xSuKien + 0.2xNoiBo + 0.2xHinhAnh = ${clubScore.toFixed(2)}</div>
        </div>
        <div class="score-detail-section">
            <h4>1. Điểm Ban: ${deptScore.toFixed(2)}/10</h4>
            <table class="score-detail-table">
                <thead><tr><th>Tieu chi</th><th>Diem nhap</th><th>Thanh phan</th></tr></thead>
                <tbody>${deptRows}</tbody>
            </table>
        </div>`;
    openModal('score-detail-modal');

    // Chart.js Radar Initialization
    setTimeout(() => {
        if (window.memberRadarChart) {
            window.memberRadarChart.destroy();
        }

        const ctx = document.getElementById('member-radar-chart');
        if (!ctx) return;

        // Tính toán các đỉnh Radar (Tham khảo các scale đã có)
        // 1. Dự án
        // 2. Kỷ luật (Trung bình CLB và Ban)
        const ruleScore = (disc + (deptCri ? deptCri.rule : 10)) / 2;
        // 3. Chuyên môn (Điểm các job chuyên môn từ Ban)
        const workScore = deptCri ? (deptCri.q1 + deptCri.q2 + deptCri.q3) / 3 : 0;
        // 4. HĐ CLB (Sự kiện + Nội bộ)
        const clubActScore = (evScore + inScore) / 2;
        // 5. Quan hệ & Đóng góp (Head rel + Mem rel + Support + Brand / 4)
        const relScore = (brand + (deptCri ? (deptCri.hRel + deptCri.mRel + deptCri.sup) / 3 : 10)) / 2;

        window.memberRadarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Dự án', 'Kỷ luật', 'Chuyên môn', 'HĐ CLB', 'Quan hệ'],
                datasets: [{
                    label: 'Điểm thành phần (Max 10)',
                    data: [
                        prjScore.toFixed(2),
                        ruleScore.toFixed(2),
                        workScore.toFixed(2),
                        clubActScore.toFixed(2),
                        relScore.toFixed(2)
                    ],
                    backgroundColor: 'rgba(56, 189, 248, 0.35)', // Fill màu xanh dương nhạt
                    borderColor: '#38bdf8', // Viền xanh dương sắc nét
                    pointBackgroundColor: '#38bdf8',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#ffffff',
                    pointHoverBorderColor: '#38bdf8',
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(0, 0, 0, 0.08)' }, // Đường chéo mờ
                        grid: { color: 'rgba(0, 0, 0, 0.08)' }, // Mạng nhện mờ
                        pointLabels: { color: '#64748b', font: { size: 13, family: "'Inter', sans-serif", weight: '600' } }, // Chữ label màu xám đậm dễ nhìn
                        ticks: {
                            display: false, // Ẩn nhãn ticks vì gây rác UI
                            min: 0,
                            max: 10,
                            stepSize: 2
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#0f172a',
                        bodyColor: '#38bdf8',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        padding: 12,
                        boxPadding: 4,
                        displayColors: false,
                        bodyFont: { weight: 'bold', size: 14 }
                    }
                }
            }
        });
    }, 50);
}

// ==========================================
// THÊM XUẤT BÁO CÁO PDF
// ==========================================
function downloadPDF(mId) {
    const member = state.members.find(m => m.id === mId);
    if (!member) return;

    const prjScore = calculateMemberProjectScore(mId);
    const clubScore = calculateMemberClubScore(mId);
    const de = state.deptScores.find(x => x.memberId === mId && x.term === state.currentTerm);
    const deptScore = de ? de.totalScore : 0;
    const total = ((prjScore + clubScore + deptScore) / 3).toFixed(2);

    // Get C1 -> C7 averages
    const evals = state.evaluations.filter(e => e.targetId === mId);
    let c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0, c6 = 0, c7 = 0;
    if (evals.length > 0) {
        c1 = evals.reduce((s, e) => s + (e.c1 || 0), 0) / evals.length;
        c2 = evals.reduce((s, e) => s + (e.c2 || 0), 0) / evals.length;
        c3 = evals.reduce((s, e) => s + (e.c3 || 0), 0) / evals.length;
        c4 = evals.reduce((s, e) => s + (e.c4 || 0), 0) / evals.length;
        c5 = evals.reduce((s, e) => s + (e.c5 || 0), 0) / evals.length;
        c6 = evals.reduce((s, e) => s + (e.c6 || 0), 0) / evals.length;
        c7 = evals.reduce((s, e) => s + (e.c7 || 0), 0) / evals.length;
    }

    // Club metrics
    const ce = state.clubScores.find(x => x.memberId === mId && x.term === state.currentTerm);
    let disc = 10 + (ce ? ce.disciplinePoints : 0);
    disc = Math.max(0, Math.min(10, disc));
    const termProjects = state.projects.filter(p => p.term === state.currentTerm);
    let evCt = 0, evSp = 0, inCt = 0;
    termProjects.forEach(prj => {
        const pt = prj.participants.find(p => p.memberId === mId);
        if (!pt) return;
        if (prj.type === 'event') { if (pt.role === 'SP') evSp++; else evCt++; }
        else if (prj.type === 'internal') inCt++;
    });
    const mapE2 = c => c >= 3 ? 10 : c === 2 ? 9 : c === 1 ? 8 : 6;
    const mapI2 = c => c >= 3 ? 10 : c === 2 ? 9 : c === 1 ? 8 : 7;
    const evScore = Math.max(mapE2(evCt), mapE2(evSp));
    const inScore = mapI2(inCt);
    const brand = ce ? ce.brandScore : 7;
    const reasons = (ce && ce.reasons && ce.reasons.length > 0) ? ce.reasons.join('<br>') : 'Không có nhận xét bổ sung.';

    const deptCri = de && de.criteria ? de.criteria : null;

    const container = document.getElementById('pdf-export-container');
    container.innerHTML = `
        <div id="pdf-content" style="padding: 24px; font-family: 'Arial', sans-serif; color: #000; background: #fff; line-height: 1.4;">
            <style>
                .pdf-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
                .pdf-table th, .pdf-table td { border: 2px solid #000; padding: 6px 10px; text-align: left; }
                .pdf-table th { background-color: #dca306; color: #fff; text-align: center; text-transform: uppercase; font-weight: bold; }
                .pdf-table .subheading td { background-color: #fef0c7; font-weight: bold; text-align: center; color: #000; text-transform: uppercase; }
                .text-center { text-align: center !important; }
                .text-bold { font-weight: bold; }
                .text-red { color: #dc2626; font-weight: bold; }
                .row-avg { background-color: #fef0c7; }
                .pdf-header { text-align: center; margin-bottom: 20px; }
                .pdf-header h2 { margin: 0 0 10px 0; color: #dca306; text-transform: uppercase; font-size: 24px; }
            </style>
            
            <div class="pdf-header">
                <h2>Báo Cáo Đánh Giá Nhân Sự</h2>
            </div>
            
            <table style="width: 100%; border: none; margin-bottom: 20px;">
              <tr>
                <td style="width: 50%; vertical-align: top; border: none; padding-right: 12px; padding-left: 0; padding-top: 0; padding-bottom: 0;">
                   <table class="pdf-table" style="margin-bottom:0;">
                      <tr><th colspan="2">THÔNG TIN CÁ NHÂN</th></tr>
                      <tr><td class="text-bold" style="width:40%">Họ & Tên</td><td>${member.name}</td></tr>
                      <tr><td class="text-bold">Lớp - Khóa</td><td>${member.class || '-'} - Khóa ${member.cohort || '-'}</td></tr>
                      <tr><td class="text-bold">Chức danh</td><td>Thành viên</td></tr>
                      <tr><td class="text-bold">Ban hoạt động</td><td>${member.dept || '-'}</td></tr>
                   </table>
                </td>
                <td style="width: 50%; vertical-align: top; border: none; padding-left: 12px; padding-right: 0; padding-top: 0; padding-bottom: 0;">
                   <table class="pdf-table" style="margin-bottom:0;">
                      <tr><th>QUY ƯỚC ĐÁNH GIÁ</th></tr>
                      <tr><td class="text-center">Điểm được đánh giá trên thang điểm 10</td></tr>
                      <tr><td class="text-center">Điểm được làm tròn đến số thập phân thứ 2</td></tr>
                      <tr><td class="text-center">Mỗi chỉ tiêu đánh giá có trọng số tương ứng</td></tr>
                      <tr><td class="text-center">Công tác đánh giá dựa trên nguyên tắc công bằng và khách quan</td></tr>
                   </table>
                </td>
              </tr>
            </table>

            <table class="pdf-table">
                <tr><th colspan="4">THAM GIA TỔ CHỨC PROJECT</th></tr>
                <tr class="subheading"><td style="width:25%">TIÊU CHÍ</td><td style="width:50%">CHỈ TIÊU</td><td style="width:12%">TRỌNG SỐ</td><td style="width:13%">KẾT QUẢ ĐÁNH GIÁ</td></tr>
                <tr><td rowspan="3" class="text-center text-bold">THÁI ĐỘ</td><td>Nhiệt tình, chủ động trong công việc</td><td class="text-center">0,15</td><td class="text-center">${c1.toFixed(2)}</td></tr>
                <tr><td>Trách nhiệm, kịp tiến độ, đúng deadline</td><td class="text-center">0,20</td><td class="text-center">${c2.toFixed(2)}</td></tr>
                <tr><td>Tư duy tích cực, đề xuất và tiếp thu ý kiến</td><td class="text-center">0,10</td><td class="text-center">${c3.toFixed(2)}</td></tr>
                <tr><td class="text-center text-bold">KỸ NĂNG LÀM VIỆC</td><td>Trình độ, chuyên môn phục vụ cho công việc</td><td class="text-center">0,10</td><td class="text-center">${c4.toFixed(2)}</td></tr>
                <tr><td rowspan="2" class="text-center text-bold">CHẤT LƯỢNG CÔNG VIỆC</td><td>Đầu tư nghiên cứu, học hỏi</td><td class="text-center">0,10</td><td class="text-center">${c5.toFixed(2)}</td></tr>
                <tr><td>Mức độ hoàn thành công việc</td><td class="text-center">0,20</td><td class="text-center">${c6.toFixed(2)}</td></tr>
                <tr><td class="text-center text-bold">MỐI QUAN HỆ TRONG PROJECT</td><td>Với Care/Leader, thành viên trong coreteam</td><td class="text-center">0,15</td><td class="text-center">${c7.toFixed(2)}</td></tr>
                <tr class="row-avg text-bold"><td colspan="3" class="text-center">ĐIỂM TRUNG BÌNH</td><td class="text-center text-red">${prjScore.toFixed(2)}</td></tr>
            </table>

            <table class="pdf-table">
                <tr><th colspan="4">HOẠT ĐỘNG TRONG CLB</th></tr>
                <tr class="subheading"><td style="width:25%">TIÊU CHÍ</td><td style="width:50%">CHỈ TIÊU</td><td style="width:12%">TRỌNG SỐ</td><td style="width:13%">BỘ PHẬN ĐÁNH GIÁ</td></tr>
                <tr><td class="text-center text-bold">TINH THẦN TRÁCH NHIỆM</td><td>Chấp hành kỷ luật, nội quy, văn hóa CLB</td><td class="text-center">0,3</td><td class="text-center">${disc.toFixed(2)}</td></tr>
                <tr><td rowspan="2" class="text-center text-bold">THAM GIA & HỖ TRỢ</t><td>Tổ chức, hỗ trợ các chương trình của CLB</td><td class="text-center">0,3</td><td class="text-center">${evScore.toFixed(2)}</td></tr>
                <tr><td>Tích cực tham gia chương trình nội bộ</td><td class="text-center">0,2</td><td class="text-center">${inScore.toFixed(2)}</td></tr>
                <tr><td class="text-center text-bold">PHÁT TRIỂN HÌNH ẢNH</td><td>Tuyên truyền, phát triển hình ảnh CLB</td><td class="text-center">0,2</td><td class="text-center">${brand.toFixed(2)}</td></tr>
                <tr><td class="text-center text-bold">MẶT KHÁC</td><td>Điều chỉnh điểm bổ sung</td><td class="text-center">Điểm cộng</td><td class="text-center">${ce && ce.disciplinePoints ? ce.disciplinePoints : 0}</td></tr>
                <tr class="row-avg text-bold"><td colspan="3" class="text-center">ĐIỂM TRUNG BÌNH</td><td class="text-center text-red">${clubScore.toFixed(2)}</td></tr>
            </table>

            <div style="page-break-before: always;"></div>

            <table class="pdf-table">
                <tr><th colspan="4">HOẠT ĐỘNG TRONG BAN</th></tr>
                <tr class="subheading"><td style="width:25%">TIÊU CHÍ</td><td style="width:50%">CHỈ TIÊU</td><td style="width:12%">TRỌNG SỐ</td><td style="width:13%">PHÓ/TRƯỞNG BAN ĐÁNH GIÁ</td></tr>
                <tr><td class="text-center text-bold">TINH THẦN KỶ LUẬT</td><td>Thực hiện nội quy bộ phận</td><td class="text-center">0,1</td><td class="text-center">${deptCri ? deptCri.rule : '-'}/10</td></tr>
                <tr><td rowspan="2" class="text-center text-bold">MỐI QUAN HỆ</td><td>Với trưởng/phó ban</td><td class="text-center">0,1</td><td class="text-center">${deptCri ? deptCri.hRel : '-'}/10</td></tr>
                <tr><td>Với thành viên/CTV ban</td><td class="text-center">0,1</td><td class="text-center">${deptCri ? deptCri.mRel : '-'}/10</td></tr>
                <tr><td class="text-center text-bold">HỖ TRỢ BAN</td><td>Tham gia đóng góp, hỗ trợ các hoạt động</td><td class="text-center">0,2</td><td class="text-center">${deptCri ? deptCri.sup : '-'}/10</td></tr>
                <tr><td rowspan="3" class="text-center text-bold">CHẤT LƯỢNG CÔNG VIỆC</td><td>Công việc chuyên môn 1 (Teambuilding)</td><td class="text-center">0,1</td><td class="text-center">${deptCri ? deptCri.q1 : '-'}/10</td></tr>
                <tr><td>Công việc chuyên môn 2</td><td class="text-center">0,2</td><td class="text-center">${deptCri ? deptCri.q2 : '-'}/10</td></tr>
                <tr><td>Công việc chuyên môn 3</td><td class="text-center">0,2</td><td class="text-center">${deptCri ? deptCri.q3 : '-'}/10</td></tr>
                <tr><td class="text-center text-bold">ĐÓNG GÓP PHÁT TRIỂN</td><td>Đóng góp ý kiến bổ ích cho sự phát triển</td><td class="text-center">Điểm cộng</td><td class="text-center">${deptCri ? deptCri.bonus : '-'}</td></tr>
                <tr class="row-avg text-bold"><td colspan="3" class="text-center">ĐIỂM TRUNG BÌNH</td><td class="text-center text-red">${deptScore.toFixed(2)}</td></tr>
            </table>

            <table class="pdf-table">
                <tr><th colspan="2">BẢNG ĐIỂM TỔNG HỢP</th></tr>
                <tr><td style="text-align:center; width: 87%;">Đánh giá Tham gia tổ chức Project</td><td style="width:13%" class="text-center">${prjScore.toFixed(2)}</td></tr>
                <tr><td style="text-align:center">Đánh giá Hoạt động trong CLB</td><td class="text-center">${clubScore.toFixed(2)}</td></tr>
                <tr><td style="text-align:center">Đánh giá Hoạt động trong Ban</td><td class="text-center">${deptScore.toFixed(2)}</td></tr>
                <tr class="row-avg text-bold"><td style="text-align:center">ĐIỂM TRUNG BÌNH (TỔNG KẾT)</td><td class="text-center text-red">${total}</td></tr>
            </table>

            <table class="pdf-table">
                <tr><th colspan="2">NHẬN XÉT MỘT SỐ VẤN ĐỀ TỪ CLB</th></tr>
                <tr>
                    <td style="width:25%; font-weight:bold; text-align:center; background-color: #fef0c7;">Ghi chú & Đánh giá Tóm tắt</td>
                    <td style="width:75%; min-height: 80px; padding: 10px; background-color: #fff9e6; line-height: 1.6;">
                       ${reasons}
                    </td>
                </tr>
            </table>
        </div>
    `;

    const btn = document.getElementById('btn-download-pdf');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Khởi tạo PDF...';

    const opt = {
        margin: 10,
        filename: `Bao_Cao_${member.name.replace(/ /g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    container.style.display = 'block';

    html2pdf().set(opt).from(document.getElementById('pdf-content')).save().then(() => {
        container.style.display = 'none';
        container.innerHTML = '';
        if (btn) btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Tải báo cáo PDF';
    }).catch(err => {
        alert('Lỗi tạo PDF: ' + err);
        container.style.display = 'none';
        if (btn) btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Tải báo cáo PDF';
    });
}


// ==========================================
// CLUB & DEPT EVAL
// ==========================================
function saveClubEval() {
    const mId = document.getElementById('eval-club-member').value;
    if (!mId) return alert('Hay chon thanh vien');
    const dScore = parseFloat(document.getElementById('club-discipline-score').value || 0);
    const dReason = document.getElementById('club-discipline-reason').value;
    const bScore = parseFloat(document.getElementById('club-brand-score').value || 7);
    let entry = state.clubScores.find(x => x.memberId === mId && x.term === state.currentTerm);
    if (!entry) {
        entry = { id: 'cs' + Date.now(), memberId: mId, term: state.currentTerm, disciplinePoints: 0, brandScore: 7, reasons: [] };
        state.clubScores.push(entry);
    }
    entry.disciplinePoints += dScore;
    if (dReason) entry.reasons.push((dScore >= 0 ? '+' : '') + dScore + ': ' + dReason);
    if (document.getElementById('club-brand-score').value) entry.brandScore = bScore;
    syncToBackend('save_score_club', entry);
    alert('Luu CLB thanh cong!');
    document.getElementById('club-discipline-score').value = '';
    document.getElementById('club-discipline-reason').value = '';
    document.getElementById('club-brand-score').value = '';
}

function saveDeptEval() {
    const mId = document.getElementById('eval-dept-member').value;
    if (!mId) return alert('Chua chon thanh vien');
    const rule = parseFloat(document.getElementById('dept-rule-score').value || 0);
    const hRel = parseFloat(document.getElementById('dept-head-rel').value || 0);
    const mRel = parseFloat(document.getElementById('dept-mem-rel').value || 0);
    const sup = parseFloat(document.getElementById('dept-support').value || 0);
    const q1 = parseFloat(document.getElementById('dept-q1').value || 0);
    const q2 = parseFloat(document.getElementById('dept-q2').value || 0);
    const q3 = parseFloat(document.getElementById('dept-q3').value || 0);
    const bonus = parseFloat(document.getElementById('dept-bonus').value || 0);
    let totalScore = 0.1 * (rule + hRel + mRel + q1) + 0.2 * (sup + q2 + q3) + bonus;
    if (totalScore > 10) totalScore = 10;
    state.deptScores = state.deptScores.filter(x => !(x.memberId === mId && x.term === state.currentTerm));
    const entry = { memberId: mId, term: state.currentTerm, totalScore, criteria: { rule, hRel, mRel, sup, q1, q2, q3, bonus } };
    state.deptScores.push(entry);
    syncToBackend('save_score_dept', entry);
    alert('Luu diem Ban: ' + totalScore.toFixed(2));
}

// ==========================================
// EXPORT EXCEL
// ==========================================
function exportToExcel() {
    let csv = 'data:text/csv;charset=utf-8,\uFEFF';
    csv += 'Họ & Tên,Ban,Lớp,Điểm Project,Điểm CLB,Điểm Ban,Tổng Điểm,Xếp Loại\n';
    state.members.forEach(m => {
        const p = calculateMemberProjectScore(m.id).toFixed(2);
        const c = calculateMemberClubScore(m.id).toFixed(2);
        const de = state.deptScores.find(x => x.memberId === m.id && x.term === state.currentTerm);
        const d = de ? de.totalScore.toFixed(2) : '0.00';
        const t = ((parseFloat(p) + parseFloat(c) + parseFloat(d)) / 3).toFixed(2);
        let g = 'Can co gang';
        if (t >= 8.5) g = 'Xuat Sac'; else if (t >= 7) g = 'Kha'; else if (t >= 5) g = 'Dat';
        csv += '"' + m.name + '","' + m.dept + '","' + m.class + '","' + p + '","' + c + '","' + d + '","' + t + '","' + g + '"\n';
    });
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = 'HuReA_BangDiem_' + state.currentTerm + '.csv';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ==========================================
// FEEDBACK (Anonymous - no sender identity)
// ==========================================
function switchFbTab(btn, paneId) {
    document.querySelectorAll('.fb-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.fb-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(paneId).classList.add('active');
    if (paneId === 'fb-pane-confession') renderConfessions();
    else renderFeedbacks();
}

function renderFeedbacks() {
    const grid = document.getElementById('feedback-grid');
    const empty = document.getElementById('feedback-empty');
    const filterPrj = document.getElementById('filter-feedback-prj').value;
    grid.innerHTML = '';
    let fbEvals = state.evaluations.filter(e => e.term === state.currentTerm && e.feedback && e.feedback.trim() !== '');
    if (filterPrj !== 'ALL') fbEvals = fbEvals.filter(e => e.prjId === filterPrj);
    if (fbEvals.length === 0) { empty.style.display = 'flex'; grid.style.display = 'none'; return; }
    empty.style.display = 'none';
    grid.style.display = 'grid';
    fbEvals.forEach(fb => {
        const prj = state.projects.find(p => p.id === fb.prjId);
        const prjName = prj ? prj.name : 'Du an an';
        // Feature 2: NO sender identity shown
        grid.innerHTML += `
            <div class="feedback-card">
                <div class="fb-header">
                    <span><i class="fa-solid fa-folder"></i> ${prjName}</span>
                    <span><i class="fa-solid fa-user-secret"></i> An danh</span>
                </div>
                <div class="fb-content">"${fb.feedback}"</div>
            </div>`;
    });
}

// ==========================================
// CONFESSION
// ==========================================
function submitConfession() {
    const txt = document.getElementById('confession-text').value.trim();
    if (!txt) return alert('Hay viet gi do truoc khi gui!');
    const c = { id: 'cf_' + Date.now(), text: txt, term: state.currentTerm, createdAt: new Date().toLocaleDateString('vi-VN') };
    state.confessions.push(c);
    syncToBackend('save_confession', c);
    document.getElementById('confession-text').value = '';
    renderConfessions();
    alert('Da gui Confession! Cam on ban da chia se.');
}

function renderConfessions() {
    const grid = document.getElementById('confession-grid');
    const empty = document.getElementById('confession-empty');
    grid.innerHTML = '';
    const list = state.confessions.filter(c => !c.term || c.term === state.currentTerm);
    if (list.length === 0) { empty.style.display = 'flex'; return; }
    empty.style.display = 'none';
    list.slice().reverse().forEach(c => {
        grid.innerHTML += `
            <div class="confession-card">
                <div class="confession-card-text">${c.text}</div>
                <div class="confession-card-meta">
                    <span>~ An danh</span>
                    <span>${c.createdAt || ''}</span>
                </div>
            </div>`;
    });
}

// ==========================================
// MEMBER SELECT MODAL (for project)
// ==========================================
let msStep = 1;

function openMemberSelectModal() {
    msStep = 1;
    state.msSelectedIds = state.activeProjectParticipantsSetup.map(p => p.memberId);
    state.msDeptFilter = 'ALL';
    document.getElementById('ms-step-1').style.display = 'block';
    document.getElementById('ms-step-2').style.display = 'none';
    document.getElementById('ms-back-btn').style.display = 'none';
    document.getElementById('ms-next-btn').innerText = 'Tiep theo';
    document.getElementById('ms-title').innerText = 'Chon Nhan Su Tham Gia';
    document.getElementById('ms-search').value = '';
    renderMsGrid();
    openModal('member-select-modal');
}

function setMsFilter(btn, dept) {
    state.msDeptFilter = dept;
    document.querySelectorAll('.ms-filter-bar .filter-quick-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderMsGrid();
}

function renderMsGrid() {
    const grid = document.getElementById('ms-member-grid');
    const search = document.getElementById('ms-search').value.toLowerCase();
    grid.innerHTML = '';
    const filtered = state.members.filter(m =>
        m.name.toLowerCase().includes(search) &&
        (state.msDeptFilter === 'ALL' || m.dept === state.msDeptFilter));
    filtered.forEach(m => {
        const isSel = state.msSelectedIds.includes(m.id);
        const div = document.createElement('div');
        div.className = 'ms-member-card' + (isSel ? ' selected' : '');
        div.onclick = () => toggleMsSelect(m.id, div);
        div.innerHTML = `
            <div class="ms-check"><i class="fa-solid fa-check"></i></div>
            <div class="ms-member-avatar"><i class="fa-solid fa-user"></i></div>
            <div class="ms-member-name">${m.name}</div>
            <div class="ms-member-dept">${m.dept}</div>`;
        grid.appendChild(div);
    });
}

function toggleMsSelect(mId, card) {
    if (state.msSelectedIds.includes(mId)) {
        state.msSelectedIds = state.msSelectedIds.filter(x => x !== mId);
        card.classList.remove('selected');
    } else {
        state.msSelectedIds.push(mId);
        card.classList.add('selected');
    }
}

function msNextStep() {
    if (msStep === 1) {
        if (state.msSelectedIds.length === 0) return alert('Hay chon it nhat 1 thanh vien!');
        msStep = 2;
        document.getElementById('ms-step-1').style.display = 'none';
        document.getElementById('ms-step-2').style.display = 'block';
        document.getElementById('ms-back-btn').style.display = 'inline-flex';
        document.getElementById('ms-next-btn').innerText = 'Xac nhan Luu';
        document.getElementById('ms-title').innerText = 'Gan Vi Tri';
        renderMsRoleList();
    } else {
        confirmMsSelection();
    }
}

function msGoBack() {
    msStep = 1;
    document.getElementById('ms-step-1').style.display = 'block';
    document.getElementById('ms-step-2').style.display = 'none';
    document.getElementById('ms-back-btn').style.display = 'none';
    document.getElementById('ms-next-btn').innerText = 'Tiep theo';
    document.getElementById('ms-title').innerText = 'Chon Nhan Su Tham Gia';
}

function renderMsRoleList() {
    const list = document.getElementById('ms-role-list');
    list.innerHTML = '';
    state.msSelectedIds.forEach(mId => {
        const m = state.members.find(x => x.id === mId);
        if (!m) return;
        const existingRole = state.activeProjectParticipantsSetup.find(p => p.memberId === mId)?.role || 'CT';
        list.innerHTML += `
            <div class="ms-role-row">
                <div>
                    <strong>${m.name}</strong>
                    <span style="margin-left:8px;font-size:0.8rem;color:#94a3b8">${m.dept}</span>
                </div>
                <select id="ms-role-${mId}" style="width:160px;padding:8px 12px;">
                    <option value="PL" ${existingRole === 'PL' ? 'selected' : ''}>Project Leader (PL)</option>
                    <option value="TL" ${existingRole === 'TL' ? 'selected' : ''}>Team Leader (TL)</option>
                    <option value="CT" ${existingRole === 'CT' ? 'selected' : ''}>Core Team (CT)</option>
                    <option value="SP" ${existingRole === 'SP' ? 'selected' : ''}>Supporter (SP)</option>
                </select>
            </div>`;
    });
}

function confirmMsSelection() {
    state.activeProjectParticipantsSetup = state.msSelectedIds.map(mId => {
        const role = document.getElementById('ms-role-' + mId)?.value || 'CT';
        const m = state.members.find(x => x.id === mId);
        return { memberId: mId, role, name: m ? m.name : 'Unknown' };
    });
    closeModal('member-select-modal');
    renderParticipantList();
}

// ==========================================
// EVIDENCE MODULE
// ==========================================
function setEvidenceFilter(btn, dept) {
    state.evidenceDeptFilter = dept;
    document.querySelectorAll('.evidence-filter-bar .filter-quick-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderEvidenceFolders();
}

function renderEvidenceFolders() {
    const grid = document.getElementById('evidence-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const search = (document.getElementById('search-evidence') ? document.getElementById('search-evidence').value : '').toLowerCase();
    const dept = document.getElementById('filter-evidence-dept')?.value || 'ALL';

    const filtered = state.members.filter(m =>
        m.name.toLowerCase().includes(search) && (dept === 'ALL' || m.dept === dept));

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Không tìm thấy thành viên phù hợp</div>';
        return;
    }

    filtered.forEach(m => {
        const ev = state.evidences[m.id] || { photos: [], newPhotos: [], label: m.name };
        const count = ev.photos ? ev.photos.length : 0;

        const card = document.createElement('div');
        card.className = 'folder-card';
        card.onclick = () => openEvidenceFolder(m.id);
        card.innerHTML = `
            <div class="folder-icon"><i class="fa-solid fa-folder"></i></div>
            <div class="folder-name">${ev.label || m.name}</div>
            <div class="folder-meta">Ban ${m.dept} • ${count} ảnh</div>
        `;
        grid.appendChild(card);
    });
}

function openEvidenceFolder(mId) {
    state.currentEvidenceMemberId = mId;
    const m = state.members.find(x => x.id === mId);
    if (!m) return;
    if (!state.evidences[mId]) state.evidences[mId] = { photos: [], newPhotos: [], label: m.name };
    const ev = state.evidences[mId];
    if (!ev.newPhotos) ev.newPhotos = [];
    document.getElementById('evidence-folder-title').innerText = 'Minh chung: ' + (ev.label || m.name);
    document.getElementById('evidence-folder-rename').value = ev.label || m.name;
    renderEvidencePhotos();
    openModal('evidence-folder-modal');
}

function renderEvidencePhotos() {
    const mId = state.currentEvidenceMemberId;
    const ev = state.evidences[mId];
    const grid = document.getElementById('evidence-photo-grid');
    grid.innerHTML = '';
    if (!ev) return;

    // Render synced photos (cannot delete directly from UI for now to prevent sync issues)
    if (ev.photos && ev.photos.length > 0) {
        ev.photos.forEach((photo) => {
            const div = document.createElement('div');
            div.className = 'evidence-photo-item';
            div.innerHTML = `<img src="${photo}" alt="Synced Evidence"><div style="position:absolute;bottom:0;background:rgba(0,0,0,0.5);color:#fff;width:100%;text-align:center;font-size:0.7rem;padding:2px;">Đã đồng bộ</div>`;
            grid.appendChild(div);
        });
    }

    // Render newly added photos
    if (ev.newPhotos && ev.newPhotos.length > 0) {
        ev.newPhotos.forEach((photo, idx) => {
            const div = document.createElement('div');
            div.className = 'evidence-photo-item';
            div.innerHTML = `<img src="${photo}" alt="New Evidence">
                <button class="del-photo-btn" onclick="deleteNewEvidencePhoto(${idx})"><i class="fa-solid fa-xmark"></i></button>`;
            grid.appendChild(div);
        });
    }
}

function deleteNewEvidencePhoto(idx) {
    const mId = state.currentEvidenceMemberId;
    if (!state.evidences[mId]) return;
    state.evidences[mId].newPhotos.splice(idx, 1);
    renderEvidencePhotos();
    renderEvidenceFolders();
}

function handleEvidenceUpload(inp) {
    const mId = state.currentEvidenceMemberId;
    if (!state.evidences[mId]) state.evidences[mId] = { photos: [], newPhotos: [], label: '' };
    if (!state.evidences[mId].newPhotos) state.evidences[mId].newPhotos = [];

    const files = Array.from(inp.files);
    let loaded = 0;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            compressImage(e.target.result, 400, 0.5, (compressed) => {
                state.evidences[mId].newPhotos.push(compressed);
                loaded++;
                if (loaded === files.length) { renderEvidencePhotos(); renderEvidenceFolders(); }
            });
        };
        reader.readAsDataURL(file);
    });
    inp.value = '';
}

function renameEvidenceFolder() {
    const mId = state.currentEvidenceMemberId;
    const newLabel = document.getElementById('evidence-folder-rename').value.trim();
    if (!newLabel) return;
    if (!state.evidences[mId]) state.evidences[mId] = { photos: [] };
    state.evidences[mId].label = newLabel;
    document.getElementById('evidence-folder-title').innerText = 'Minh chung: ' + newLabel;
    renderEvidenceFolders();
}

function saveEvidenceFolder() {
    const mId = state.currentEvidenceMemberId;
    const ev = state.evidences[mId];
    if (!ev) return;

    // Sync each new photo to backend
    if (ev.newPhotos && ev.newPhotos.length > 0) {
        ev.newPhotos.forEach(photoBase64 => {
            const imgPayload = {
                id: 'evi_' + Date.now() + Math.random().toString(36).substr(2, 5),
                memberId: mId,
                term: state.currentTerm,
                folderLabel: ev.label,
                image: photoBase64
            };
            syncToBackend('save_evidence_image', imgPayload);
            ev.photos.push(photoBase64); // Move to synced array
        });
        ev.newPhotos = []; // Clear pending queue
    }

    const payload = { memberId: mId, term: state.currentTerm, label: ev.label, photoCount: ev.photos.length, updatedAt: new Date().toISOString() };
    syncToBackend('save_evidence_meta', payload);

    alert('Đã lưu toàn bộ minh chứng lên Google Sheets!');
    closeModal('evidence-folder-modal');
    renderEvidenceFolders();
}

// ==========================================
// PHOTOBOOTH
// ==========================================
let ptbStream = null;
let ptbFilter = '';
let ptbShots = [];
let ptbShooting = false;

function initPhotobooth() {
    // Camera starts when user navigates to view
}

async function startCamera() {
    if (ptbStream) return;
    try {
        ptbStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
        const video = document.getElementById('ptb-video');
        if (video) { video.srcObject = ptbStream; }
    } catch (e) {
        console.warn('Camera not available:', e.message);
    }
}

function setPtbFilter(btn, filterClass) {
    ptbFilter = filterClass;
    document.querySelectorAll('.ptb-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const video = document.getElementById('ptb-video');
    video.className = filterClass ? filterClass : '';
}

async function startPtbCountdown() {
    if (ptbShooting) return;
    if (ptbShots.length >= 3) return alert('Da du 3 anh! Bam "Chup lai" de chup moi.');
    ptbShooting = true;
    document.getElementById('ptb-shoot-btn').disabled = true;
    const cd = document.getElementById('ptb-countdown');
    cd.style.display = 'flex';
    for (let i = 3; i >= 1; i--) {
        cd.innerText = i;
        await sleep(1000);
    }
    cd.style.display = 'none';
    capturePhoto();
    ptbShooting = false;
    document.getElementById('ptb-shoot-btn').disabled = false;
}

function capturePhoto() {
    const video = document.getElementById('ptb-video');
    const canvas = document.getElementById('ptb-canvas');
    const flash = document.getElementById('ptb-flash');
    const W = 640, H = 480;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(W, 0); ctx.scale(-1, 1);
    if (ptbFilter === 'filter-bw') { ctx.filter = 'grayscale(1) contrast(1.1)'; }
    else if (ptbFilter === 'filter-vintage') { ctx.filter = 'sepia(0.5) contrast(1.1) brightness(0.9)'; }
    else if (ptbFilter === 'filter-warm') { ctx.filter = 'saturate(1.3) hue-rotate(-10deg) brightness(1.05)'; }
    ctx.drawImage(video, 0, 0, W, H);
    ctx.restore();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    ptbShots.push(dataUrl);
    // Flash effect
    flash.style.opacity = '0.8';
    setTimeout(() => { flash.style.opacity = '0'; }, 150);
    // Update thumb
    const idx = ptbShots.length - 1;
    const thumb = document.getElementById('ptb-thumb-' + idx);
    if (thumb) {
        const tCtx = thumb.getContext('2d');
        const img = new Image();
        img.onload = () => tCtx.drawImage(img, 0, 0, 90, 68);
        img.src = dataUrl;
        thumb.classList.add('taken');
    }
    document.getElementById('ptb-count').innerText = ptbShots.length;
    if (ptbShots.length === 3) { renderPtbStrip(); document.getElementById('ptb-download-btn').style.display = 'flex'; }
}

function renderPtbStrip() {
    const strip = document.getElementById('ptb-strip');
    strip.innerHTML = '';
    ptbShots.forEach((src, i) => {
        const img = document.createElement('img');
        img.src = src;
        strip.appendChild(img);
        const lbl = document.createElement('div');
        lbl.className = 'ptb-strip-label';
        lbl.innerText = 'HuReA #' + (i + 1);
        strip.appendChild(lbl);
    });
}

function downloadStrip() {
    if (ptbShots.length < 3) return alert('Can chup du 3 anh!');
    const W = 260, photoH = 195, lblH = 24, padding = 12;
    const H = padding + (photoH + lblH + 8) * 3 + padding + 40;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    let y = padding;
    const loads = ptbShots.map((src, i) => new Promise(res => {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, padding, y, W - padding * 2, photoH);
            ctx.fillStyle = '#555555';
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('HuReA #' + (i + 1), W / 2, y + photoH + 18);
            y += photoH + lblH + 8;
            res();
        };
        img.src = src;
    }));
    Promise.all(loads).then(() => {
        ctx.fillStyle = '#0D8ABC';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('HuReA Photobooth', W / 2, H - 14);
        const link = document.createElement('a');
        link.download = 'HuReA-PhotoStrip-' + Date.now() + '.png';
        link.href = c.toDataURL('image/png');
        link.click();
    });
}

function resetPhotobooth() {
    ptbShots = [];
    document.getElementById('ptb-count').innerText = '0';
    document.getElementById('ptb-strip').innerHTML = '<div style="color:#999;font-size:0.85rem;text-align:center;padding:20px">Chup 3 anh de tao strip</div>';
    document.getElementById('ptb-download-btn').style.display = 'none';
    [0, 1, 2].forEach(i => {
        const thumb = document.getElementById('ptb-thumb-' + i);
        if (thumb) {
            const ctx = thumb.getContext('2d');
            ctx.clearRect(0, 0, 90, 68);
            thumb.classList.remove('taken');
        }
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ==========================================
// CINEMATIC 360 EVAL
// ==========================================
let cine_currentStep = 1, cine_totalSteps = 1, cine_targets = [];

function loadPrjMembersForEval() {
    const prjId = document.getElementById('eval-prj-id').value;
    const p = state.projects.find(x => x.id === prjId);
    if (!p) return;
    const prjMembers = p.participants.map(pt => {
        const m = state.members.find(x => x.id === pt.memberId);
        return { id: pt.memberId, name: m ? m.name : 'Unknown', role: pt.role };
    });
    fillSearchableDropdown('list-rater', prjMembers, 'id', 'name',
        m => '<strong>' + m.name + '</strong> - ' + m.role, 'eval-prj-rater', 'btn-rater');
}

function startCinematicEvaluation() {
    const prjId = document.getElementById('eval-prj-id').value;
    const raterId = document.getElementById('eval-prj-rater').value;
    if (!prjId || !raterId) return alert('Hay chon du Du an va Ten cua ban!');
    const prj = state.projects.find(x => x.id === prjId);
    if (!prj) return;
    cine_targets = prj.participants.filter(pt => pt.memberId !== raterId);
    if (cine_targets.length === 0) return alert('Ban la nguoi duy nhat! Khong co ai de danh gia cheo.');
    document.getElementById('cine-project-name').innerText = 'Danh gia cheo: ' + prj.name;
    cine_currentStep = 1;
    cine_totalSteps = cine_targets.length + 1;
    renderCineSteps();
    document.getElementById('eval-project-setup-view').style.display = 'none';
    document.getElementById('cinematic-eval-inline').style.display = 'block';
    updateCineUI();
}

function closeCinematicEval() {
    document.getElementById('cinematic-eval-inline').style.display = 'none';
    document.getElementById('eval-project-setup-view').style.display = 'block';
    document.getElementById('cine-success-overlay').style.display = 'none';
}

function renderCineSteps() {
    const c = document.getElementById('cine-form-steps-container');
    c.innerHTML = '';
    cine_targets.forEach((pt, idx) => {
        const m = state.members.find(x => x.id === pt.memberId);
        const name = m ? m.name : 'Unknown';
        const stepNum = idx + 1;
        c.innerHTML += `<section class="cine-section" data-step="${stepNum}">
            <div class="cine-sec-header">
                <span class="cine-step-badge">${stepNum}</span>
                <h2 class="cine-sec-title">Danh gia: <span style="color:#f59e0b">${name}</span> <span style="font-size:1rem;color:#94a3b8">(${pt.role})</span></h2>
            </div>
            <input type="hidden" name="targetId_${stepNum}" value="${pt.memberId}">
            <div class="cine-eval-loop">
                ${renderRangeItem(stepNum, 'c1', 'Nhiet tinh, chu dong trong cong viec')}
                ${renderRangeItem(stepNum, 'c2', 'Trach nhiem, dung deadline')}
                ${renderRangeItem(stepNum, 'c3', 'Tu duy tich cuc, de xuat y kien')}
                ${renderRangeItem(stepNum, 'c4', 'Trinh do, chuyen mon')}
                ${renderRangeItem(stepNum, 'c5', 'Dau tu nghien cuu, hoc hoi')}
                ${renderRangeItem(stepNum, 'c6', 'Muc do hoan thanh cong viec')}
                ${renderRangeItem(stepNum, 'c7', 'Quan he voi Care/Leader/Thanh vien CT')}
            </div>
            <div class="cine-footer-nav">
                <button type="button" class="cine-test-btn" onclick="cineAutofill(${stepNum})">Auto-fill</button>
                ${stepNum > 1 ? '<button type="button" class="cine-btn cine-btn-secondary" onclick="cinePrev()">Quay lai</button>' : '<div></div>'}
                <button type="button" class="cine-btn cine-btn-primary" onclick="cineNext(${stepNum})">Nguoi tiep theo</button>
            </div>
        </section>`;
    });
    const finalStep = cine_totalSteps;
    c.innerHTML += `<section class="cine-section" data-step="${finalStep}">
        <div class="cine-sec-header">
            <span class="cine-step-badge"><i class="fa-solid fa-flag-checkered"></i></span>
            <h2 class="cine-sec-title">Gop y Tong quan Du an</h2>
        </div>
        <div style="margin-bottom:32px;">
            <label class="cine-label-text">Gop y an danh (cho BTC / Ban / Du an)</label>
            <textarea id="cine-final-feedback" rows="4" placeholder="Nhung suy nghi, cam nhan cua ban... Se hoan toan an danh."></textarea>
        </div>
        <div class="cine-footer-nav">
            <button type="button" class="cine-test-btn" onclick="document.getElementById('cine-final-feedback').value='Chuong trinh rat thanh cong!'">Auto-fill</button>
            <button type="button" class="cine-btn cine-btn-secondary" onclick="cinePrev()">Quay lai</button>
            <button type="button" class="cine-btn cine-btn-primary" onclick="submitCinematicEvaluation()">Gui Toan Bo Danh Gia</button>
        </div>
    </section>`;
    document.querySelectorAll('.cine-slider').forEach(slider => {
        slider.addEventListener('input', function () {
            this.parentElement.querySelector('.rating-val-display').innerText = this.value;
        });
    });
}

function renderRangeItem(stepNum, critKey, label) {
    return `<div class="rating-item">
        <div class="rating-label">
            <span>${label} *</span>
            <span class="rating-val-display" id="val_${stepNum}_${critKey}">5</span>
        </div>
        <input type="range" class="cine-slider" id="range_${stepNum}_${critKey}" min="1" max="10" value="5">
    </div>`;
}

function updateCineUI() {
    document.querySelectorAll('.cine-section').forEach(s => s.classList.remove('active'));
    const active = document.querySelector('.cine-section[data-step="' + cine_currentStep + '"]');
    if (active) active.classList.add('active');
    const progress = (cine_currentStep / cine_totalSteps) * 100;
    document.getElementById('lux-progress-bar').style.width = progress + '%';
    document.getElementById('lux-step-indicator').innerText = 'BUOC ' + cine_currentStep + ' / ' + cine_totalSteps;
    document.getElementById('cinematic-eval-inline').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cineNext() { cine_currentStep++; updateCineUI(); }
function cinePrev() { if (cine_currentStep > 1) { cine_currentStep--; updateCineUI(); } }

function cineAutofill(stepNum) {
    const sec = document.querySelector('.cine-section[data-step="' + stepNum + '"]');
    if (!sec) return;
    sec.querySelectorAll('input[type=range]').forEach(s => {
        const v = Math.floor(Math.random() * 3) + 8;
        s.value = v;
        s.parentElement.querySelector('.rating-val-display').innerText = v;
    });
}

function submitCinematicEvaluation() {
    const term = state.currentTerm;
    const prjId = document.getElementById('eval-prj-id').value;
    const raterId = document.getElementById('eval-prj-rater').value;
    const prj = state.projects.find(x => x.id === prjId);
    if (!prj) return;
    const raterRole = prj.participants.find(x => x.memberId === raterId)?.role || 'Unknown';
    const commonFeedback = document.getElementById('cine-final-feedback').value;
    cine_targets.forEach((pt, idx) => {
        const sn = idx + 1;
        const c1 = parseFloat(document.getElementById('range_' + sn + '_c1').value);
        const c2 = parseFloat(document.getElementById('range_' + sn + '_c2').value);
        const c3 = parseFloat(document.getElementById('range_' + sn + '_c3').value);
        const c4 = parseFloat(document.getElementById('range_' + sn + '_c4').value);
        const c5 = parseFloat(document.getElementById('range_' + sn + '_c5').value);
        const c6 = parseFloat(document.getElementById('range_' + sn + '_c6').value);
        const c7 = parseFloat(document.getElementById('range_' + sn + '_c7').value);
        const score = (c1 + c2 + c3 + c4 + c5 + c6 + c7) / 7;
        const record = {
            id: 'ev_' + Date.now() + '_' + idx,
            term, prjId, raterId, targetId: pt.memberId,
            raterRole, targetRole: pt.role,
            c1, c2, c3, c4, c5, c6, c7, score,
            feedback: idx === 0 ? commonFeedback : ''
        };
        state.evaluations.push(record);
        syncToBackend('save_eval', record);
    });
    document.getElementById('cine-success-overlay').style.display = 'flex';
    updateDashboardStats(); calculateFinalScores();
}
// ==========================================
// IMAGE & BUG REPORT MODULE
// ==========================================
function handleImagePreview(input, previewId) {
    const file = input.files[0];
    const previewArea = document.getElementById(previewId);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        // Nén ảnh xuống tối đa 400px, chất lượng 0.5 để đảm bảo Base64 chuỗi ảnh < 50,000 ký tự (Giới hạn của Google Sheets cell)
        compressImage(e.target.result, 400, 0.5, (compressedData) => {
            previewArea.innerHTML = `
                <div class="preview-img-wrapper">
                    <img src="${compressedData}">
                    <button class="remove-img-btn" onclick="removeImagePreview('${previewId}', '${input.id}')">&times;</button>
                </div>`;
            previewArea.style.display = 'block';
        });
    };
    reader.readAsDataURL(file);
}

function removeImagePreview(previewId, inputId) {
    const previewArea = document.getElementById(previewId);
    document.getElementById(inputId).value = '';

    if (previewId === 'bug-preview') {
        previewArea.innerHTML = `
            <div class="drop-circle">
                <i class="fa-solid fa-cloud-arrow-up"></i>
            </div>
            <div class="drop-text">
                <strong>Nhấp để tải ảnh lên</strong>
                <span>Hỗ trợ định dạng JPG, PNG</span>
            </div>`;
    } else if (previewId === 'ann-preview') {
        previewArea.innerHTML = `
            <div class="drop-circle" style="width:40px;height:40px;font-size:1rem;">
                <i class="fa-solid fa-cloud-arrow-up"></i>
            </div>
            <div class="drop-text" style="flex-direction:row;align-items:center;gap:12px;">
                <strong>Nhấn để tải ảnh</strong>
            </div>`;
        previewArea.style.display = 'flex';
    }
}

function compressImage(base64, maxWidth, quality, callback) {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', quality));
    };
}

async function submitBugReport() {
    const title = document.getElementById('bug-title').value;
    const priority = document.getElementById('bug-priority').value;
    const area = document.getElementById('bug-area').value;
    const desc = document.getElementById('bug-desc').value;
    const imgPreview = document.querySelector('#bug-preview img');
    const screenshot = imgPreview ? imgPreview.src : null;

    if (!title || !desc) return alert('Vui lòng nhập tiêu đề và mô tả lỗi!');

    const bug = {
        id: 'bug_' + Date.now(),
        title, priority, area, desc, screenshot,
        status: 'OPEN',
        createdAt: new Date().toLocaleDateString('vi-VN'),
        term: state.currentTerm
    };

    state.bugReports.push(bug);
    syncToBackend('save_bug_report', bug);

    // Reset form
    document.getElementById('bug-title').value = '';
    document.getElementById('bug-area').value = '';
    document.getElementById('bug-desc').value = '';
    removeImagePreview('bug-preview', 'bug-screenshot');

    renderBugReports();
    alert('Báo cáo lỗi đã được gửi. Cảm ơn bạn!');
}

function renderBugReports() {
    const list = document.getElementById('bug-list');
    if (!list) return;
    list.innerHTML = '';

    if (state.bugReports.length === 0) {
        list.innerHTML = `
            <div class="empty-feed">
                <i class="fa-solid fa-clipboard-check"></i>
                <p>Tạm thời chưa có báo cáo nào. Hệ thống của bạn đang rất ổn định!</p>
            </div>`;
        return;
    }

    state.bugReports.slice().reverse().forEach(bug => {
        const priorityLabel = bug.priority === 'HIGH' ? 'Nghiêm trọng' : (bug.priority === 'MEDIUM' ? 'Trung bình' : 'Thấp');
        list.innerHTML += `
            <div class="bug-item prio-${bug.priority}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                    <h5 style="color:var(--text-main);margin:0;">${bug.title}</h5>
                    <span class="bug-status-tag prio-${bug.priority}">${priorityLabel}</span>
                </div>
                <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px;display:flex;gap:12px;">
                    <span><i class="fa-solid fa-location-dot" style="margin-right:4px;"></i> ${bug.area || 'Hệ thống'}</span>
                    <span><i class="fa-solid fa-circle-info" style="margin-right:4px;"></i> ${bug.status}</span>
                </div>
                <p style="font-size:0.85rem;line-height:1.5;color:var(--text-muted);margin-bottom:12px;">${bug.desc}</p>
                ${bug.screenshot ? `<div style="margin-top:12px;"><img src="${bug.screenshot}" style="width:100%;max-height:180px;object-fit:cover;border-radius:12px;border:1px solid rgba(0,0,0,0.1);"></div>` : ''}
                <div class="bug-meta">
                    <span style="opacity:0.6;"><i class="fa-solid fa-calendar-day"></i> ${bug.createdAt}</span>
                    <span style="color:var(--primary);cursor:pointer;font-weight:600;" onclick="openBugDetail('${bug.id}')"><i class="fa-solid fa-circle-chevron-right"></i> Chi tiết</span>
                </div>
            </div>`;
    });
}

function openBugDetail(bugId) {
    const bug = state.bugReports.find(b => b.id === bugId);
    if (!bug) return;

    const priorityLabel = bug.priority === 'HIGH' ? 'Nghiêm trọng' : (bug.priority === 'MEDIUM' ? 'Trung bình' : 'Thấp');

    document.getElementById('bug-detail-title').innerText = bug.title;
    document.getElementById('bug-detail-status').innerHTML = `Trạng thái: <strong>${bug.status}</strong> &nbsp;•&nbsp; Ưu tiên: <span class="bug-status-tag prio-${bug.priority}">${priorityLabel}</span>`;
    document.getElementById('bug-detail-area').innerText = bug.area || 'Toàn hệ thống';
    document.getElementById('bug-detail-desc').innerText = bug.desc;

    const img = document.getElementById('bug-detail-image');
    if (bug.screenshot) {
        img.src = bug.screenshot;
        img.style.display = 'inline-block';
    } else {
        img.style.display = 'none';
        img.src = '';
    }

    openModal('bug-detail-modal');
}

// ==========================================
// AUTH & LOGIN SYSTEM
// ==========================================

function initPinInputs() {
    // Auto-focus next pin box on input
    document.querySelectorAll('.pin-box').forEach(box => {
        box.addEventListener('input', function (e) {
            const val = this.value.replace(/[^0-9]/g, '');
            this.value = val;
            if (val.length === 1) {
                this.classList.add('filled');
                const next = this.nextElementSibling;
                if (next && next.classList.contains('pin-box')) next.focus();
            } else {
                this.classList.remove('filled');
            }
        });
        box.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace' && !this.value) {
                const prev = this.previousElementSibling;
                if (prev && prev.classList.contains('pin-box')) {
                    prev.focus();
                    prev.value = '';
                    prev.classList.remove('filled');
                }
            }
            // Allow Enter to submit
            if (e.key === 'Enter') {
                const row = this.closest('.pin-input-row');
                if (row && row.id === 'pin-input-row') handleLogin();
            }
        });
        // Paste support
        box.addEventListener('paste', function (e) {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
            const row = this.closest('.pin-input-row');
            if (!row) return;
            const boxes = row.querySelectorAll('.pin-box');
            for (let i = 0; i < Math.min(pasted.length, 6); i++) {
                boxes[i].value = pasted[i];
                boxes[i].classList.add('filled');
            }
            if (pasted.length >= 6) boxes[5].focus();
            else if (pasted.length > 0) boxes[Math.min(pasted.length, 5)].focus();
        });
    });

    // Member select change handler (Now handled by renderLoginMemberSelector)
}

function getMemberDept(m) {
    if (!m) return '';
    return m.dept || m.Ban || m.Department || m['Bộ phận'] || '';
}

function setLoginDeptFilter(btn, dept) {
    state.loginDeptFilter = dept;
    document.querySelectorAll('#login-dept-pills .login-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderLoginMemberSelector();
}

function openLoginSelector() {
    state.loginDeptFilter = 'ALL';
    document.querySelectorAll('#login-dept-pills .login-pill').forEach(p => {
        p.classList.toggle('active', p.innerText === 'Tất cả');
    });
    
    document.getElementById('login-member-search').value = '';
    renderLoginMemberSelector();
    document.getElementById('login-selector-overlay').classList.remove('hidden');
    setTimeout(() => document.getElementById('login-member-search').focus(), 400);
}

function closeLoginSelector() {
    document.getElementById('login-selector-overlay').classList.add('hidden');
}

function renderLoginMemberSelector() {
    const list = document.getElementById('login-member-list');
    if (!list) return;

    // Loading State
    if (state.initialLoading && state.members.length === 0) {
        list.innerHTML = `
            <div class="login-member-loading">
                <div class="loading-text">Đang kết nối với máy chủ...</div>
                <div class="progress-container">
                    <div class="progress-bar-fill"></div>
                </div>
                <p style="color: #64748b; font-size: 0.8rem;">Vui lòng đợi trong giây lát</p>
            </div>
        `;
        return;
    }

    const search = document.getElementById('login-member-search').value.toLowerCase();
    const dept = state.loginDeptFilter;
    const selectedId = document.getElementById('login-member-id').value;

    const filtered = state.members.filter(m => {
        const mDept = getMemberDept(m);
        return m.name.toLowerCase().includes(search) &&
            (dept === 'ALL' || (dept === 'BCN' ? !['L&D', 'R&R', 'ER', 'EB'].includes(mDept) : mDept === dept));
    }).sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    list.innerHTML = '';
    
    // Empty State after loading
    if (filtered.length === 0) {
        if (!state.initialLoading && state.members.length === 0) {
            list.innerHTML = `
                <div class="login-member-loading">
                    <div class="loading-error-icon"><i class="fa-solid fa-circle-exclamation"></i></div>
                    <div class="loading-text">Không thể tải danh sách thành viên</div>
                    <button class="btn-retry" onclick="retryLoadData()">
                        <i class="fa-solid fa-rotate-right"></i> Thử lại ngay
                    </button>
                </div>
            `;
        } else {
            list.innerHTML = '<div class="login-member-loading" style="grid-column: 1 / -1;">Không tìm thấy thành viên phù hợp.</div>';
        }
        return;
    }

    filtered.forEach(m => {
        const item = document.createElement('div');
        item.className = 'login-member-item' + (selectedId === m.id ? ' selected' : '');
        item.onclick = () => selectLoginMember(m.id);
        const mDept = getMemberDept(m);
        item.innerHTML = `
            <div class="login-member-avatar"><i class="fa-solid fa-user"></i></div>
            <div class="login-member-info">
                <span class="login-member-name">${m.name}</span>
                <span class="login-member-dept">${mDept ? 'Ban ' + mDept : 'Thành viên'}</span>
            </div>
            ${selectedId === m.id ? '<i class="fa-solid fa-circle-check" style="color:#38bdf8"></i>' : ''}
        `;
        list.appendChild(item);
    });
}

function selectLoginMember(mId) {
    const member = state.members.find(m => m.id === mId);
    if (!member) return;

    document.getElementById('login-member-id').value = mId;
    
    // Update display card
    document.getElementById('display-name').innerText = member.name;
    document.getElementById('display-dept').innerText = `Ban ${getMemberDept(member)} - ${member.class || ''}`;
    document.getElementById('selected-member-display').classList.add('selected');

    // Close selector
    closeLoginSelector();

    // Check PIN status
    const pinRec = state.userPins.find(p => p.memberId === mId);
    if (pinRec) {
        document.getElementById('login-pin-section').style.display = 'block';
        document.getElementById('login-create-pin-section').style.display = 'none';
        clearPinBoxes('pin-input-row');
        setTimeout(() => {
            const first = document.querySelector('#pin-input-row .pin-box');
            if (first) first.focus();
        }, 100);
    } else {
        document.getElementById('login-pin-section').style.display = 'none';
        document.getElementById('login-create-pin-section').style.display = 'block';
        clearPinBoxes('create-pin-row');
        clearPinBoxes('confirm-pin-row');
        setTimeout(() => {
            const first = document.querySelector('#create-pin-row .pin-box');
            if (first) first.focus();
        }, 100);
    }
    document.getElementById('pin-error').style.display = 'none';
    document.getElementById('create-pin-error').style.display = 'none';
}

function showLoginScreen() {
    const overlay = document.getElementById('login-overlay');
    overlay.classList.remove('hidden');

    // Reset selected member UI
    document.getElementById('login-member-id').value = '';
    document.getElementById('display-name').innerText = 'Chưa chọn thành viên';
    document.getElementById('display-dept').innerText = 'Nhấn để chọn tên của bạn';
    document.getElementById('selected-member-display').classList.remove('selected');

    // Reset UI sections
    document.getElementById('login-pin-section').style.display = 'none';
    document.getElementById('login-create-pin-section').style.display = 'none';
    document.getElementById('admin-login-form').style.display = 'none';
    document.getElementById('pin-error').style.display = 'none';
    document.getElementById('admin-error').style.display = 'none';
    document.getElementById('admin-password').value = '';
}

function getPinValue(rowId) {
    const boxes = document.querySelectorAll(`#${rowId} .pin-box`);
    return Array.from(boxes).map(b => b.value).join('');
}

function clearPinBoxes(rowId) {
    document.querySelectorAll(`#${rowId} .pin-box`).forEach(b => {
        b.value = '';
        b.classList.remove('filled', 'error');
    });
}

function setPinError(rowId) {
    document.querySelectorAll(`#${rowId} .pin-box`).forEach(b => {
        b.classList.add('error');
        b.value = '';
        b.classList.remove('filled');
    });
    setTimeout(() => {
        document.querySelectorAll(`#${rowId} .pin-box`).forEach(b => b.classList.remove('error'));
        document.querySelector(`#${rowId} .pin-box`).focus();
    }, 600);
}

function handleLogin() {
    const memberId = document.getElementById('login-member-id').value;
    if (!memberId) return alert('Vui lòng chọn tên của bạn!');

    const pin = getPinValue('pin-input-row');
    if (pin.length !== 6) {
        document.getElementById('pin-error').style.display = 'block';
        document.getElementById('pin-error-text').innerText = 'Vui lòng nhập đủ 6 số PIN';
        return;
    }

    const stored = state.userPins.find(p => p.memberId === memberId);
    // Normalize pin from state (in case it was loaded as a number from Sheets)
    const normalizedStoredPin = stored ? String(stored.pin).padStart(6, '0') : null;

    if (!stored || normalizedStoredPin !== pin) {
        document.getElementById('pin-error').style.display = 'block';
        document.getElementById('pin-error-text').innerText = 'Sai mã PIN, vui lòng thử lại';
        setPinError('pin-input-row');
        return;
    }

    // Success - login as user
    const member = state.members.find(m => m.id === memberId);
    state.currentUser = member;
    state.userRole = 'user';
    completeLogin();
}

function handleCreatePin() {
    const memberId = document.getElementById('login-member-id').value;
    if (!memberId) return alert('Vui lòng chọn tên của bạn!');

    const pin = getPinValue('create-pin-row');
    const confirmPin = getPinValue('confirm-pin-row');

    if (pin.length !== 6) {
        document.getElementById('create-pin-error').style.display = 'block';
        document.getElementById('create-pin-error-text').innerText = 'Vui lòng nhập đủ 6 số PIN';
        return;
    }

    if (!/^\d{6}$/.test(pin)) {
        document.getElementById('create-pin-error').style.display = 'block';
        document.getElementById('create-pin-error-text').innerText = 'Mã PIN chỉ được chứa chữ số';
        return;
    }

    if (pin !== confirmPin) {
        document.getElementById('create-pin-error').style.display = 'block';
        document.getElementById('create-pin-error-text').innerText = 'Mã PIN xác nhận không khớp!';
        setPinError('confirm-pin-row');
        return;
    }

    // Save PIN
    const member = state.members.find(m => m.id === memberId);
    const pinRecord = {
        id: 'pin_' + Date.now(),
        memberId: memberId,
        name: member ? member.name : '',
        pin: pin,
        createdAt: new Date().toISOString()
    };

    state.userPins.push(pinRecord);
    syncToBackend('save_user_pin', pinRecord);

    // Login as user
    state.currentUser = member;
    state.userRole = 'user';
    completeLogin();
}

function handleAdminLogin() {
    const pw = document.getElementById('admin-password').value;
    if (pw !== ADMIN_PASSWORD) {
        document.getElementById('admin-error').style.display = 'block';
        document.getElementById('admin-password').value = '';
        setTimeout(() => document.getElementById('admin-error').style.display = 'none', 3000);
        return;
    }

    // Success - login as admin
    state.currentUser = { id: 'admin', name: 'Admin', dept: 'BCN' };
    state.userRole = 'admin';
    completeLogin();
}

function completeLogin() {
    // Hide login overlay
    document.getElementById('login-overlay').classList.add('hidden');

    // Update header
    updateHeaderUser();

    // Apply permissions
    applyPermissions(state.userRole);

    // Now render all views
    renderAllViews();

    // Update welcome message
    const welcomeH2 = document.querySelector('.welcome-content h2');
    if (welcomeH2) {
        const hour = new Date().getHours();
        let greeting = 'Chào buổi sáng';
        if (hour >= 12 && hour < 18) greeting = 'Chào buổi chiều';
        else if (hour >= 18) greeting = 'Chào buổi tối';
        welcomeH2.innerText = `${greeting}, ${state.currentUser.name}! 👋`;
    }
    const welcomeP = document.querySelector('.welcome-content p');
    if (welcomeP) {
        welcomeP.innerText = state.userRole === 'admin'
            ? 'Chào mừng bạn trở lại hệ thống quản trị HuReA. Bạn có quyền truy cập toàn bộ.'
            : 'Chào mừng bạn đến với hệ thống HuReA. Hãy theo dõi tiến độ hoạt động của mình.';
    }
}

function updateHeaderUser() {
    const name = state.currentUser ? state.currentUser.name : 'Guest';
    const encodedName = encodeURIComponent(name);
    document.getElementById('header-username').innerText = name;
    document.getElementById('header-avatar').src = `https://ui-avatars.com/api/?name=${encodedName}&background=${state.userRole === 'admin' ? 'f59e0b' : '0D8ABC'}&color=fff`;

    const badge = document.getElementById('header-role-badge');
    if (state.userRole === 'admin') {
        badge.innerText = 'Admin';
        badge.className = 'header-role-badge role-admin';
    } else {
        badge.innerText = 'Member';
        badge.className = 'header-role-badge role-user';
    }

    // Update version badge
    const versionBadge = document.querySelector('.version-badge');
    if (versionBadge) {
        versionBadge.innerText = state.userRole === 'admin' ? 'Admin V19' : 'Member';
    }
}

function applyPermissions(role) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('nav-hidden');
    });

    if (role === 'user') {
        // Hide: Tài nguyên Nhân sự (members-view), Quản lý Nhiệm kì (terms-view)
        navItems.forEach(item => {
            const target = item.getAttribute('data-target');
            if (target === 'members-view' || target === 'terms-view') {
                item.classList.add('nav-hidden');
            }
        });

        // Hide eval tabs: "2. Hoạt động CLB" and "1. Hoạt động Ban"
        document.querySelectorAll('.eval-tab').forEach(tab => {
            const evalTarget = tab.getAttribute('data-eval');
            if (evalTarget === 'eval-club' || evalTarget === 'eval-dept') {
                tab.style.display = 'none';
            } else {
                tab.style.display = '';
            }
        });

        // Hide action buttons in eval-view (Tính toán lại, Xuất Excel) for user
        const evalCalcActions = document.querySelector('#eval-calc .pane-header div[style*="gap:12px"]');
        if (evalCalcActions) evalCalcActions.style.display = 'none';

        // Hide add/edit buttons in projects-view
        const prjAddBtn = document.querySelector('#projects-view .btn-primary');
        if (prjAddBtn) prjAddBtn.style.display = 'none';

        document.querySelectorAll('.btn-create-ann').forEach(btn => btn.style.display = 'none');
        
        // Hide PIN Management for normal user
        const pinNav = document.getElementById('pin-mgmt-nav');
        if (pinNav) pinNav.classList.add('nav-hidden');

        // Lock Project Editing
        const prjForm = document.querySelector('#project-modal form');
        if (prjForm) {
            prjForm.querySelectorAll('input, select, textarea').forEach(el => el.disabled = true);
            const prjToggle = document.getElementById('p-has-pl');
            if (prjToggle) prjToggle.disabled = true;
        }
        const prjSaveBtn = document.querySelector('#project-modal .modal-footer .btn-primary');
        if (prjSaveBtn) prjSaveBtn.style.display = 'none';
        
        const prjStaffBtn = document.querySelector('.participant-manager .btn-primary');
        if (prjStaffBtn) prjStaffBtn.style.display = 'none';

        // Update Project Card buttons to say "Xem" instead of "Quản lý"
        document.querySelectorAll('.project-card .btn-secondary').forEach(btn => {
            if (btn.innerText.includes('Quản lý')) btn.innerHTML = '<i class="fa-solid fa-eye"></i> Xem nhân sự';
        });
        document.querySelectorAll('.project-card .btn-icon.delete').forEach(btn => btn.style.display = 'none');

    } else {
        // Admin: show everything
        document.querySelectorAll('.eval-tab').forEach(tab => tab.style.display = '');

        const evalCalcActions = document.querySelector('#eval-calc .pane-header div[style*="gap:12px"]');
        if (evalCalcActions) evalCalcActions.style.display = 'flex';

        const prjAddBtn = document.querySelector('#projects-view .btn-primary');
        if (prjAddBtn) prjAddBtn.style.display = '';

        document.querySelectorAll('.btn-create-ann').forEach(btn => btn.style.display = '');

        // Unlock Project Editing
        const prjForm = document.querySelector('#project-modal form');
        if (prjForm) {
            prjForm.querySelectorAll('input, select, textarea').forEach(el => el.disabled = false);
            const prjToggle = document.getElementById('p-has-pl');
            if (prjToggle) prjToggle.disabled = false;
        }
        const prjSaveBtn = document.querySelector('#project-modal .modal-footer .btn-primary');
        if (prjSaveBtn) prjSaveBtn.style.display = 'inline-block';
        
        const prjStaffBtn = document.querySelector('.participant-manager .btn-primary');
        if (prjStaffBtn) prjStaffBtn.style.display = 'inline-flex';

        // Show PIN Management for admin
        const pinNav = document.getElementById('pin-mgmt-nav');
        if (pinNav) pinNav.classList.remove('nav-hidden');
    }
}

function toggleAdminLogin() {
    const form = document.getElementById('admin-login-form');
    if (form.style.display === 'none') {
        form.style.display = 'block';
        document.getElementById('admin-password').focus();
    } else {
        form.style.display = 'none';
    }
}

function togglePwVisibility(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (inp.type === 'password') {
        inp.type = 'text';
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
        inp.type = 'password';
        btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
}

function logout() {
    state.currentUser = null;
    state.userRole = 'guest';

    // Reset to dashboard view
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    const dashNav = document.querySelector('.nav-item[data-target="dashboard-view"]');
    if (dashNav) dashNav.classList.add('active');
    const dashView = document.getElementById('dashboard-view');
    if (dashView) dashView.classList.add('active');

    showLoginScreen();
}

// Override renderEvidenceFolders to filter by user
const _originalRenderEvidenceFolders = renderEvidenceFolders;
renderEvidenceFolders = function () {
    if (state.userRole === 'user' && state.currentUser) {
        const grid = document.getElementById('evidence-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const m = state.currentUser;
        const ev = state.evidences[m.id] || { photos: [], newPhotos: [], label: m.name };
        const count = ev.photos ? ev.photos.length : 0;

        const card = document.createElement('div');
        card.className = 'folder-card';
        card.onclick = () => openEvidenceFolder(m.id);
        card.innerHTML = `
            <div class="folder-icon"><i class="fa-solid fa-folder"></i></div>
            <div class="folder-name">${ev.label || m.name}</div>
            <div class="folder-meta">Ban ${m.dept} • ${count} ảnh</div>
        `;
        grid.appendChild(card);
    } else {
        _originalRenderEvidenceFolders();
    }
};

// Override calculateFinalScores to filter by user
const _originalCalculateFinalScores = calculateFinalScores;
calculateFinalScores = function () {
    if (state.userRole === 'user' && state.currentUser) {
        const tbody = document.getElementById('score-tbody');
        tbody.innerHTML = '';
        const member = state.currentUser;
        const mId = member.id;

        const prjScore = calculateMemberProjectScore(mId);
        const clubScore = calculateMemberClubScore(mId);
        const de = state.deptScores.find(x => x.memberId === mId && x.term === state.currentTerm);
        const deptScore = de ? de.totalScore : 0;
        const total = (prjScore + clubScore + deptScore) / 3;
        let grade = 'Can co gang';
        let gradeVi = 'Cần Cố Gắng';
        if (total >= 8.5) { grade = 'Xuat Sac'; gradeVi = 'Xuất Sắc'; }
        else if (total >= 7) { grade = 'Kha'; gradeVi = 'Khá'; }
        else if (total >= 5) { grade = 'Dat'; gradeVi = 'Đạt'; }
        const gradeColors = { 'Xuat Sac': '#f59e0b', 'Kha': '#10b981', 'Dat': '#0D8ABC', 'Can co gang': '#ef4444' };
        const gc = gradeColors[grade] || '#ef4444';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${member.name}</strong><br><span style="font-size:0.75rem;color:#94a3b8">Ban ${member.dept} - ${member.class}</span></td>
            <td><span style="color:#38bdf8;font-weight:700">${prjScore.toFixed(2)}</span></td>
            <td><span style="color:#10b981;font-weight:700">${clubScore.toFixed(2)}</span></td>
            <td><span style="color:#f59e0b;font-weight:700">${deptScore.toFixed(2)}</span></td>
            <td><strong style="font-size:1.2rem;color:var(--primary)">${total.toFixed(2)}</strong></td>
            <td><span style="background:${gc}22;color:${gc};border:1px solid ${gc}44;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:700">${gradeVi}</span></td>
            <td><button class="btn-secondary btn-sm" onclick="showScoreDetail('${mId}')"><i class="fa-solid fa-list-ul"></i> Chi tiết</button></td>`;
        tbody.appendChild(tr);
    } else {
        _originalCalculateFinalScores();
    }
};

// Override renderProjects to hide edit/delete for user
const _originalRenderProjects = renderProjects;
renderProjects = function () {
    _originalRenderProjects();
    if (state.userRole === 'user') {
        // Remove edit/delete from project cards
        document.querySelectorAll('#projects-grid .project-card').forEach(card => {
            const actionDiv = card.querySelector('div[style*="justify-content:flex-end"]');
            if (actionDiv) actionDiv.style.display = 'none';
        });
    }
};

// ==========================================
// PIN MANAGEMENT (Admin Only)
// ==========================================
function setPinDeptFilter(btn, dept) {
    state.pinDeptFilter = dept;
    document.querySelectorAll('#pin-dept-pills .pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderPinManagement();
}

function renderPinManagement() {
    const tbody = document.getElementById('pin-mgmt-tbody');
    const empty = document.getElementById('pin-mgmt-empty');
    if (!tbody) return;

    const search = (document.getElementById('search-pin-mgmt')?.value || '').toLowerCase();
    const dept = state.pinDeptFilter;
    tbody.innerHTML = '';

    const filtered = state.members.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(search);
        const mDept = getMemberDept(m);
        const matchesDept = (dept === 'ALL' || mDept === dept);
        return matchesSearch && matchesDept;
    });
    
    if (filtered.length === 0) {
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    filtered.forEach(m => {
        const pinRec = state.userPins.find(p => p.memberId === m.id);
        const pinValStr = pinRec ? String(pinRec.pin).padStart(6, '0') : '';
        const pinValDisplay = pinRec ? pinValStr : '<span style="color:#ef4444">Chưa tạo</span>';
        const tr = document.createElement('tr');
        const mDept = getMemberDept(m);
        
        tr.innerHTML = `
            <td><strong>${m.name}</strong></td>
            <td><span class="version-badge">${mDept}</span></td>
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span id="pin-display-${m.id}" data-pin="${pinValStr}">${pinRec ? '••••••' : pinValDisplay}</span>
                    ${pinRec ? `<button class="btn-icon" onclick="togglePinReveal('${m.id}')" title="Hiện/Ẩn"><i class="fa-solid fa-eye" style="color:var(--text-muted)"></i></button>` : ''}
                </div>
            </td>
            <td>
                <button class="btn-secondary btn-sm" onclick="openEditPinModal('${m.id}')">
                    <i class="fa-solid fa-pen-to-square"></i> Sửa PIN
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function togglePinReveal(mId) {
    const span = document.getElementById('pin-display-' + mId);
    if (!span) return;
    const realPin = span.getAttribute('data-pin');
    if (span.innerText === '••••••') {
        span.innerText = realPin;
    } else {
        span.innerText = '••••••';
    }
}

function openEditPinModal(mId) {
    const m = state.members.find(x => x.id === mId);
    if (!m) return;

    document.getElementById('edit-pin-m-id').value = mId;
    document.getElementById('edit-pin-member-info').innerText = `Thành viên: ${m.name} (Ban ${getMemberDept(m)})`;
    document.getElementById('admin-pin-error').style.display = 'none';
    clearPinBoxes('admin-pin-edit-row');
    
    openModal('edit-pin-modal');
    setTimeout(() => {
        const firstBox = document.querySelector('#admin-pin-edit-row .pin-box');
        if (firstBox) firstBox.focus();
    }, 300);
}

function saveUserPinAdmin() {
    const mId = document.getElementById('edit-pin-m-id').value;
    const newPin = getPinValue('admin-pin-edit-row');

    if (newPin.length !== 6) {
        const err = document.getElementById('admin-pin-error');
        err.style.display = 'block';
        err.innerText = 'Vui lòng nhập đủ 6 chữ số';
        setPinError('admin-pin-edit-row');
        return;
    }

    const pinRecord = {
        memberId: mId,
        pin: newPin,
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin'
    };

    // Update local state
    const idx = state.userPins.findIndex(p => p.memberId === mId);
    if (idx !== -1) {
        state.userPins[idx] = { ...state.userPins[idx], ...pinRecord };
    } else {
        const member = state.members.find(m => m.id === mId);
        state.userPins.push({
            id: 'pin_' + Date.now(),
            name: member ? member.name : '',
            ...pinRecord
        });
    }

    // Sync
    syncToBackend('update_user_pin', pinRecord);
    
    alert('Đã cập nhật mã PIN thành công!');
    closeModal('edit-pin-modal');
    renderPinManagement();
}
