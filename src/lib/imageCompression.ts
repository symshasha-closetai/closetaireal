/**
 * Compress an image file client-side before uploading.
 * Returns a compressed Blob (JPEG) and its base64 string.
 * Iteratively reduces quality to stay under targetSizeKB.
 */
export const compressImage = (
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.65,
  targetSizeKB = 200
): Promise<{ blob: Blob; base64: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if needed
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));

      ctx.drawImage(img, 0, 0, width, height);

      const targetBytes = targetSizeKB * 1024;
      const qualities = [quality, 0.5, 0.3];

      const tryQuality = (idx: number) => {
        const q = qualities[idx];
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Compression failed"));

            // If under target or no more quality levels to try, use this blob
            if (blob.size <= targetBytes || idx >= qualities.length - 1) {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                resolve({ blob, base64: result.split(",")[1] });
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            } else {
              // Try lower quality
              tryQuality(idx + 1);
            }
          },
          "image/jpeg",
          q
        );
      };

      tryQuality(0);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
};
