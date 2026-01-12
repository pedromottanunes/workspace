const axios = require('axios');
const FormData = require('form-data');

class GoogleSlidesClient {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.slides = axios.create({
      baseURL: 'https://slides.googleapis.com/v1',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  get authHeader() {
    return {
      Authorization: `Bearer ${this.accessToken}`
    };
  }

  async copyPresentation(templateId, title, folderId) {
    const body = { name: title };
    if (folderId) {
      body.parents = [folderId];
    }

    const response = await axios.post(
      `https://www.googleapis.com/drive/v3/files/${templateId}/copy`,
      body,
      {
        headers: {
          ...this.authHeader,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  async batchUpdate(presentationId, requests) {
    if (!requests || !requests.length) return null;
    try {
      const response = await this.slides.post(
        `/presentations/${presentationId}:batchUpdate`,
        { requests }
      );
      return response.data;
    } catch (error) {
      // Log detailed Google error payload when available
      const respData = error?.response?.data;
      console.error('[GoogleSlidesClient] batchUpdate failed:', respData || error?.message || error);
      // Throw a clearer error including the response payload
      const message = respData ? `Google Slides API error: ${JSON.stringify(respData)}` : (error.message || 'Unknown Slides error');
      const err = new Error(message);
      err.original = error;
      throw err;
    }
  }

  async getPresentation(presentationId) {
    const response = await this.slides.get(`/presentations/${presentationId}`);
    return response.data;
  }

  async exportPresentationPdf(presentationId, quality = 'optimized') {
    const qualityParams = this.getQualityParams(quality);
    
    const response = await axios.get(
      `https://www.googleapis.com/drive/v3/files/${presentationId}/export`,
      {
        headers: this.authHeader,
        responseType: 'arraybuffer',
        params: {
          mimeType: 'application/pdf',
          ...qualityParams
        }
      }
    );

    return response.data;
  }

  getQualityParams(quality) {
    switch (quality) {
      case 'high':
        return {};
      case 'maximum':
        return {};
      case 'optimized':
      default:
        return {};
    }
  }

  async uploadImage(buffer, filename, folderId) {
    const metadata = {
      name: filename || 'placeholder-image',
      mimeType: 'image/png'
    };

    if (folderId) {
      metadata.parents = [folderId];
    }

    const form = new FormData();
    form.append('metadata', JSON.stringify(metadata), {
      contentType: 'application/json'
    });
    form.append('file', buffer, {
      filename: filename || 'image.png',
      contentType: 'image/png'
    });

    const response = await axios.post(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      form,
      {
        headers: {
          ...this.authHeader,
          ...form.getHeaders()
        }
      }
    );

    return response.data;
  }

  async shareFilePublicly(fileId) {
    try {
      const response = await axios.post(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
        {
          role: 'reader',
          type: 'anyone'
        },
        {
          headers: {
            ...this.authHeader,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.warn('[Google Slides] Falha ao tornar arquivo público:', error.response?.data || error.message);
      return null;
    }
  }
}

module.exports = GoogleSlidesClient;
