import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { findUserByName, buildUserTruthPacket } from '@/lib/users/user-service';
import { getMockOtherUsers } from '@/lib/mock/work-context';
import type { TruthPacket, PrivacyLevel } from '@/types/daemon';

export interface NegotiationPreview {
  initiator: {
    id: string;
    name: string;
    daemonName: string;
    truthPacket: TruthPacket;
    privacyLevel: PrivacyLevel;
  };
  target: {
    id: string;
    name: string;
    daemonName: string;
  };
  topic: string;
  sharingDescription: string[];
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { targetName, topic, message } = body;

  if (!targetName) {
    return NextResponse.json({ error: 'Target name is required' }, { status: 400 });
  }

  const userId = session.user.id;
  const userName = session.user.name || 'Unknown';
  const userDaemonName = session.user.daemonName || 'Pan';
  const privacyLevel = (session.user.privacyLevel || 'balanced') as PrivacyLevel;

  // Find target user (real or mock)
  let target = await findUserByName(targetName, userId);
  
  if (!target) {
    const mockUsers = getMockOtherUsers();
    const mockUser = mockUsers.find(u =>
      u.name.toLowerCase().includes(targetName.toLowerCase()) ||
      u.daemonName.toLowerCase().includes(targetName.toLowerCase())
    );
    
    if (mockUser) {
      target = {
        id: mockUser.id,
        name: mockUser.name,
        email: '',
        daemonName: mockUser.daemonName,
        daemonPersonality: 'analytical',
        privacyLevel: 'balanced',
      };
    }
  }

  if (!target) {
    return NextResponse.json({ error: `Could not find user "${targetName}"` }, { status: 404 });
  }

  // Build the TruthPacket that would be shared
  const truthPacket = buildUserTruthPacket(userId, privacyLevel);

  // Generate human-readable description of what will be shared
  const sharingDescription: string[] = [];
  
  if (truthPacket.availability.length > 0) {
    sharingDescription.push(`Your availability (${truthPacket.availability.length} time slots)`);
  }
  if (truthPacket.workloadSummary) {
    sharingDescription.push('Your current workload summary');
  }
  if (truthPacket.relevantExpertise.length > 0) {
    sharingDescription.push(`Your areas of expertise (${truthPacket.relevantExpertise.length} items)`);
  }
  if (truthPacket.currentFocus) {
    sharingDescription.push('What you\'re currently focused on');
  }
  if (truthPacket.lastActiveProject) {
    sharingDescription.push('Your most recent project activity');
  }

  if (sharingDescription.length === 0) {
    sharingDescription.push('Basic availability information only');
  }

  const preview: NegotiationPreview = {
    initiator: {
      id: userId,
      name: userName,
      daemonName: userDaemonName,
      truthPacket,
      privacyLevel,
    },
    target: {
      id: target.id,
      name: target.name,
      daemonName: target.daemonName,
    },
    topic: topic || message || 'General coordination',
    sharingDescription,
  };

  return NextResponse.json(preview);
}
