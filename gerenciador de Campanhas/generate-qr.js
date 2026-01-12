import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPO_URL = 'exp://192.168.1.37:8082';
const OUTPUT_PATH = path.join(__dirname, 'expo-qr-motorista.png');

QRCode.toFile(OUTPUT_PATH, EXPO_URL, {
  errorCorrectionLevel: 'H',
  type: 'png',
  quality: 0.95,
  margin: 1,
  width: 500,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  }
}).then(() => {
  console.log('✅ QR Code gerado com sucesso!');
  console.log(`📱 Arquivo: ${OUTPUT_PATH}`);
  console.log(`🔗 URL: ${EXPO_URL}`);
  console.log('\nAbra a câmera do iPhone e aponte para o QR code.');
  console.log('Ou use o Expo Go para escanear diretamente.');
}).catch(err => {
  console.error('❌ Erro ao gerar QR:', err);
  process.exit(1);
});
