import { handleOcrPost } from '@/lib/visionOcr';

export const runtime = 'nodejs';
export const maxDuration = 35;

export async function POST(request: Request) {
  return handleOcrPost(request);
}
