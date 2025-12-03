import { PitcheyAPIClient } from '../client';
import { MediaFile, UploadMediaData } from '../types';

export class MediaResource {
  constructor(private client: PitcheyAPIClient) {}

  async upload(data: UploadMediaData): Promise<{ message: string; file: MediaFile }> {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('type', data.type);
    if (data.pitchId) {
      formData.append('pitchId', String(data.pitchId));
    }

    return this.client.post('/api/media/upload', formData);
  }
}