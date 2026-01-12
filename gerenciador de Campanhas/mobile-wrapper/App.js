import React, { useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';

// Substitua pelo IP da sua máquina na rede local e porta do servidor
// Use ipconfig para encontrar o IPv4 (ex: 192.168.1.37)
// Este wrapper abre diretamente a página do motorista (`driver.html`).
const LOCAL_SERVER_URL = 'http://192.168.1.37:5174/driver.html';

export default function App() {
  const [error, setError] = useState(null);
  const [key, setKey] = useState(0);

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.warn('WebView error:', nativeEvent);
    setError(`Erro ao carregar: ${nativeEvent.description || 'Timeout'}. Verifique se o servidor está rodando em ${LOCAL_SERVER_URL}`);
  };

  const retry = () => {
    setError(null);
    setKey(prev => prev + 1);
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>❌ Não foi possível carregar</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorHint}>
          • Verifique se o backend está rodando{'\n'}
          • Confirme que iPhone e PC estão na mesma rede Wi-Fi{'\n'}
          • Tente abrir {LOCAL_SERVER_URL} no navegador do PC
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={retry}>
          <Text style={styles.retryButtonText}>🔄 Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView 
        key={key}
        source={{ uri: LOCAL_SERVER_URL }} 
        style={{ flex: 1 }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        onError={handleError}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066cc" />
            <Text style={styles.loadingText}>Carregando motorista...</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#d32f2f',
  },
  errorText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'left',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
