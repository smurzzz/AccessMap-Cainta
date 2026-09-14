import type { AuthedSupabase } from '@/hooks/useAuthedSupabase';
import { supabaseBucketName, supabasePublicUrl } from '@/lib/supabase';

export type PhotoAsset = { uri: string; fileName?: string | null; mimeType?: string | null };

function fetchBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('Could not read the selected image.'));
    xhr.open('GET', uri, true);
    xhr.responseType = 'blob';
    xhr.send();
  });
}

export async function uploadEntrancePhoto(
  client: AuthedSupabase,
  asset: PhotoAsset,
): Promise<string> {
  const blob = await fetchBlob(asset.uri);
  const base = asset.fileName || `photo-${Date.now()}.jpg`;
  const safeName = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${Date.now()}_${safeName}`;
  const { error } = await client.storage
    .from(supabaseBucketName)
    .upload(path, blob, { contentType: asset.mimeType || 'image/jpeg' });
  if (error) throw error;
  return `${supabasePublicUrl}/storage/v1/object/public/${supabaseBucketName}/${path}`;
}
