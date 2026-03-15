import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { existsSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = join(process.cwd(), '.cache');
const NEGOTIATIONS_FILE = join(CACHE_DIR, 'negotiations.json');

export async function POST() {
  // Only allow in demo mode or development
  if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_DEMO_MODE) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let deletedFiles = 0;

    // Delete negotiations file
    if (existsSync(NEGOTIATIONS_FILE)) {
      unlinkSync(NEGOTIATIONS_FILE);
      deletedFiles++;
    }

    // Delete any other cache files in .cache directory
    if (existsSync(CACHE_DIR)) {
      const files = readdirSync(CACHE_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            unlinkSync(join(CACHE_DIR, file));
            deletedFiles++;
          } catch {
            // Ignore errors deleting individual files
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Reset complete. Deleted ${deletedFiles} cache files.`,
      deletedFiles,
    });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset demo state' },
      { status: 500 }
    );
  }
}
