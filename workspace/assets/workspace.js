(() => {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    window.location.href = '/login.html';
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

  // Renderizar cards na tela de boas-vindas
  const grid = document.getElementById('apps-grid');
  if (grid) {
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
          const btn = document.createElement('button');
          btn.className = `btn ${link.primary ? 'primary' : 'secondary'}`;
          btn.textContent = link.label;
          btn.addEventListener('click', () => {
            loadModule(link.href);
          });
          actions.appendChild(btn);
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
  }

  // Gerenciar sidebar
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const navItems = document.querySelectorAll('.nav-item');
  const welcomeScreen = document.getElementById('welcomeScreen');
  const moduleFrame = document.getElementById('moduleFrame');

  // Toggle sidebar
  sidebarToggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('collapsed');
  });

  // Função para carregar módulo
  function loadModule(url) {
    welcomeScreen.style.display = 'none';
    moduleFrame.style.display = 'block';
    moduleFrame.src = url;
  }

  // Função para mostrar home
  function showHome() {
    welcomeScreen.style.display = 'block';
    moduleFrame.style.display = 'none';
    moduleFrame.src = '';
    
    navItems.forEach(item => item.classList.remove('active'));
    document.querySelector('[data-module="home"]')?.classList.add('active');
  }

  // Navegação da sidebar
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const module = item.dataset.module;
      
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      switch(module) {
        case 'home':
          showHome();
          break;
        case 'campanhas':
          loadModule(`${adminBase}/?token=${encodeURIComponent(token)}`);
          break;
        case 'gerador':
          loadModule(`${generatorBase}/`);
          break;
        case 'solicitacoes':
          loadModule(`${generatorBase}/src/representantes/admin.html`);
          break;
        case 'portal-rep':
          loadModule(`${generatorBase}/src/representantes/portal.html`);
          break;
        case 'configuracoes':
          loadModule(`${generatorBase}/app/settings/index.html`);
          break;
      }
    });
  });

  // Marcar home como ativo inicialmente
  document.querySelector('[data-module="home"]')?.classList.add('active');

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    window.location.href = '/login.html';
  });
})();
