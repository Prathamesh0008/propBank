import { apiFetch } from '@/lib/api-client';
import { API_BASE_URL } from '../utils/config';

interface UploadResponse {
  success: boolean;
  message: string;
  url?: string;
  urls?: string[];
}

/**
 * Upload Service - Handles uploads through the managed private-storage API
 */

/**
 * Upload a single image file (multipart form data)
 * @param file - The file to upload
 * @param folder - The folder to store the image in (e.g., 'properties', 'avatars')
 * @returns The application delivery URL of the uploaded image
 */
export const uploadImage = async (file: File, folder: string = 'uploads'): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('folder', folder);

  const response = await apiFetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  const data: UploadResponse = await response.json();

  if (!data.success || !data.url) {
    throw new Error(data.message || 'Failed to upload image');
  }

  return data.url;
};

/**
 * Upload a base64 encoded image
 * @param base64Image - The base64 encoded image data
 * @param folder - The folder to store the image in
 * @param identifier - An identifier for the image filename
 * @returns The application delivery URL of the uploaded image
 */
export const uploadBase64Image = async (
  base64Image: string,
  folder: string = 'uploads',
  identifier: string = 'image'
): Promise<string> => {
  const response = await apiFetch(`${API_BASE_URL}/upload/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: base64Image,
      folder,
      identifier,
    }),
  });

  const data: UploadResponse = await response.json();

  if (!data.success || !data.url) {
    throw new Error(data.message || 'Failed to upload image');
  }

  return data.url;
};

/**
 * Upload multiple property images (base64 encoded)
 * @param images - Array of base64 encoded images
 * @param propertyId - The property ID
 * @returns Array of application delivery URLs
 */
export const uploadPropertyImages = async (
  images: string[],
  propertyId: string
): Promise<string[]> => {
  const response = await apiFetch(`${API_BASE_URL}/upload/property-images`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      images,
      propertyId,
    }),
  });

  const data: UploadResponse = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to upload property images');
  }

  return data.urls || [];
};

/**
 * Upload a document file (PDF, etc.)
 * @param file - The document file to upload
 * @param propertyId - The property ID
 * @param docType - The type of document (e.g., 'lease', 'contract', 'general')
 * @returns The authenticated application URL of the uploaded document
 */
export const uploadDocument = async (
  file: File,
  propertyId: string,
  docType: string = 'general'
): Promise<string> => {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('propertyId', propertyId);
  formData.append('docType', docType);

  const response = await apiFetch(`${API_BASE_URL}/upload/document`, {
    method: 'POST',
    body: formData,
  });

  const data: UploadResponse = await response.json();

  if (!data.success || !data.url) {
    throw new Error(data.message || 'Failed to upload document');
  }

  return data.url;
};

/**
 * Upload a service request image (base64 encoded)
 * @param image - The base64 encoded image
 * @param requestId - The service request ID
 * @returns The application delivery URL of the uploaded image
 */
export const uploadServiceRequestImage = async (
  image: string,
  requestId: string
): Promise<string> => {
  const response = await apiFetch(`${API_BASE_URL}/upload/service-request-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image,
      requestId,
    }),
  });

  const data: UploadResponse = await response.json();

  if (!data.success || !data.url) {
    throw new Error(data.message || 'Failed to upload image');
  }

  return data.url;
};

/**
 * Delete a file from storage
 * @param fileUrl - The URL of the file to delete
 */
export const deleteFile = async (fileUrl: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/files/delete`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: fileUrl,
    }),
  });

  const data: UploadResponse = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to delete file');
  }
};

/**
 * Convert a File to base64 string
 * @param file - The file to convert
 * @returns Base64 encoded string with data URI prefix
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Convert multiple Files to base64 strings
 * @param files - Array of files to convert
 * @returns Array of base64 encoded strings
 */
export const filesToBase64 = async (files: File[]): Promise<string[]> => {
  return Promise.all(files.map(fileToBase64));
};
