import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Upload, X } from "lucide-react";

type PhotoData = {
  id: string;
  dataUrl: string;
  caption?: string;
  timestamp: string;
};

export default function PhotoUpload({
  visitId,
  onSave,
}: {
  visitId: string;
  onSave?: (photos: PhotoData[]) => void;
}) {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [capturing, setCapturing] = useState(false);

  async function handleCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newPhotos: PhotoData[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const photoData: PhotoData = {
          id: crypto.randomUUID(),
          dataUrl: event.target?.result as string,
          timestamp: new Date().toISOString(),
        };
        newPhotos.push(photoData);
        
        if (newPhotos.length === files.length) {
          setPhotos((prev) => [...prev, ...newPhotos]);
          if (onSave) onSave([...photos, ...newPhotos]);
        }
      };
      
      reader.readAsDataURL(file);
    }
  }

  function handleRemove(id: string) {
    const updated = photos.filter((p) => p.id !== id);
    setPhotos(updated);
    if (onSave) onSave(updated);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <label className="flex-1">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            className="hidden"
          />
          <Button type="button" className="w-full" variant="outline">
            <Camera className="w-4 h-4 mr-2" />
            Tirar Foto
          </Button>
        </label>

        <label className="flex-1">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleCapture}
            className="hidden"
          />
          <Button type="button" className="w-full" variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Galeria
          </Button>
        </label>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((photo) => (
            <Card key={photo.id} className="relative">
              <CardContent className="p-2">
                <img
                  src={photo.dataUrl}
                  alt="Foto da visita"
                  className="w-full h-32 object-cover rounded"
                />
                <button
                  onClick={() => handleRemove(photo.id)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                >
                  <X className="w-3 h-3" />
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(photo.timestamp).toLocaleTimeString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
