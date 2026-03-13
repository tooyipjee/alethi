import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { searchUsers, getOtherUsers, findUserById } from '@/lib/users/user-service';

export async function GET(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const id = searchParams.get('id');

    // Get specific user by ID
    if (id) {
      const user = await findUserById(id);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      return NextResponse.json({
        id: user.id,
        name: user.name,
        daemonName: user.daemonName,
        image: user.image,
      });
    }

    // Search users by query
    if (query) {
      const users = await searchUsers(query, session.user.id);
      return NextResponse.json({
        users: users.map(u => ({
          id: u.id,
          name: u.name,
          daemonName: u.daemonName,
          image: u.image,
        })),
      });
    }

    // List all other users (for directory)
    const users = await getOtherUsers(session.user.id);
    return NextResponse.json({
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        daemonName: u.daemonName,
        image: u.image,
      })),
    });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
