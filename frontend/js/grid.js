window.createDataGrid = ({
    container,
    footer,
    searchInput,
    columns,
    pageSize = 10,
    emptyText = 'Sin registros.',
    onSelect = () => {},
}) => {
    let rows = [];
    let query = '';
    let page = 1;
    let selectedId = null;

    const normalize = (value) => String(value ?? '').toLowerCase();

    const filteredRows = () => {
        const q = query.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((row) => columns.some((col) => normalize(typeof col.value === 'function' ? col.value(row) : row[col.key]).includes(q)));
    };

    const cellValue = (column, row) => {
        if (typeof column.render === 'function') return column.render(row);
        if (typeof column.value === 'function') return column.value(row);
        const raw = row[column.key];
        return raw === undefined || raw === null || raw === '' ? '—' : raw;
    };

    const draw = () => {
        if (!container) return;
        const data = filteredRows();
        const total = data.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
        if (page > totalPages) page = totalPages;
        const start = total ? (page - 1) * pageSize : 0;
        const slice = data.slice(start, start + pageSize);
        if (!data.length) {
            container.innerHTML = `<p class="empty-state">${emptyText}</p>`;
        } else {
            container.innerHTML = `
                <div class="table-responsive data-grid-wrap">
                    <table class="table table-striped table-hover table-sm align-middle data-grid">
                        <thead class="table-light">
                            <tr>${columns.map((col) => `<th>${col.label}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
                            ${slice.map((row) => `
                                <tr data-id="${row.id}" class="${String(row.id) === String(selectedId) ? 'table-primary is-selected' : ''}">
                                    ${columns.map((col) => `<td>${cellValue(col, row)}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            container.querySelectorAll('tbody tr').forEach((tr) => {
                tr.addEventListener('click', () => {
                    selectedId = tr.dataset.id;
                    const row = rows.find((item) => String(item.id) === String(selectedId)) || null;
                    draw();
                    onSelect(row);
                });
            });
        }
        if (footer) {
            const from = total ? start + 1 : 0;
            const to = start + slice.length;
            footer.innerHTML = `
                <div class="data-grid-footer">
                    <span>Mostrando ${from}–${to} de ${total} · ${pageSize} por página</span>
                    <nav>
                        <ul class="pagination pagination-sm mb-0">
                            <li class="page-item ${page <= 1 ? 'disabled' : ''}">
                                <button type="button" class="page-link" data-grid-page="${page - 1}">Anterior</button>
                            </li>
                            <li class="page-item disabled"><span class="page-link">${page} / ${totalPages}</span></li>
                            <li class="page-item ${page >= totalPages ? 'disabled' : ''}">
                                <button type="button" class="page-link" data-grid-page="${page + 1}">Siguiente</button>
                            </li>
                        </ul>
                    </nav>
                </div>
            `;
            footer.querySelectorAll('[data-grid-page]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    page = Number(btn.dataset.gridPage);
                    draw();
                });
            });
        }
    };

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            query = searchInput.value;
            page = 1;
            draw();
        });
    }

    return {
        setRows: (nextRows) => {
            rows = Array.isArray(nextRows) ? nextRows : [];
            if (selectedId && !rows.some((row) => String(row.id) === String(selectedId))) {
                selectedId = null;
                onSelect(null);
            }
            draw();
        },
        getSelected: () => rows.find((row) => String(row.id) === String(selectedId)) || null,
        clearSelection: () => {
            selectedId = null;
            onSelect(null);
            draw();
        },
    };
};
