const IMGBB_API_KEY = '21c70359a24d1d10335f4f41a8867b08';

export async function uploadBlobToImgBB(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = (reader.result as string).replace(/^data:image\/[a-z]+;base64,/, '');
        const formData = new FormData();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', base64);

        const response = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error(`IMGBB upload failed: ${response.status}`);
        const result = await response.json();
        if (!result?.data?.url) throw new Error('IMGBB returned no URL');
        resolve(result.data.url);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

export async function uploadBase64ToImgBB(base64: string): Promise<string> {
  const clean = base64.replace(/^data:image\/[a-z]+;base64,/, '');
  const formData = new FormData();
  formData.append('key', IMGBB_API_KEY);
  formData.append('image', clean);

  const response = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error(`IMGBB upload failed: ${response.status}`);
  const result = await response.json();
  if (!result?.data?.url) throw new Error('IMGBB returned no URL');
  return result.data.url;
}
