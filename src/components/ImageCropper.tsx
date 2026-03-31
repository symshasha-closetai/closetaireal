import React, { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { RotateCw, Check, X } from "lucide-react";

interface ImageCropperProps {
  imageSrc: string;
  open: boolean;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
}

const createCroppedImage = async (
  imageSrc: string,
  pixelCrop: Area,
  rotation: number
): Promise<Blob> => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const rotW = image.width * cos + image.height * sin;
  const rotH = image.width * sin + image.height * cos;

  canvas.width = rotW;
  canvas.height = rotH;
  ctx.translate(rotW / 2, rotH / 2);
  ctx.rotate(radians);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = pixelCrop.width;
  cropCanvas.height = pixelCrop.height;
  const cropCtx = cropCanvas.getContext("2d")!;
  cropCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    cropCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
      "image/jpeg",
      0.92
    );
  });
};

const ImageCropper: React.FC<ImageCropperProps> = ({
  imageSrc,
  open,
  onConfirm,
  onCancel,
  aspectRatio = 4 / 5,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedArea) return;
    setProcessing(true);
    try {
      const blob = await createCroppedImage(imageSrc, croppedArea, rotation);
      onConfirm(blob);
    } catch {
      onCancel();
    }
    setProcessing(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Crop area — fills screen */}
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspectRatio}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
          cropShape="rect"
          showGrid={false}
          style={{
            containerStyle: { background: "#000" },
            cropAreaStyle: {
              border: "2px solid rgba(255,255,255,0.6)",
              borderRadius: "12px",
            },
          }}
        />
      </div>

      {/* Floating bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom,16px)] px-4 pt-3 pb-5 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        <p className="text-center text-white/40 text-[11px] mb-3 tracking-wide">
          Pinch to zoom · Drag to move
        </p>
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-full px-5 h-10"
          >
            <X className="h-4 w-4 mr-1.5" />
            Cancel
          </Button>

          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <RotateCw className="h-4 w-4 text-white/70" />
          </button>

          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={processing}
            className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            <Check className="h-4 w-4 mr-1.5" />
            {processing ? "Cropping…" : "Use Photo"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
