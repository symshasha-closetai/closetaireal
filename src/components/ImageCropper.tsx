import React, { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCw, Check, X } from "lucide-react";

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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-[95vw] sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl border-border/50 bg-background" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Crop Photo</DialogTitle>
        {/* Crop area */}
        <div className="relative w-full h-[60vh] sm:h-[50vh] bg-black">
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
            showGrid
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: { border: "2px solid hsl(var(--primary))" },
            }}
          />
        </div>

        {/* Controls */}
        <div className="px-4 py-3 space-y-3">
          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="text-muted-foreground"
            >
              <RotateCw className="h-4 w-4 mr-1" />
              Rotate
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={processing}
              >
                <Check className="h-4 w-4 mr-1" />
                {processing ? "Cropping…" : "Use Photo"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropper;
