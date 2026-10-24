export interface ProcessedImage {
  dataUri: string;
  name: string;
  sizeBytes: number;
}

/**
 * Proportionally resizes high-resolution images to fit within maxDim bounding box
 * and re-encodes as JPEG (quality 0.85) using an offscreen canvas.
 * Reduces 10-20MB phone/camera photos down to ~100-150KB for fast WebSocket transmission.
 */
export async function processImageFile(
  file: File,
  maxDim: number = 1280,
  quality: number = 0.85
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("Canvas 2D context unavailable"));
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUri = canvas.toDataURL("image/jpeg", quality);
        resolve({
          dataUri,
          name: file.name,
          sizeBytes: Math.round((dataUri.length * 3) / 4),
        });
      };
      img.onerror = () => reject(new Error("Failed to load image file for compression"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}
