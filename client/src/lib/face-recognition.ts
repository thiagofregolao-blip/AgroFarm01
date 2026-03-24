import * as faceapi from "face-api.js";

let modelsLoaded = false;

/**
 * Load face-api.js models (idempotent - caches after first load)
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  const MODEL_URL = "/models";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

/**
 * Generate a 128-dimension face embedding from a base64 image
 * Returns null if no face is detected
 */
export async function generateFaceEmbedding(imageBase64: string): Promise<number[] | null> {
  await loadFaceModels();

  const img = await createImageElement(imageBase64);
  const detection = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  if (!detection) return null;
  return Array.from(detection.descriptor);
}

/**
 * Calculate Euclidean distance between two face descriptors
 * Lower = more similar. Threshold: < 0.6 = same person
 */
export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Find the best matching employee from a list of employees with face embeddings
 * Returns null if no match is found within threshold
 */
export function findBestMatch(
  capturedDescriptor: number[],
  employees: Array<{ id: string; name: string; faceEmbedding: number[] }>,
  threshold = 0.6
): { matchedId: string; matchedName: string; distance: number } | null {
  let bestMatch: { matchedId: string; matchedName: string; distance: number } | null = null;

  for (const emp of employees) {
    if (!emp.faceEmbedding || emp.faceEmbedding.length !== 128) continue;
    const dist = euclideanDistance(capturedDescriptor, emp.faceEmbedding);
    if (dist < threshold && (!bestMatch || dist < bestMatch.distance)) {
      bestMatch = { matchedId: emp.id, matchedName: emp.name, distance: dist };
    }
  }

  return bestMatch;
}

/**
 * Create an HTMLImageElement from a base64 string (works in browser)
 */
function createImageElement(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
  });
}
