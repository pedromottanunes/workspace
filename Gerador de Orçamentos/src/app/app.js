const isElectron = window.electronAPI && window.electronAPI.isElectron;

if (!isElectron) {
  alert('Este aplicativo precisa ser executado em modo desktop.');
}

let proposals = [];

const proposalsContainer = document.getElementById('proposals-container');
const btnNewProposal = document.getElementById('btn-new-proposal');
const btnBackup = document.getElementById('btn-backup-proposals');
const btnSettings = document.getElementById('btn-settings');
const btnRepAdmin = document.getElementById('btn-rep-admin');
const btnRepPortal = document.getElementById('btn-rep-portal');

async function init() {
  await loadProposals();
  renderWorkspace();
  btnNewProposal.addEventListener('click', openWizard);
  btnSettings.addEventListener('click', openSettings);
  if (btnBackup) {
    btnBackup.addEventListener('click', exportProposals);
  }
  btnRepAdmin?.addEventListener('click', () => window.open('/representantes/admin.html', '_blank'));
  btnRepPortal?.addEventListener('click', () => window.open('/representantes/portal.html', '_blank'));
}

async function loadProposals() {
  try {
    proposals = await window.electronAPI.proposals.list();
  } catch (error) {
    console.error('[Workspace] Erro ao carregar propostas:', error);
    proposals = [];
  }
}

function renderWorkspace() {
  if (!proposals.length) {
    proposalsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📄</div>
        <h2>Nenhuma proposta ainda</h2>
        <p>Use o botão acima para iniciar um novo orçamento.</p>
      </div>
    `;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'proposals-grid';

  proposals.forEach((proposal) => grid.appendChild(createProposalCard(proposal)));

  proposalsContainer.innerHTML = '';
  proposalsContainer.appendChild(grid);
}

function createProposalCard(proposal) {
  const card = document.createElement('div');
  card.className = 'proposal-card';

  const isCompleted = proposal.status === 'completed' || proposal.status === 'generated';
  const statusBadge = isCompleted ? '✔️' : '🕒';
  const statusText = isCompleted ? 'Gerado' : 'Rascunho';
  const date = proposal.createdAt ? new Date(proposal.createdAt).toLocaleDateString('pt-BR') : '--';

  card.innerHTML = `
    <div class="proposal-thumbnail">🖼️</div>
    <div class="proposal-title">${statusBadge} ${proposal.cliente?.nomeAnunciante || 'Sem nome'}</div>
    <div class="proposal-meta">Criado em ${date} • ${statusText}</div>
    <div class="proposal-actions">
      <button class="btn btn-small btn-secondary" onclick="viewProposal('${proposal.id}')">👁️ Ver</button>
      ${isCompleted ? `
        <button class="btn btn-small btn-primary" onclick="downloadProposal('${proposal.id}')">⬇️ Baixar</button>
      ` : `
        <button class="btn btn-small btn-primary" onclick="editProposal('${proposal.id}')">✏️ Editar</button>
      `}
      <button class="btn btn-small btn-secondary" onclick="deleteProposal('${proposal.id}')">🗑️ Remover</button>
    </div>
  `;

  return card;
}

function openWizard() {
  localStorage.removeItem('wizard_draft');
  window.location.href = 'proposals/new/Step1Dados.html';
}

function openSettings() {
  window.location.href = 'settings/index.html';
}

async function viewProposal(id) {
  window.location.href = `proposals/view-proposal.html?id=${id}`;
}

function editProposal(id) {
  localStorage.setItem('editing_proposal_id', id);
  window.location.href = 'proposals/new/Step1Dados.html';
}

async function downloadProposal(id) {
  notify.info('Em desenvolvimento', 'Exportar direto do aplicativo ainda será implementado.');
}

function sanitizeProposalData(data) {
  if (!data) return {};
  let clone;
  if (typeof structuredClone === 'function') {
    clone = structuredClone(data);
  } else {
    clone = JSON.parse(JSON.stringify(data));
  }

  if (clone.uploads) {
    Object.keys(clone.uploads).forEach((slotId) => {
      const entry = clone.uploads[slotId];
      if (!entry) return;
      delete entry.data;
      delete entry.dataUrl;
      delete entry.previewUrl;
    });
  }

  return clone;
}

function encodeBase64(text) {
  try {
    return window.btoa(unescape(encodeURIComponent(text)));
  } catch (error) {
    if (window.Buffer) {
      return Buffer.from(text, 'utf-8').toString('base64');
    }
    throw error;
  }
}

async function exportProposals() {
  try {
    await loadProposals();

    const payload = {
      exportedAt: new Date().toISOString(),
      total: proposals.length,
      proposals: proposals.map((proposal) => sanitizeProposalData(proposal))
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const data = encodeBase64(jsonString);
    const fileName = `propostas-od-drive-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19)}.json`;

    await window.electronAPI.files.save({
      data,
      fileName
    });

    if (window.notify?.success) {
      notify.success('Backup salvo', 'Arquivo exportado para o seu computador.');
    }
  } catch (error) {
    console.error('[Workspace] Erro ao exportar backup:', error);
    if (window.notify?.error) {
      notify.error('Erro', 'Não foi possível salvar o backup local.');
    }
  }
}

async function deleteProposal(id) {
  const confirmed = await modal.confirm(
    'Excluir proposta',
    'Tem certeza que deseja excluir esta proposta?'
  );

  if (!confirmed) return;

  try {
    await window.electronAPI.proposals.delete(id);
    await loadProposals();
    renderWorkspace();
    notify.success('Proposta removida', 'A proposta foi excluída com sucesso.');
  } catch (error) {
    console.error('[Workspace] Erro ao excluir proposta:', error);
    notify.error('Erro', 'Não foi possível excluir a proposta.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.viewProposal = viewProposal;
window.editProposal = editProposal;
window.downloadProposal = downloadProposal;
window.deleteProposal = deleteProposal;
