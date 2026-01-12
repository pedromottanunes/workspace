// =====================================================
// CONFIGURAÇÃO DE AMBIENTE - WORKSPACE
// =====================================================
// Este arquivo detecta automaticamente se está em produção ou desenvolvimento
// e fornece as URLs corretas para os serviços

(function() {
  'use strict';

  // Detecta se está em produção baseado no hostname
  const isProduction = window.location.hostname !== 'localhost' && 
                       window.location.hostname !== '127.0.0.1';
  
  const isDevelopment = !isProduction;

  // Configuração de URLs
  window.WORKSPACE_CONFIG = {
    isProduction,
    isDevelopment,
    
    // URLs dos serviços (produção)
    BACKEND_URL: isProduction 
      ? (window.ENV_BACKEND_URL || 'https://oddrive-backend.onrender.com')
      : `${window.location.protocol}//${window.location.hostname}:5174`,
    
    GERADOR_URL: isProduction 
      ? (window.ENV_GERADOR_URL || 'https://oddrive-gerador.onrender.com')
      : `http://${window.location.hostname}:5173`,
    
    WORKSPACE_URL: isProduction 
      ? window.location.origin
      : `http://${window.location.hostname}:4173`,

    // Helper functions
    getBackendUrl: function() { return this.BACKEND_URL; },
    getGeradorUrl: function() { return this.GERADOR_URL; },
    getWorkspaceUrl: function() { return this.WORKSPACE_URL; }
  };

  // Log para debug (remova em produção se preferir)
  console.log('[WORKSPACE_CONFIG]', window.WORKSPACE_CONFIG);
})();
