(() => {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    window.location.href = '/workspace/login.html';
    return;
  }

  // Usa configuração centralizada (config.js)
  const adminBase = window.WORKSPACE_CONFIG 
    ? window.WORKSPACE_CONFIG.getBackendUrl() 
    : `${window.location.protocol}//${window.location.hostname}:5174`;
  const generatorBase = window.WORKSPACE_CONFIG 
    ? window.WORKSPACE_CONFIG.getGeradorUrl() 
    : `http://${window.location.hostname}:5173`;

  const apps = [
    {
      name: 'Gerenciador de Campanhas',
      description: 'Painel interno para administrar campanhas e portais públicos para motoristas e gráficas.',
      links: [
        { label: 'Abrir painel admin', href: `${adminBase}/?token=${encodeURIComponent(token)}`, primary: true }
      ]
    },
    {
      name: 'Gerador de Orçamentos',
      description: 'Criação de propostas com Google Slides e exportação para PDF.',
      links: [
        { label: 'Abrir gerador', href: `${generatorBase}/`, primary: true },
        { label: 'Configurações', href: `${generatorBase}/app/settings/index.html` }
      ]
    },
    {
      name: 'Novo módulo',
      description: 'Espaço reservado para futuros apps. Duplique este card e ajuste os links.',
      comingSoon: true,
      links: []
    }
  ];

  const grid = document.getElementById('apps-grid');
  if (!grid) return;

  apps.forEach((app) => {
    const card = document.createElement('article');
    card.className = 'card';
    if (app.comingSoon) {
      const soon = document.createElement('div');
      soon.className = 'soon';
      soon.textContent = 'Em breve';
      card.appendChild(soon);
    }

    const header = document.createElement('div');
    header.className = 'card-head';

    const title = document.createElement('h3');
    title.textContent = app.name;
    header.appendChild(title);

    card.appendChild(header);

    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = app.description;
    card.appendChild(desc);

    const actions = document.createElement('div');
    actions.className = 'actions';

    if (app.links && app.links.length) {
      app.links.forEach((link) => {
        const a = document.createElement('a');
        a.href = link.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = `btn ${link.primary ? 'primary' : 'secondary'}`;
        a.textContent = link.label;
        actions.appendChild(a);
      });
    } else {
      const disabled = document.createElement('span');
      disabled.className = 'btn secondary';
      disabled.setAttribute('aria-disabled', 'true');
      disabled.textContent = 'Aguardando link';
      actions.appendChild(disabled);
    }

    card.appendChild(actions);
    grid.appendChild(card);
  });

  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    window.location.href = '/workspace/login.html';
  });
})();
