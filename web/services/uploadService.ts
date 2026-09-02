/**
 * services/uploadService.ts
 * Servicio para subir comprobantes a Google Drive mediante Google Apps Script.
 */

// TODO: Reemplazar con la URL /exec real generada en Google Apps Script
const DRIVE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzBRIe_9icHY96oERXOqe3sqYP2kDAyHWtDOP3CXGX5T8I-gcddaFHOseg4J4tWxjlf_Q/exec';

export async function uploadReceiptToDrive(
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  try {
    // 1. Obtener el archivo como Blob
    const response = await fetch(fileUri);
    const blob = await response.blob();

    // 2. Convertir Blob a Base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Remover el prefijo "data:image/jpeg;base64,"
          const b64 = reader.result.split(',')[1];
          resolve(b64);
        } else {
          reject(new Error('Fallo al convertir a base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // 3. Enviar al Web App de Google Apps Script
    const res = await fetch(DRIVE_APP_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        fileName: fileName,
        mimeType: mimeType,
        base64: base64,
      }),
      // no-cors mode sometimes needed depending on Apps script configuration,
      // but if deployed as Anyone we can usually just do a normal post and let the browser follow redirects.
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
    });

    const result = await res.json();

    if (result.success) {
      return result.fileUrl;
    } else {
      throw new Error(result.error || 'Error desconocido al subir a Drive');
    }
  } catch (error) {
    console.error('Error uploading receipt:', error);
    throw error;
  }
}
