// Digia Core Application Logic

// --- Configurations ---
const SUPABASE_URL = 'https://xkkgbkiqhjqxthsyohqo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wdujQm6V8_Mgf1Lnm0CcOg_cJkGH3bU';

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// App State
const AppState = {
    user: null,
    profile: null
};

// --- Custom Global Loader ---
window.showLoader = (msg = 'Conectando Inteligência...') => {
    const loader = document.getElementById('global-loader');
    if (loader) {
        const txt = loader.querySelector('p');
        if (txt) txt.innerText = msg;
        loader.style.display = 'flex';
        // force reflow
        void loader.offsetWidth;
        loader.style.opacity = '1';
    }
};

window.hideLoader = () => {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 600);
    }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Determine the current page
    const path = window.location.pathname;
    const isLoginPage = path.endsWith('index.html') || path === '/' || path.endsWith('/digia/frontend/');

    // Check current auth session
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (session) {
        AppState.user = session.user;
        // Fetch profile
        try {
            const profile = await apiCall('get_profile', { id: session.user.id });
            AppState.profile = profile;

            // Sync theme from profile or local storage
            const savedTheme = profile.theme_preference || localStorage.getItem('theme');
            if (savedTheme === 'light') {
                document.body.classList.add('light-theme');
                localStorage.setItem('theme', 'light');
            } else if (savedTheme === 'dark') {
                document.body.classList.remove('light-theme');
                localStorage.setItem('theme', 'dark');
            }

            // Redirect from login if already logged in
            if (isLoginPage) {
                if (profile.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'operacional.html';
                }
            } else {
                // Initialize Header info if elements exist
                updateHeaderInfo();

                // Trigger page-specific initializers if they exist
                if (typeof window.initPage === 'function') {
                    window.initPage();
                }
            }
        } catch (e) {
            console.error('Failed to load profile', e);
            if (!isLoginPage) logout();
        }
    } else {
        // Not logged in, redirect to login if not already there
        if (!isLoginPage) {
            window.location.href = 'index.html';
        }
    }

    // Loader Reveal Check
    if (isLoginPage) {
        setTimeout(() => {
            const loader = document.getElementById('global-loader');
            const mainContent = document.getElementById('main-content');
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.style.display = 'none', 600);
            }
            if (mainContent) {
                mainContent.style.opacity = '1';
            }
        }, 800);
    }

    // Bind global logout button if exists
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Bind Sidebar Toggle
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');
    if (btnToggleSidebar) {
        btnToggleSidebar.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            const icon = document.getElementById('iconToggleSidebar');
            if (sidebar) {
                sidebar.classList.toggle('collapsed');
                if (sidebar.classList.contains('collapsed')) {
                    icon.classList.remove('ph-caret-left');
                    icon.classList.add('ph-caret-right');
                } else {
                    icon.classList.remove('ph-caret-right');
                    icon.classList.add('ph-caret-left');
                }
            }
        });
    }

    // --- Theme Toggle Injection ---
    const isLogin = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/digia/frontend/');
    if (!document.getElementById('themeToggleBtn')) {
        const themeBtn = document.createElement('button');
        themeBtn.id = 'themeToggleBtn';
        themeBtn.className = 'fixed bottom-6 right-6 w-[48px] h-[48px] min-w-[48px] min-h-[48px] rounded-full bg-slate-800 border-2 border-slate-700 text-yellow-400 flex items-center justify-center shadow-lg hover:bg-slate-700 transition-colors z-[99999]';

        const isLight = localStorage.getItem('theme') === 'light';
        if (isLight) document.body.classList.add('light-theme');
        themeBtn.innerHTML = isLight ? '<i class="ph ph-moon text-2xl text-indigo-500"></i>' : '<i class="ph ph-sun text-2xl text-yellow-400"></i>';

        themeBtn.onclick = async () => {
            document.body.classList.toggle('light-theme');
            const nowLight = document.body.classList.contains('light-theme');
            const themeStr = nowLight ? 'light' : 'dark';
            localStorage.setItem('theme', themeStr);
            themeBtn.innerHTML = nowLight ? '<i class="ph ph-moon text-2xl text-indigo-500"></i>' : '<i class="ph ph-sun text-2xl text-yellow-400"></i>';
            if (AppState && AppState.profile && AppState.profile.id) {
                try { await apiCall('update_theme_preference', { id: AppState.profile.id, theme: themeStr }); } catch (e) { console.error('Failed to save profile theme', e); }
            }
        };
        document.body.appendChild(themeBtn);
    }
});

// --- API Helper ---
/**
 * Wrapper for invoking the central Edge Function 'api'
 */
async function apiCall(action, payload = {}) {
    const { data, error } = await supabaseClient.functions.invoke('api', {
        body: { action, payload }
    });

    if (error) {
        console.error(`Edge Function Error [${action}]: `, error);
        throw new Error('Falha na comunicação com o servidor. Verifique o console.');
    }

    if (data && data.error) {
        throw new Error(data.error);
    }

    return data ? data.data : null;
}

// --- Auth Functions ---
async function login(email, password) {
    if (window.showLoader) window.showLoader('Autenticando...');

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        // Get profile to redirect accordingly
        const profile = await apiCall('get_profile', { id: data.user.id });
        if (profile.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'operacional.html';
        }
    } catch (err) {
        if (window.hideLoader) window.hideLoader();
        throw err;
    }
}

async function register(email, password, fullName) {
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName
            }
        }
    });

    if (error) {
        let msg = "Falha ao criar conta.";
        if (error.message.includes("already registered")) msg = "Este e-mail já está em uso.";
        if (error.message.includes("Password should be")) msg = "A senha deve ter no mínimo 6 caracteres.";
        throw new Error(msg);
    }

    // In Supabase, if email confirmation is required and user signed up, data.user is not null but session is null
    if (data.user && !data.session) {
        UI.toast("Verifique seu e-mail para confirmar o cadastro.", "info");
    }

    return data;
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
}

function updateHeaderInfo() {
    const elName = document.getElementById('headerUserName');
    const elRole = document.getElementById('headerUserRole');
    if (elName && AppState.profile) elName.textContent = AppState.profile.full_name || AppState.user.email;
    if (elRole && AppState.profile) {
        elRole.textContent = AppState.profile.role === 'admin' ? 'Administrador' : 'Operacional';
        // Hide Admin links if not admin
        if (AppState.profile.role !== 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        }
    }
}

// --- UI Helpers ---
const UI = {
    toast: (message, type = 'success', title = null) => {
        // Create container if it doesn't exist
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const icons = {
            success: 'ph-check-circle',
            error: 'ph-warning-circle',
            info: 'ph-info',
            warning: 'ph-warning'
        };

        const defaultTitles = {
            success: 'Sucesso',
            error: 'Erro',
            info: 'Informação',
            warning: 'Atenção'
        };

        const finalTitle = title || defaultTitles[type] || 'Aviso';
        const iconClass = icons[type] || icons.info;

        const toast = document.createElement('div');
        toast.className = `custom-toast toast-${type}`;

        toast.innerHTML = `
            <div class="toast-icon">
                <i class="ph ${iconClass}"></i>
            </div>
            <div class="toast-content">
                <h4 class="toast-title">${finalTitle}</h4>
                <p class="toast-message">${message}</p>
            </div>
            <button class="toast-close pt-1">
                <i class="ph ph-x"></i>
            </button>
        `;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Close logic
        let timeoutId;
        const closeToast = () => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 400); // match css transition
        };

        toast.querySelector('.toast-close').addEventListener('click', closeToast);

        // Auto remove
        timeoutId = setTimeout(closeToast, 4000);

        // Pause on hover
        toast.addEventListener('mouseenter', () => clearTimeout(timeoutId));
        toast.addEventListener('mouseleave', () => {
            timeoutId = setTimeout(closeToast, 2000);
        });
    },
    error: (msg) => {
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: msg,
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#4f46e5'
        });
    },
    showLoader: (btnId) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.dataset.originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="flex items-center justify-center gap-2"><div class="loader"></div> Processando...</span>`;
    },
    hideLoader: (btnId) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText || 'Confirmar';
    }
};

window.apiCall = apiCall;
window.login = login;
window.register = register;
window.logout = logout;
window.UI = UI;
window.AppState = AppState;

// --- Admin Panel Logic ---
const AdminPage = {
    data: { operacoes: [], documentos: [], tags: [] },
    currentPage: 1,
    itemsPerPage: 10,
    expandedOps: {},

    loadData: async () => {
        try {
            document.getElementById('tree-root').innerHTML = '<div class="p-8 text-center text-slate-500"><div class="loader mx-auto mb-4"></div>Carregando estrutura...</div>';

            // Load all necessary configs
            const [ops, docs, tgs] = await Promise.all([
                apiCall('get_operation_types'),
                apiCall('get_document_types'),
                apiCall('get_tags')
            ]);

            // Sort operations alphabetically by name
            const sortedOps = (ops || []).sort((a, b) => a.name.localeCompare(b.name));
            AdminPage.data.operacoes = sortedOps;
            AdminPage.data.documentos = docs || [];
            AdminPage.data.tags = tgs || [];

            // Prevent out-of-bounds pagination
            const totalPages = Math.ceil(sortedOps.length / AdminPage.itemsPerPage);
            if (AdminPage.currentPage > totalPages && totalPages > 0) {
                AdminPage.currentPage = 1;
            }

            AdminPage.renderTree();
        } catch (e) {
            UI.error('Erro ao carregar dados do servidor.');
        }
    },

    renderTree: () => {
        const root = document.getElementById('tree-root');
        if (!root) return;

        if (AdminPage.data.operacoes.length === 0) {
            root.innerHTML = `
                <div class="glass-card p-8 text-center rounded-xl border border-slate-700/50">
                    <i class="ph ph-briefcase text-4xl text-slate-500 mb-3"></i>
                    <p class="text-slate-400">Nenhuma Operação cadastrada.</p>
                </div>
            `;
            return;
        }

        let html = '';
        const start = (AdminPage.currentPage - 1) * AdminPage.itemsPerPage;
        const end = start + AdminPage.itemsPerPage;
        const currentOps = AdminPage.data.operacoes.slice(start, end);
        const totalPages = Math.ceil(AdminPage.data.operacoes.length / AdminPage.itemsPerPage);

        currentOps.forEach(op => {
            const opDocs = AdminPage.data.documentos.filter(d => d.operation_type_id === op.id);

            html += `
            <div class="glass-card rounded-xl border border-slate-700/50 overflow-hidden mb-4 transition-all">
                <!-- Operation Header -->
                <div class="admin-op-header p-4 bg-slate-800/30 flex items-center justify-between border-b border-slate-700/50 group cursor-pointer hover:bg-slate-800/50 transition-colors" onclick="window.AdminPage.toggleCollapse('${op.id}')" title="Clique para expandir/recolher conteúdos">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center border border-indigo-500/30">
                            <i class="ph ph-briefcase text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-medium text-slate-200 flex items-center gap-2 doc-title">
                                <i id="icon-op-${op.id}" class="ph ph-caret-${AdminPage.expandedOps[op.id] ? 'up' : 'down'} text-slate-500 transition-transform"></i>
                                ${op.name}
                            </h3>
                            <p class="text-xs text-slate-400">Criado em ${new Date(op.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div class="flex gap-2" onclick="event.stopPropagation()">
                        <button onclick="window.AdminPage.openOperationModal('${op.id}')" title="Editar Operação"
                                class="btn-action text-indigo-400 hover:bg-indigo-500/10 px-2 py-1 rounded"><i class="ph ph-pencil-simple text-lg"></i></button>
                        <button onclick="window.AdminPage.deleteOperation('${op.id}')" title="Excluir Operação"
                                class="btn-action text-red-400 hover:bg-red-500/10 px-2 py-1 rounded"><i class="ph ph-trash text-lg"></i></button>
                        <button onclick="window.AdminPage.openDocTypeModal('${op.id}')" 
                                class="btn-primary py-1.5 px-3 text-sm flex items-center gap-2"><i class="ph ph-plus"></i> Novo Documento</button>
                    </div>
                </div>

                <!-- Documents List -->
                <div id="collapse-op-${op.id}" class="admin-op-body p-4 bg-slate-800/10 ${AdminPage.expandedOps[op.id] ? '' : 'hidden'}">
            `;

            if (opDocs.length === 0) {
                html += `<div class="text-slate-500 text-sm ml-12 italic border-l-2 border-slate-700 pl-4 py-2 admin-line-vertical">Nenhum Documento vinculado a esta Operação.</div>`;
            } else {
                html += `<div class="space-y-3 ml-6 pl-6 border-l-2 border-slate-700/50 admin-line-vertical">`;

                opDocs.forEach(doc => {
                    const docTags = AdminPage.data.tags.filter(t => t.document_type_id === doc.id);

                    html += `
                    <div class="admin-doc-card bg-slate-800/40 rounded-lg border border-slate-700/50 p-3">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                                <i class="ph ph-file-text text-lg text-slate-400 doc-icon"></i>
                                <span class="font-medium text-slate-200 doc-title">${doc.name}</span>
                                ${doc.classification_prompt ? `<span class="px-2 py-0.5 ml-2 bg-slate-700/50 text-xs text-slate-300 rounded doc-icon" title="${doc.classification_prompt.replace(/"/g, '&quot;')}"><i class="ph ph-robot mr-1"></i> IA Prompt</span>` : ''}
                            </div>
                            <div class="flex gap-2">
                                <button onclick="window.AdminPage.openDocTypeModal('${op.id}', '${doc.id}')" title="Editar Documento"
                                        class="btn-action text-indigo-400 hover:text-indigo-300 px-1 rounded"><i class="ph ph-pencil-simple line-h"></i></button>
                                <button onclick="window.AdminPage.deleteDocType('${doc.id}')" title="Excluir Documento"
                                        class="btn-action text-red-400 hover:text-red-300 px-1 rounded"><i class="ph ph-trash line-h"></i></button>
                                <button onclick="window.AdminPage.openTagModal('${doc.id}')" 
                                        class="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors text-xs py-1 px-2 rounded flex items-center gap-1"><i class="ph ph-plus"></i> Nova Tag</button>
                            </div>
                        </div>
                        
                        <!-- Tags List -->
                        <div class="mt-2 ml-4">
                    `;

                    if (docTags.length === 0) {
                        html += `<div class="text-slate-500 text-xs italic pl-2">Nenhuma Tag vinculada.</div>`;
                    } else {
                        html += `<div class="flex flex-col gap-2 relative before:absolute before:left-[-11px] before:top-0 before:h-full before:w-px before:bg-slate-700/50 admin-line-vertical">`;
                        docTags.forEach(tag => {
                            html += `
                            <div class="admin-tag-card flex items-center justify-between bg-slate-900/50 p-2 rounded border border-slate-700/30 text-sm ml-4 relative before:absolute before:left-[-17px] before:top-1/2 before:w-4 before:h-px before:bg-slate-700/50 admin-line-horizontal">
                                <div>
                                    <span class="text-white font-medium mr-2 tag-title"><i class="ph ph-tag text-indigo-500 mr-1"></i>${tag.title}</span>
                                    <span class="text-slate-400 text-xs italic line-clamp-1 max-w-md inline-block align-middle tag-subtitle" title="${tag.analysis_prompt.replace(/"/g, '&quot;')}">${tag.analysis_prompt}</span>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="window.AdminPage.openTagModal('${doc.id}', '${tag.id}')" class="btn-action text-indigo-400 hover:text-indigo-300 rounded px-1"><i class="ph ph-pencil-simple"></i></button>
                                    <button onclick="window.AdminPage.deleteTag('${tag.id}')" class="btn-action text-red-400 hover:text-red-300 rounded px-1"><i class="ph ph-trash"></i></button>
                                </div>
                            </div>
                            `;
                        });
                        html += `</div>`;
                    }

                    html += `
                        </div>
                    </div>
                    `;
                });

                html += `</div>`;
            }

            html += `
                </div>
            </div>
            `;
        });

        if (totalPages > 1) {
            html += `
            <div class="flex justify-between items-center mt-6 p-4 glass-card rounded-xl border border-slate-700/50">
                <button class="btn-primary w-auto py-2 px-4 shadow-none bg-slate-800 border-none hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" ${AdminPage.currentPage === 1 ? 'disabled' : ''} onclick="window.AdminPage.prevPage()"><i class="ph ph-caret-left"></i> Anterior</button>
                <span class="text-slate-400 text-sm font-medium">Página ${AdminPage.currentPage} de ${totalPages}</span>
                <button class="btn-primary w-auto py-2 px-4 shadow-none bg-slate-800 border-none hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" ${AdminPage.currentPage === totalPages ? 'disabled' : ''} onclick="window.AdminPage.nextPage()">Próximo <i class="ph ph-caret-right"></i></button>
            </div>
            `;
        }

        root.innerHTML = html;
    },

    toggleCollapse: (id) => {
        AdminPage.expandedOps[id] = !AdminPage.expandedOps[id];
        const el = document.getElementById(`collapse-op-${id}`);
        const icon = document.getElementById(`icon-op-${id}`);
        if (el) {
            if (AdminPage.expandedOps[id]) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
        if (icon) {
            if (AdminPage.expandedOps[id]) { icon.classList.remove('ph-caret-down'); icon.classList.add('ph-caret-up'); }
            else { icon.classList.remove('ph-caret-up'); icon.classList.add('ph-caret-down'); }
        }
    },
    prevPage: () => { if (AdminPage.currentPage > 1) { AdminPage.currentPage--; AdminPage.renderTree(); } },
    nextPage: () => { const total = Math.ceil(AdminPage.data.operacoes.length / AdminPage.itemsPerPage); if (AdminPage.currentPage < total) { AdminPage.currentPage++; AdminPage.renderTree(); } },

    // --- CRUD OPERATION TYPES ---
    openOperationModal: async (editId = null) => {
        let op = null;
        if (editId) op = AdminPage.data.operacoes.find(o => o.id === editId);

        const { value: formValues } = await Swal.fire({
            title: editId ? 'Editar Operação' : 'Nova Operação',
            html: `
                <div class="space-y-4 text-left">
                    <div><label class="text-sm text-slate-400 mb-1 block">Nome da Operação</label>
                    <input id="swal-op-name" class="input-field" placeholder="Ex: Transporte Granel" value="${op ? op.name : ''}"></div>
                    <div><label class="text-sm text-slate-400 mb-1 block">Descrição</label>
                    <input id="swal-op-desc" class="input-field" placeholder="Opcional" value="${op && op.description ? op.description : ''}"></div>
                </div>
            `,
            background: document.body.classList.contains('light-theme') ? '#ffffff' : '#1e293b',
            color: document.body.classList.contains('light-theme') ? '#1e293b' : '#f8fafc',
            showCancelButton: true, confirmButtonText: 'Salvar', confirmButtonColor: '#3b82f6',
            preConfirm: () => {
                const name = document.getElementById('swal-op-name').value;
                if (!name) { Swal.showValidationMessage('Insira um nome.'); return false; }
                return {
                    name,
                    description: document.getElementById('swal-op-desc').value
                }
            }
        });

        if (formValues) {
            try {
                if (editId) {
                    await apiCall('update_operation_type', { id: editId, data: formValues });
                    UI.toast('Operação atualizada!');
                } else {
                    await apiCall('create_operation_type', formValues);
                    UI.toast('Operação criada!');
                }
                AdminPage.loadData();
            } catch (e) { UI.error('Erro ao salvar Operação.'); console.error(e); }
        }
    },
    deleteOperation: async (id) => {
        const { isConfirmed } = await Swal.fire({
            title: 'Excluir Operação?',
            text: "Isso apagará essa operação e TODOS os documentos e tags vinculadas a ela!",
            icon: 'warning',
            background: document.body.classList.contains('light-theme') ? '#ffffff' : '#1e293b',
            color: document.body.classList.contains('light-theme') ? '#1e293b' : '#f8fafc',
            showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sim, Excluir'
        });
        if (isConfirmed) {
            try {
                await apiCall('delete_operation_type', { id });
                UI.toast('Operação excluída.');
                AdminPage.loadData();
            } catch (e) { UI.error('Erro ao excluir.'); console.error(e); }
        }
    },

    // --- CRUD DOCUMENT TYPES ---
    openDocTypeModal: async (opId, editId = null) => {
        let doc = null;
        if (editId) doc = AdminPage.data.documentos.find(d => d.id === editId);

        const { value: formValues } = await Swal.fire({
            title: editId ? 'Editar Documento' : 'Novo Tipo de Documento',
            html: `
                <div class="space-y-4 text-left">
                    <div><label class="text-sm text-slate-400 mb-1 block">Nome do Documento</label>
                    <input id="swal-doc-name" class="input-field" placeholder="Ex: Comprovante Entrega" value="${doc ? doc.name : ''}"></div>
                    <div><label class="text-sm text-slate-400 mb-1 block">Prompt p/ Classificação IA (Opcional)</label>
                    <textarea id="swal-doc-prompt" class="input-field h-24" placeholder="Descreva como a IA deve identificar essa imagem...">${doc && doc.classification_prompt ? doc.classification_prompt : ''}</textarea></div>
                </div>
            `,
            background: document.body.classList.contains('light-theme') ? '#ffffff' : '#1e293b',
            color: document.body.classList.contains('light-theme') ? '#1e293b' : '#f8fafc',
            showCancelButton: true, confirmButtonText: 'Salvar', confirmButtonColor: '#3b82f6',
            preConfirm: () => {
                const name = document.getElementById('swal-doc-name').value;
                if (!name) { Swal.showValidationMessage('Insira um nome.'); return false; }
                return {
                    name,
                    operation_type_id: opId,
                    classification_prompt: document.getElementById('swal-doc-prompt').value
                }
            }
        });

        if (formValues) {
            try {
                if (editId) {
                    await apiCall('update_document_type', { id: editId, data: formValues });
                    UI.toast('Documento atualizado!');
                } else {
                    await apiCall('create_document_type', formValues);
                    UI.toast('Documento criado!');
                }
                AdminPage.loadData();
            } catch (e) { UI.error('Erro ao salvar Documento.'); console.error(e); }
        }
    },
    deleteDocType: async (id) => {
        const { isConfirmed } = await Swal.fire({
            title: 'Excluir Documento?',
            text: "Excluir esse tipo deletará também todas as suas Tags de Análise. Tem certeza?",
            icon: 'warning',
            background: document.body.classList.contains('light-theme') ? '#ffffff' : '#1e293b',
            color: document.body.classList.contains('light-theme') ? '#1e293b' : '#f8fafc',
            showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sim, Excluir'
        });
        if (isConfirmed) {
            try {
                await apiCall('delete_document_type', { id });
                UI.toast('Documento excluído.');
                AdminPage.loadData();
            } catch (e) { UI.error('Erro ao excluir.'); console.error(e); }
        }
    },

    // --- CRUD TAGS ---
    openTagModal: async (docId, editId = null) => {
        let tag = null;
        if (editId) tag = AdminPage.data.tags.find(t => t.id === editId);

        const { value: formValues } = await Swal.fire({
            title: editId ? 'Editar Tag de Análise' : 'Nova Tag de Análise',
            html: `
                <div class="space-y-4 text-left">
                    <div><label class="text-sm text-slate-400 mb-1 block">Título da Tag</label>
                    <input id="swal-tag-title" class="input-field" placeholder="Ex: Tem Assinatura?" value="${tag ? tag.title : ''}"></div>
                    <div><label class="text-sm text-slate-400 mb-1 block">Prompt p/ Retorno (Sim/Não)</label>
                    <textarea id="swal-tag-prompt" class="input-field h-24" placeholder="O documento possui assinatura cursiva legível no campo recebedor?">${tag ? tag.analysis_prompt : ''}</textarea></div>
                </div>
            `,
            background: document.body.classList.contains('light-theme') ? '#ffffff' : '#1e293b',
            color: document.body.classList.contains('light-theme') ? '#1e293b' : '#f8fafc',
            showCancelButton: true, confirmButtonText: 'Salvar', confirmButtonColor: '#3b82f6',
            preConfirm: () => {
                const title = document.getElementById('swal-tag-title').value;
                const analysis = document.getElementById('swal-tag-prompt').value;
                if (!title || !analysis) { Swal.showValidationMessage('Preencha título e prompt.'); return false; }
                return {
                    title,
                    document_type_id: docId,
                    analysis_prompt: analysis
                }
            }
        });

        if (formValues) {
            try {
                if (editId) {
                    await apiCall('update_tag', { id: editId, data: formValues });
                    UI.toast('Tag atualizada!');
                } else {
                    await apiCall('create_tag', formValues);
                    UI.toast('Tag criada!');
                }
                AdminPage.loadData();
            } catch (e) { UI.error('Erro ao salvar Tag.'); console.error(e); }
        }
    },
    deleteTag: async (id) => {
        const { isConfirmed } = await Swal.fire({
            title: 'Excluir Tag?',
            text: "Deseja realmente apagar esta tag de análise?",
            icon: 'warning',
            background: document.body.classList.contains('light-theme') ? '#ffffff' : '#1e293b',
            color: document.body.classList.contains('light-theme') ? '#1e293b' : '#f8fafc',
            showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sim, Excluir'
        });
        if (isConfirmed) {
            try {
                await apiCall('delete_tag', { id });
                UI.toast('Tag excluída.');
                AdminPage.loadData();
            } catch (e) { UI.error('Erro ao excluir Tag.'); console.error(e); }
        }
    }
};

window.initAdminFunctions = () => { window.AdminPage = AdminPage; };

// --- Operacional Panel Logic ---
const OperacionalPage = {
    state: {
        trips: [],
        offset: 0,
        limit: 20,
        loading: false,
        hasMore: true,
        filters: {
            dateRange: null,
            identifier: '',
            status: ''
        }
    },

    initFilters: () => {
        flatpickr("#filterDateRange", {
            mode: "range",
            dateFormat: "Y-m-d",
            maxDate: "today",
            theme: "dark",
            disableMobile: "true",
            onClose: function (selectedDates, dateStr, instance) {
                // Flatpickr allows max range. Enforce 30 day limit if selected two dates
                if (selectedDates.length === 2) {
                    const diffTime = Math.abs(selectedDates[1] - selectedDates[0]);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays > 30) {
                        UI.toast("O período máximo de busca é de 30 dias.", "warning");
                        instance.clear();
                    }
                }
            }
        });

        const statusSelect = document.getElementById('filterStatus');
        if (statusSelect) {
            new TomSelect('#filterStatus', {
                create: false,
                sortField: false,
                placeholder: 'Todos os Status',
                plugins: ['remove_button']
            });
        }

        const scrollEl = document.getElementById('mainScroll');
        if (scrollEl) {
            scrollEl.addEventListener('scroll', () => {
                if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 50) {
                    OperacionalPage.loadData(true); // Load next page
                }
            });
        }
    },

    applyFilters: () => {
        OperacionalPage.state.filters.identifier = document.getElementById('filterIdentifier').value;
        const statusSelectEl = document.getElementById('filterStatus');
        const statusVal = statusSelectEl.tomselect ? statusSelectEl.tomselect.getValue() : statusSelectEl.value;
        OperacionalPage.state.filters.status = (Array.isArray(statusVal) ? (statusVal.length ? statusVal : null) : (statusVal ? [statusVal] : null));

        const dateRaw = document.getElementById('filterDateRange').value;
        OperacionalPage.state.filters.dateRange = dateRaw ? dateRaw.split(' to ') : null;

        OperacionalPage.state.offset = 0;
        OperacionalPage.state.hasMore = true;
        OperacionalPage.state.trips = [];

        OperacionalPage.loadData(false);
    },

    clearFilters: () => {
        document.getElementById('filterIdentifier').value = '';

        const statusSelect = document.getElementById('filterStatus');
        if (statusSelect && statusSelect.tomselect) {
            statusSelect.tomselect.clear(true); // true prevents firing onChange loop
        } else if (statusSelect) {
            statusSelect.value = '';
        }

        const dateInput = document.getElementById('filterDateRange');
        if (dateInput && dateInput._flatpickr) {
            dateInput._flatpickr.clear();
        }

        OperacionalPage.applyFilters();
    },

    deleteTrip: async (id, event) => {
        event.stopPropagation();
        const { isConfirmed } = await Swal.fire({
            title: 'Excluir Viagem?',
            text: "Esta ação apagará a viagem, todos os documentos escaneados e os resultados da IA definitivamente do servidor. É irreversível.",
            icon: 'warning',
            background: document.body.classList.contains('light-theme') ? '#ffffff' : '#1e293b',
            color: document.body.classList.contains('light-theme') ? '#1e293b' : '#f8fafc',
            showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sim, Apagar Tudo'
        });
        if (isConfirmed) {
            if (window.showLoader) window.showLoader("Apagando registros e arquivos...");
            try {
                await apiCall('delete_trip', { id });
                UI.toast('Viagem e arquivos excluídos com sucesso.');
                OperacionalPage.applyFilters(); // refresh table
            } catch (e) {
                UI.error('Erro ao excluir viagem.');
                console.error(e);
            } finally {
                if (window.hideLoader) window.hideLoader();
            }
        }
    },

    loadData: async (isPagination = false) => {
        if (OperacionalPage.state.loading || !OperacionalPage.state.hasMore) return;

        OperacionalPage.state.loading = true;
        const loaderRow = document.getElementById('loader-row');
        if (loaderRow) loaderRow.classList.remove('hidden');

        try {
            const payload = {
                limit: OperacionalPage.state.limit,
                offset: OperacionalPage.state.offset,
                identifier: OperacionalPage.state.filters.identifier,
                status: OperacionalPage.state.filters.status
            };

            if (OperacionalPage.state.filters.dateRange && OperacionalPage.state.filters.dateRange.length === 2) {
                payload.start_date = OperacionalPage.state.filters.dateRange[0];
                payload.end_date = OperacionalPage.state.filters.dateRange[1];
            } else if (OperacionalPage.state.filters.dateRange && OperacionalPage.state.filters.dateRange.length === 1) {
                payload.start_date = OperacionalPage.state.filters.dateRange[0];
                payload.end_date = OperacionalPage.state.filters.dateRange[0];
            }

            const res = await apiCall('get_filtered_trips', payload);

            if (res.length < OperacionalPage.state.limit) {
                OperacionalPage.state.hasMore = false;
            }

            if (isPagination) {
                OperacionalPage.state.trips = [...OperacionalPage.state.trips, ...res];
            } else {
                OperacionalPage.state.trips = res;
            }

            OperacionalPage.state.offset += res.length;
            OperacionalPage.renderTrips(OperacionalPage.state.trips);

            // Update Stats to show currently loaded count (In large scales, a separate COUNT() RPC would be needed to show "Total Ever")
            const stats = document.getElementById('statsTotal');
            if (stats && !isPagination && OperacionalPage.state.filters.identifier === '' && OperacionalPage.state.filters.status === '' && !OperacionalPage.state.filters.dateRange) {
                // Fake a generic number or show listed
                stats.innerText = OperacionalPage.state.trips.length + (OperacionalPage.state.hasMore ? '+' : '');
            }
        } catch (e) {
            UI.error('Erro ao carregar viagens.');
            console.error(e);
        } finally {
            OperacionalPage.state.loading = false;
            if (loaderRow) loaderRow.classList.add('hidden');
        }
    },

    renderTrips: (trips) => {
        const tbody = document.getElementById('table-trips');
        const emptyState = document.getElementById('empty-state');
        if (!tbody || !emptyState) return;

        if (trips.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            tbody.innerHTML = trips.map(t => {
                const docs = t.documents_json || [];
                const expectedTypes = t.expected_docs_count || 0;
                const uniqueTypesIdentified = t.unique_docs_collected || 0;

                const isComplete = uniqueTypesIdentified >= expectedTypes && expectedTypes > 0;

                const approved = docs.filter((d) => {
                    if (d.status !== 'identified') return false;
                    return !d.tag_results || d.tag_results.length === 0 || d.tag_results.every((tr) => tr.result_boolean);
                }).length;
                const manual = docs.filter((d) => {
                    if (d.status !== 'identified') return false;
                    return d.tag_results && d.tag_results.some((tr) => !tr.result_boolean);
                }).length;
                const pending = docs.filter((d) => d.status === 'pending').length;
                const failed = docs.filter((d) => d.status === 'failed').length;

                let statusHtml = `<div class="flex flex-col gap-1">`;
                if (expectedTypes > 0) {
                    statusHtml += `<div class="flex items-center gap-1 text-xs font-medium ${isComplete ? 'text-green-400' : 'text-slate-400'}"><i class="ph ${isComplete ? 'ph-check-circle' : 'ph-circle-dashed'} text-sm"></i> ${uniqueTypesIdentified}/${expectedTypes} Tipos Coletados</div>`;
                } else {
                    statusHtml += `<div class="text-xs text-slate-500 italic">Sem configuração de tipos</div>`;
                }

                if (docs.length > 0) {
                    statusHtml += `<div class="flex flex-wrap gap-1.5 text-[10px] mt-1">`;
                    if (approved) statusHtml += `<span class="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20" title="Aprovados">${approved} OK</span>`;
                    if (manual) statusHtml += `<span class="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" title="Revisão Manual">${manual} Rev</span>`;
                    if (pending) statusHtml += `<span class="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" title="Analisando">${pending} IA</span>`;
                    if (failed) statusHtml += `<span class="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20" title="Falhas">${failed} Err</span>`;
                    statusHtml += `</div>`;
                } else {
                    statusHtml += `<div class="text-[10px] text-slate-600">Nenhum anexo</div>`;
                }
                statusHtml += `</div>`;

                const isAdmin = AppState.profile && AppState.profile.role === 'admin';
                const deleteHtml = isAdmin ? `<button onclick="window.OperacionalPage.deleteTrip('${t.id}', event)" class="mr-2 text-red-400 hover:text-red-300 px-3 py-1.5 bg-red-500/10 rounded-lg text-sm font-medium inline-flex items-center transition-all opacity-0 group-hover:opacity-100" title="Excluir"><i class="ph ph-trash"></i></button>` : '';

                return `
                <tr class="hover:bg-slate-800/80 transition-colors cursor-pointer group" onclick="window.location.href='trip.html?id=${t.id}'">
                    <td class="p-4 pl-6 text-slate-300 text-sm whitespace-nowrap"><i class="ph ph-calendar-blank text-slate-500 mr-2"></i>${new Date(t.trip_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                    <td class="p-4 font-medium text-white group-hover:text-indigo-400 transition-colors">${t.identifier}</td>
                    <td class="p-4 text-slate-400 text-sm"><span class="px-2 py-1 bg-slate-800 rounded text-xs border border-slate-700">${t.operation_type_name || '-'}</span></td>
                    <td class="p-4 text-slate-400 text-sm">${t.created_by_name || '-'}</td>
                    <td class="p-4">${statusHtml}</td>
                    <td class="p-4 text-right pr-6 flex justify-end items-center">
                        ${deleteHtml}
                        <button class="text-indigo-400 hover:text-indigo-300 px-3 py-1.5 bg-indigo-500/10 rounded-lg text-sm font-medium inline-flex items-center group-hover:bg-indigo-500 group-hover:text-white transition-all"><i class="ph ph-eye mr-2"></i> Ver Detalhes</button>
                    </td>
                </tr>
                `
            }).join('');
        }
    },



    openNewTripModal: async () => {
        const ops = await apiCall('get_operation_types');
        const optionsHtml = ops.map(o => `<option value="${o.id}">${o.name}</option>`).join('');

        const { value: formValues } = await Swal.fire({
            title: 'Criar Nova Viagem',
            html: `
                <div class="space-y-4 text-left">
                    <div><label class="text-sm text-slate-400 mb-1 block">Tipo de Operação</label>
                    <select id="swal-trip-op">
                        <option value="" disabled selected>Selecione...</option>
                        ${optionsHtml}
                    </select></div>
                    
                    <div><label class="text-sm text-slate-400 mb-1 block">Identificador (Ex: Placa, Rota)</label>
                    <input id="swal-trip-id" class="input-field" placeholder="Ex: AXE-9023"></div>
                    
                    <div><label class="text-sm text-slate-400 mb-1 block">Data da Viagem</label>
                    <input id="swal-trip-date" class="input-field" placeholder="Selecione a data"></div>
                </div>
            `,
            background: document.body.classList.contains('light-theme') ? '#ffffff' : '#1e293b',
            color: document.body.classList.contains('light-theme') ? '#1e293b' : '#f8fafc',
            showCancelButton: true, confirmButtonText: 'Continuar', confirmButtonColor: '#4f46e5',
            didOpen: () => {
                new TomSelect('#swal-trip-op', {
                    create: false,
                    sortField: false
                });
                flatpickr("#swal-trip-date", { dateFormat: "Y-m-d", defaultDate: "today", disableMobile: "true" });
            },
            preConfirm: () => {
                const opId = document.getElementById('swal-trip-op').value;
                const ident = document.getElementById('swal-trip-id').value;
                const dt = document.getElementById('swal-trip-date').value;
                if (!opId || !ident || !dt) { Swal.showValidationMessage('Preencha todos os campos.'); return false; }
                return { operation_type_id: opId, identifier: ident, trip_date: dt };
            }
        });

        if (formValues) {
            try {
                const newTrip = await apiCall('create_trip', formValues);
                UI.toast('Viagem criada com sucesso!');
                window.location.href = `trip.html?id=${newTrip.id}`;
            } catch (e) { UI.error('Erro ao criar viagem.'); }
        }
    }
};

// --- Modal Helper Methods ---
window.openImageModal = (url) => {
    const modal = document.getElementById('imageModal');
    const modalContent = document.getElementById('imageModalContent');
    const modalImg = document.getElementById('modalImg');

    if (modal && modalImg && modalContent) {
        modalImg.src = url;
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }
};

window.closeImageModal = () => {
    const modal = document.getElementById('imageModal');
    const modalContent = document.getElementById('imageModalContent');
    const modalImg = document.getElementById('modalImg');

    if (modal && modalContent) {
        modalContent.classList.remove('scale-100');
        modalContent.classList.add('scale-95');
        modal.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => { if (modalImg) modalImg.src = ''; }, 300); // clear after animation
    }
};

window.openTagHistoryModal = (tagResultId, currentStatus, tagTitle, aiResponse, historyJson) => {
    const modal = document.getElementById('tagHistoryModal');
    const modalContent = document.getElementById('tagHistoryModalContent');

    if (modal && modalContent) {
        document.getElementById('tagModalIdStore').innerText = tagResultId;
        document.getElementById('tagModalCurrentValStore').innerText = currentStatus;
        document.getElementById('tagModalTitle').innerText = tagTitle;
        document.getElementById('tagModalAIResponse').innerText = aiResponse || 'Sem resposta crua';

        let timelineHtml = `<div class="text-xs text-slate-500 italic">Nenhum histórico de edições manuais encontrado.</div>`;
        const history = historyJson ? JSON.parse(decodeURIComponent(historyJson)) : [];
        if (history.length > 0) {
            timelineHtml = history.map(h => `
                <div class="flex gap-3 text-sm">
                    <div class="flex flex-col items-center">
                        <div class="w-2 h-2 rounded-full bg-slate-500 mt-1.5"></div>
                        <div class="w-px h-full bg-slate-700 my-1"></div>
                    </div>
                    <div class="bg-slate-800/50 p-3 rounded-lg flex-1 border border-slate-700/50">
                        <div class="flex justify-between items-start mb-1">
                            <span class="font-medium text-slate-300"><i class="ph ph-user mr-1"></i>${h.user_name}</span>
                            <span class="text-[10px] text-slate-500">${new Date(h.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="text-xs text-slate-400 mb-2">
                            Transformou: <strong class="${h.old_status ? 'text-green-500' : 'text-red-500'}">${h.old_status ? 'Aprovado' : 'Rejeitado'}</strong> para <strong class="${h.new_status ? 'text-green-500' : 'text-red-500'}">${h.new_status ? 'Aprovado' : 'Rejeitado'}</strong>
                        </div>
                        <div class="text-slate-300 italic">"${h.justification}"</div>
                    </div>
                </div>
            `).join('');
        }
        document.getElementById('tagModalTimeline').innerHTML = timelineHtml;

        const newStatus = !currentStatus;
        const newStatusStr = newStatus ? '<span class="text-green-400">Aprovar</span>' : '<span class="text-red-400">Reprovar</span>';
        document.getElementById('tagModalActionTitle').innerHTML = `Justifique a decisão para: ${newStatusStr}`;

        const justInput = document.getElementById('tagModalJustification');
        justInput.value = '';
        justInput.focus();

        modal.classList.remove('opacity-0', 'pointer-events-none');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }
};

window.closeTagHistoryModal = () => {
    const modal = document.getElementById('tagHistoryModal');
    const modalContent = document.getElementById('tagHistoryModalContent');
    if (modal && modalContent) {
        modalContent.classList.remove('scale-100');
        modalContent.classList.add('scale-95');
        modal.classList.add('opacity-0', 'pointer-events-none');
    }
};

window.saveTagHistory = async () => {
    const id = document.getElementById('tagModalIdStore').innerText;
    const currentValStr = document.getElementById('tagModalCurrentValStore').innerText;
    const justStr = document.getElementById('tagModalJustification').value.trim();
    if (!justStr) {
        UI.toast('Uma justificativa para esta alteração é obrigatória.', 'warning');
        return;
    }

    document.getElementById('tagModalSaveBtn').disabled = true;
    try {
        const newStatus = currentValStr !== 'true'; // Inverts current boolean
        const userProf = AppState.profile ? AppState.profile.full_name : AppState.user.email;

        UI.toast(`Salvando...`, 'info', 1000);
        await apiCall('update_tag_result', {
            id: id,
            result_boolean: newStatus,
            manually_verified: true,
            justification: justStr,
            user_name: userProf
        });
        UI.toast('Situação e Histórico salvos com sucesso!', 'success');
        window.closeTagHistoryModal();
        if (window.TripPage) window.TripPage.loadData();
    } catch (e) {
        console.error('Failed to save tag history:', e);
        UI.toast('Erro ao gravar alteração da Tag.', 'error');
    } finally {
        document.getElementById('tagModalSaveBtn').disabled = false;
    }
};

window.setTripTab = (tabId) => {
    if (window.TripPage) {
        window.TripPage.activeTab = tabId;
        window.TripPage.renderDocuments();
    }
};

window.confirmDeleteDoc = (docId) => {
    Swal.fire({
        title: 'Excluir documento?',
        text: "Esta ação é irreversível e removerá todos os dados e resultados de análise associados a ele.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#475569',
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                UI.toast('Excluindo...', 'info', 1000);
                await apiCall('delete_document', { document_id: docId });
                UI.toast('Documento excluído com sucesso!', 'success');
                if (window.TripPage) window.TripPage.loadData();
            } catch (e) {
                console.error("Failed to delete document", e);
                UI.toast('Falha ao excluir o documento.', 'error');
            }
        }
    });
};

window.initOperacionalFunctions = () => {
    window.OperacionalPage = OperacionalPage;
    window.TripPage = TripPage;
};

// --- Trip Page Logic ---
const TripPage = {
    tripId: null,
    data: null,
    analyzingDocs: new Set(),
    analysisQueue: [],
    isProcessingQueue: false,
    activeTab: 'all',

    init: async (tripId) => {
        TripPage.tripId = tripId;
        await TripPage.loadData();
        TripPage.setupDropzone();
    },

    queueAIAnalysis: (docId, opId) => {
        TripPage.analyzingDocs.add(docId);
        TripPage.analysisQueue.push({ docId, opId });
        if (TripPage.data) {
            TripPage.renderDocuments(); // Update DOM instantly to show spinners
        }
        if (!TripPage.isProcessingQueue) {
            TripPage.processQueue();
        }
    },

    processQueue: async () => {
        if (TripPage.analysisQueue.length === 0) {
            TripPage.isProcessingQueue = false;
            return;
        }

        TripPage.isProcessingQueue = true;
        // Parallel arrays of 2 to speed things up without blocking
        const batch = TripPage.analysisQueue.splice(0, 2);

        await Promise.allSettled(batch.map(async (task) => {
            try {
                await apiCall('process_document_vision', { document_id: task.docId, operation_type_id: task.opId });
            } catch (e) {
                console.error('AI Analysis failed:', e);
                UI.toast('Falha ao processar documento', 'error');
            } finally {
                TripPage.analyzingDocs.delete(task.docId);
            }
        }));

        await TripPage.loadData();
        TripPage.processQueue(); // recursively process next batch
    },


    loadData: async () => {
        try {
            const res = await apiCall('get_trip_details', { id: TripPage.tripId });
            TripPage.data = res;

            // Update Header
            document.getElementById('tripIdentifier').innerText = res.trip.identifier;
            document.getElementById('tripMetadata').innerHTML = `<i class="ph ph-calendar-blank mr-1"></i> ${new Date(res.trip.trip_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })} &nbsp;•&nbsp; <i class="ph ph-tag mr-1"></i> ${res.trip.operation_types?.name}`;

            TripPage.renderDocuments();
        } catch (e) {
            UI.error('Erro ao carregar detalhes da viagem.');
        }
    },

    renderDocuments: () => {
        const docs = TripPage.data.documents || [];
        document.getElementById('docCount').innerText = `${docs.length} enviado(s)`;
        const list = document.getElementById('documentsList');

        if (docs.length === 0) {
            document.getElementById('documentTabs').innerHTML = '';
            list.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                    <i class="ph ph-file-dashed text-6xl mb-4 opacity-50"></i>
                    <p>Nenhum documento anexado ainda.</p>
                </div>
            `;
            return;
        }

        // Generate Tabs UI
        const docTypesMap = new Map();
        let unclassifiedCount = 0;

        docs.forEach(d => {
            if (d.identified_doc_type_id) {
                if (!docTypesMap.has(d.identified_doc_type_id)) {
                    docTypesMap.set(d.identified_doc_type_id, { name: d.document_types.name, count: 1 });
                } else {
                    docTypesMap.get(d.identified_doc_type_id).count++;
                }
            } else {
                unclassifiedCount++;
            }
        });

        const activeClass = 'bg-slate-700 text-white font-medium border-slate-500 shadow-sm';
        const inactiveClass = 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-300 transition-colors';

        let tabsHtml = `<button onclick="window.setTripTab('all')" class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm border ${TripPage.activeTab === 'all' ? activeClass : inactiveClass}">Todos (${docs.length})</button>`;

        docTypesMap.forEach((val, key) => {
            tabsHtml += `<button onclick="window.setTripTab('${key}')" class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm border ${TripPage.activeTab === key ? activeClass : inactiveClass}">${val.name} (${val.count})</button>`;
        });

        if (unclassifiedCount > 0) {
            tabsHtml += `<button onclick="window.setTripTab('unclassified')" class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm border ${TripPage.activeTab === 'unclassified' ? activeClass : inactiveClass}">Não Classificados (${unclassifiedCount})</button>`;
        }

        document.getElementById('documentTabs').innerHTML = tabsHtml;

        // Filter Docs
        let filteredDocs = docs;
        if (TripPage.activeTab !== 'all') {
            if (TripPage.activeTab === 'unclassified') {
                filteredDocs = docs.filter(d => !d.identified_doc_type_id);
            } else {
                filteredDocs = docs.filter(d => d.identified_doc_type_id === TripPage.activeTab);
            }
        }

        if (filteredDocs.length === 0) {
            list.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                    <p>Nenhum documento nesta categoria.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = filteredDocs.map(d => {
            const isAnalyzing = TripPage.analyzingDocs.has(d.id);
            const docName = d.storage_path ? d.storage_path.split('-').pop() : 'documento.jpg';

            // Compute Situational Status logically instead of from DB 'status'
            let computedSituation = d.status; // pending, identified, failed
            if (computedSituation === 'identified') {
                if (d.tag_results && d.tag_results.length > 0) {
                    const hasFalseTag = d.tag_results.some(t => !t.result_boolean);
                    computedSituation = hasFalseTag ? 'manual_review' : 'approved';
                } else {
                    computedSituation = 'approved';
                }
            }

            let statusClass = 'px-2 py-1 bg-slate-800 text-slate-400 border-slate-700';
            let statusIcon = 'ph-hourglass';
            let uiString = 'Pendente';
            let tooltipText = 'Aguardando processamento';

            if (computedSituation === 'approved') {
                statusClass = 'bg-green-500/20 text-green-400 border border-green-500/40 text-xs px-2 py-1 rounded-md font-medium';
                statusIcon = 'ph-check-circle text-sm';
                tooltipText = 'Todas as tags foram aprovadas';
                uiString = 'Aprovado';
            } else if (computedSituation === 'manual_review') {
                statusClass = 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/40 text-xs px-2 py-1 rounded-md font-medium';
                statusIcon = 'ph-warning-circle text-sm';
                tooltipText = 'Uma ou mais tags foram reprovadas';
                uiString = 'Revisão Manual';
            } else if (computedSituation === 'failed') {
                statusClass = 'bg-red-500/20 text-red-500 border border-red-500/40 text-xs px-2 py-1 rounded-md font-medium';
                statusIcon = 'ph-warning text-sm';
                tooltipText = 'Documento não reconhecido';
                uiString = 'Falha';
            }

            let iconBoxClass = computedSituation === 'approved' ? 'text-green-400 border-green-500/30' : (computedSituation === 'manual_review' ? 'text-yellow-500 border-yellow-500/30' : (computedSituation === 'failed' ? 'text-red-500 border-red-500/30' : 'text-slate-500 border-slate-700'));
            let iconBoxIcon = statusIcon;

            // Status (AI Processing Status)
            let processStatusString = d.identified_doc_type_id ? 'Analisado pela IA' : (d.status === 'failed' ? 'Não classificado' : 'Aguardando processamento');
            let processStatusIcon = d.identified_doc_type_id ? 'ph-robot' : 'ph-hourglass';
            let processStatusHtml = `<div class="text-[10px] text-slate-500 flex items-center gap-1 justify-end"><i class="ph ${processStatusIcon}"></i> Status: ${processStatusString}</div>`;

            if (isAnalyzing) {
                statusClass = 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50 text-xs px-2 py-1 rounded-md font-medium';
                statusIcon = 'ph-spinner-gap animate-spin text-sm';
                tooltipText = 'IA em analise de tipo';
                uiString = 'Analisando...';

                iconBoxClass = 'text-indigo-400 border-indigo-500/30';
                iconBoxIcon = 'ph-spinner-gap animate-spin';
                processStatusHtml = `<div class="text-[10px] text-indigo-400 flex items-center gap-1 justify-end"><i class="ph ph-spinner-gap animate-spin"></i> Status: Em processamento...</div>`;
            }

            let tagsHtml = '';
            if (d.tag_results && d.tag_results.length > 0) {
                tagsHtml = `<div class="mt-3 flex flex-wrap gap-2 text-xs">` +
                    d.tag_results.map(tag => {
                        const verifiedClass = tag.manually_verified ? 'ring-2 ring-yellow-500/50 relative' : '';
                        const verifiedIcon = tag.manually_verified ? `<div class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center text-[8px] text-black" title="Revisado Manualmente"><i class="ph-fill ph-user"></i></div>` : '';
                        const historyJson = encodeURIComponent(JSON.stringify(tag.verification_history || []));

                        return `
                        <button onclick="window.openTagHistoryModal('${tag.id}', ${tag.result_boolean}, '${tag.tags?.title.replace(/'/g, "\\'")}', '${(tag.raw_ai_response || '').replace(/'/g, "\\'")}', '${historyJson}')" class="px-2 py-1 rounded border overflow-visible truncate max-w-[200px] hover:opacity-80 transition-opacity flex items-center ${tag.result_boolean ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'} ${verifiedClass}" title="Clique para inverter. Resposta Original: ${tag.raw_ai_response || ''}">
                            <i class="ph ${tag.result_boolean ? 'ph-check' : 'ph-x'} mr-1"></i>${tag.tags?.title || tag.tag_id.substring(0, 4)}
                            ${verifiedIcon}
                        </button>
                    `}).join('') + `</div>`;
            }

            return `
                <div class="glass-card p-4 rounded-xl border border-slate-700/50 doc-card relative group">
                    <div class="absolute inset-0 z-0 bg-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/40 pointer-events-none rounded-xl"></div>
                    
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[70%] z-20 flex gap-4 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1/2 transition-all duration-300 pointer-events-auto">
                        <button onclick="window.openImageModal('${d.file_url}')" class="w-12 h-12 bg-indigo-600 hover:bg-indigo-500 rounded-full text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-colors" title="Visualizar Documento">
                            <i class="ph ph-eye text-xl"></i>
                        </button>
                        <button onclick="window.confirmDeleteDoc('${d.id}')" class="w-12 h-12 bg-red-600/90 hover:bg-red-500 rounded-full text-white shadow-lg shadow-red-500/30 flex items-center justify-center transition-colors" title="Excluir Documento">
                            <i class="ph ph-trash text-xl"></i>
                        </button>
                    </div>

                    <div class="relative z-10 flex items-start justify-between pointer-events-none transition-all duration-300">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center border ${iconBoxClass}">
                                <i class="ph ${iconBoxIcon} text-2xl"></i>
                            </div>
                            <div>
                                <h4 class="text-sm font-medium text-slate-200 truncate w-40 lg:w-48" title="${docName}">${docName}</h4>
                                <div class="text-xs font-medium mt-1 mb-1 text-slate-300">${d.document_types?.name || (isAnalyzing ? 'Aguardando IA...' : 'Não classificado')}</div>
                                <div class="text-[10px] text-slate-500">${new Date(d.created_at).toLocaleString()}</div>
                            </div>
                        </div>
                        <div class="text-right flex flex-col items-end pointer-events-auto gap-1">
                            <span class="${statusClass} flex items-center gap-1 cursor-help" title="${tooltipText}">
                                <i class="ph ${statusIcon}"></i> ${uiString}
                            </span>
                            ${processStatusHtml}
                        </div>
                    </div>
                    <div class="relative z-10 pointer-events-auto transition-all duration-300">
                        ${tagsHtml}
                    </div>
                </div>
            `;
        }).join('');
    },

    setupDropzone: () => {
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('fileInput');
        if (!dropzone) return;

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                TripPage.handleFiles(e.dataTransfer.files);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) {
                TripPage.handleFiles(fileInput.files);
            }
        });
    },

    handleFiles: async (files) => {
        UI.toast(`Enviando ${files.length} arquivo(s)...`, 'info');

        let successCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2, 15)}-${Date.now()}.${fileExt}`;
            const filePath = `${TripPage.tripId}/${fileName}`;

            try {
                const { error: uploadError } = await supabaseClient.storage
                    .from('documents')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabaseClient.storage.from('documents').getPublicUrl(filePath);

                const newDoc = await apiCall('create_document', {
                    trip_id: TripPage.tripId,
                    file_url: urlData.publicUrl,
                    storage_path: filePath,
                    status: 'pending'
                });

                successCount++;

                // Track analysis immediately via Queue
                TripPage.queueAIAnalysis(newDoc.id, TripPage.data.trip.operation_type_id);

            } catch (e) {
                console.error('File upload error', e);
                UI.error(`Erro ao enviar o arquivo: ${file.name}`);
            }
        }

        if (successCount > 0) {
            UI.toast(`${successCount} arquivos processados com sucesso!`);
            TripPage.loadData();
        }

        document.getElementById('fileInput').value = '';
    }
};

window.initTripFunctions = (tripId) => { window.TripPage = TripPage; TripPage.init(tripId); };
