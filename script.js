document.addEventListener('DOMContentLoaded', () => {
    // === CONFIGURAÇÃO SUPABASE - SEUS DADOS REAIS ===
    const supabaseUrl = 'https://brrkgsmvyalxeknrdsqm.supabase.co';
    const supabaseKey = 'sb_publishable_i8agnGLp1kfs4g7zrC8Z9g_XvZ7bzPN';
    const supabase = Supabase.createClient(supabaseUrl, supabaseKey);

    // Elementos DOM
    const itemForm       = document.getElementById('item-form');
    const desc           = document.getElementById('description');
    const dateEl         = document.getElementById('date');
    const priorityEl     = document.getElementById('priority');
    const catEl          = document.getElementById('category');
    const detailsEl      = document.getElementById('details');
    const detailsGroup   = document.getElementById('details-group');
    const itemList       = document.getElementById('item-list');
    const completedList  = document.getElementById('completed-list');
    const addBtn         = document.getElementById('add-btn');
    const cancelBtn      = document.getElementById('cancel-btn');
    const search         = document.getElementById('search');
    const themeToggle    = document.getElementById('theme-toggle');
    const categoryItems  = document.querySelectorAll('#category-list li');

    let items = [];
    let editingId = null;
    let currentFilter = 'all';

    // Carrega tarefas do Supabase
    async function loadItems() {
        try {
            const { data, error } = await supabase
                .from('tarefas')
                .select('*')
                .order('date', { ascending: true });

            if (error) throw error;
            items = data || [];
            render();
        } catch (err) {
            console.error('Erro ao carregar tarefas:', err.message);
            alert('Não foi possível carregar as tarefas. Verifique:\n1. Conexão com internet\n2. Tabela "tarefas" existe no Supabase\n3. Policies permitem acesso público\n\nErro: ' + err.message);
        }
    }

    loadItems();

    // Tema
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.innerHTML = savedTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

    themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeToggle.innerHTML = newTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });

    window.toggleDetailsField = () => {
        detailsGroup.style.display = catEl.value === 'tcc' ? 'block' : 'none';
        if (catEl.value !== 'tcc') detailsEl.value = '';
    };

    function render(filter = 'all', searchTerm = '') {
        currentFilter = filter;
        itemList.innerHTML = '';
        completedList.innerHTML = '';

        let filtered = items.filter(item => {
            if (filter !== 'all' && item.category !== filter) return false;
            if (searchTerm && !item.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });

        filtered.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            const prioOrder = { alta: 0, media: 1, baixa: 2 };
            const prioDiff = prioOrder[a.priority] - prioOrder[b.priority];
            if (prioDiff !== 0) return prioDiff;
            return new Date(a.date) - new Date(b.date);
        });

        filtered.forEach(item => {
            let extraButton = '';
            if (item.category === 'tcc' && item.details) {
                extraButton = `<button onclick="showDetailsModal('${item.id}')"><i class="fas fa-info-circle"></i> Mais sobre a tarefa</button>`;
            }

            const li = document.createElement('li');
            li.className = `item ${item.completed ? 'completed' : ''}`;
            li.draggable = !item.completed;

            li.innerHTML = `
                <div class="priority-dot priority-${item.priority}"></div>
                <div style="flex:1">
                    <strong>${item.description}</strong>
                    <div style="margin-top:0.3rem; color:var(--text-light); font-size:0.9rem;">
                        ${new Date(item.date).toLocaleDateString('pt-BR', {day:'2-digit', month:'short', year:'numeric'})} 
                        • ${item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                    </div>
                </div>
                <span class="category-tag ${item.category}">${item.category.toUpperCase()}</span>
                <div class="actions">
                    ${extraButton}
                    <button onclick="toggleComplete('${item.id}')"><i class="fas ${item.completed ? 'fa-undo' : 'fa-check'}"></i></button>
                    <button onclick="editItem('${item.id}')"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteItem('${item.id}')"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;

            (item.completed ? completedList : itemList).appendChild(li);
        });

        updateCounters();
        document.getElementById('completed-count').textContent = completedList.children.length;
    }

    function updateCounters() {
        const counts = { all:0, provas:0, tarefas:0, trabalhos:0, tcc:0 };
        items.forEach(item => {
            if (!item.completed) counts[item.category]++;
        });
        counts.all = items.filter(i => !i.completed).length;

        document.querySelectorAll('#category-list .count').forEach(el => {
            const cat = el.parentElement.dataset.category;
            el.textContent = counts[cat] || 0;
        });
    }

    itemForm.addEventListener('submit', async e => {
        e.preventDefault();
        const newItem = {
            description: desc.value.trim(),
            date: dateEl.value,
            priority: priorityEl.value,
            category: catEl.value,
            details: catEl.value === 'tcc' ? detailsEl.value.trim() : '',
            completed: false
        };

        try {
            let error;
            if (editingId) {
                ({ error } = await supabase.from('tarefas').update(newItem).eq('id', editingId));
                editingId = null;
            } else {
                ({ error } = await supabase.from('tarefas').insert([newItem]));
            }

            if (error) throw error;
            await loadItems();
        } catch (err) {
            console.error('Erro ao salvar:', err.message);
            alert('Erro ao salvar tarefa: ' + err.message + '\nVerifique o console (F12).');
        }

        itemForm.style.display = 'none';
        itemForm.reset();
        detailsGroup.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
        itemForm.style.display = 'none';
        itemForm.reset();
        detailsGroup.style.display = 'none';
        editingId = null;
    });

    addBtn.addEventListener('click', () => {
        editingId = null;
        itemForm.style.display = 'block';
        toggleDetailsField();
    });

    window.toggleComplete = async id => {
        try {
            const item = items.find(i => i.id === id);
            if (!item) return;
            const { error } = await supabase.from('tarefas').update({ completed: !item.completed }).eq('id', id);
            if (error) throw error;
            await loadItems();
        } catch (err) {
            console.error(err);
        }
    };

    window.editItem = id => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        editingId = id;
        desc.value = item.description;
        dateEl.value = item.date;
        priorityEl.value = item.priority;
        catEl.value = item.category;
        detailsEl.value = item.details || '';
        itemForm.style.display = 'block';
        toggleDetailsField();
    };

    window.deleteItem = async id => {
        if (!confirm('Deseja realmente excluir esta tarefa?')) return;
        try {
            const { error } = await supabase.from('tarefas').delete().eq('id', id);
            if (error) throw error;
            await loadItems();
        } catch (err) {
            console.error(err);
            alert('Erro ao excluir: ' + err.message);
        }
    };

    window.showDetailsModal = id => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        document.getElementById('modal-title').textContent = item.description;
        document.getElementById('modal-date').textContent = new Date(item.date).toLocaleDateString('pt-BR');
        document.getElementById('modal-priority').textContent = item.priority.charAt(0).toUpperCase() + item.priority.slice(1);
        document.getElementById('modal-category').textContent = item.category.toUpperCase();
        document.getElementById('modal-details-content').innerHTML = item.details ? item.details.replace(/\n/g, '<br>') : '<em>Sem detalhes adicionais.</em>';
        document.getElementById('details-modal').style.display = 'block';
    };

    window.closeModal = () => {
        document.getElementById('details-modal').style.display = 'none';
    };

    window.onclick = event => {
        const modal = document.getElementById('details-modal');
        if (event.target === modal) modal.style.display = 'none';
    };

    categoryItems.forEach(li => {
        li.addEventListener('click', () => {
            categoryItems.forEach(i => i.classList.remove('active'));
            li.classList.add('active');
            render(li.dataset.category, search.value);
        });
    });

    search.addEventListener('input', () => render(currentFilter, search.value));

    new Sortable(itemList, {
        animation: 150,
        handle: '.item',
        filter: '.completed',
        onEnd: () => loadItems()
    });
});