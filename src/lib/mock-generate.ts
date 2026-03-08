// Mock image generation - returns placeholder images after a delay
const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80",
];

function getRandomImages(count: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(PLACEHOLDER_IMAGES[Math.floor(Math.random() * PLACEHOLDER_IMAGES.length)]);
  }
  return result;
}

export async function mockGenerate(numImages: number): Promise<string[]> {
  // Simulate API delay
  await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));
  return getRandomImages(numImages);
}
