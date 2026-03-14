import { NextResponse } from 'next/server';
import { getAllRegisteredUsers } from '@/lib/users/user-service';
import { getAllNegotiations, getUserNegotiations } from '@/lib/negotiations/store';
import { runNegotiation } from '@/lib/negotiations/negotiate';

export async function GET(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Debug endpoint disabled in production' }, { status: 403 });
  }
  
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  const registeredUsers = getAllRegisteredUsers();
  const allNegotiations = getAllNegotiations();
  
  return NextResponse.json({
    env: process.env.NODE_ENV,
    registeredUsers: registeredUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      daemonName: u.daemonName,
    })),
    allNegotiations: allNegotiations.map(n => ({
      id: n.id,
      topic: n.topic,
      status: n.status,
      initiator: n.initiator,
      target: n.target,
      messageCount: n.messages.length,
      outcome: n.outcome,
    })),
    userNegotiations: userId 
      ? getUserNegotiations(userId).map(n => ({
          id: n.id,
          topic: n.topic,
          status: n.status,
          isInitiator: n.initiator.id === userId,
          otherUser: n.initiator.id === userId ? n.target : n.initiator,
        }))
      : null,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fromUserId, toUserId, topic, message } = body;
    
    if (!fromUserId || !toUserId) {
      return NextResponse.json({ error: 'fromUserId and toUserId required' }, { status: 400 });
    }
    
    const registeredUsers = getAllRegisteredUsers();
    const fromUser = registeredUsers.find(u => u.id === fromUserId);
    const toUser = registeredUsers.find(u => u.id === toUserId);
    
    if (!fromUser) {
      return NextResponse.json({ error: `User ${fromUserId} not found` }, { status: 404 });
    }
    if (!toUser) {
      return NextResponse.json({ error: `User ${toUserId} not found` }, { status: 404 });
    }
    
    console.log('[DEBUG] Starting test negotiation:', {
      from: { id: fromUser.id, name: fromUser.name, daemon: fromUser.daemonName },
      to: { id: toUser.id, name: toUser.name, daemon: toUser.daemonName },
    });
    
    const result = await runNegotiation({
      userId: fromUser.id,
      userName: fromUser.name,
      userPanName: fromUser.daemonName,
      targetPersonName: toUser.name,
      topic: topic || 'Test negotiation',
      userMessage: message || 'This is a test negotiation',
    });
    
    console.log('[DEBUG] Negotiation completed:', {
      id: result.id,
      status: result.status,
      initiator: result.initiator,
      target: result.target,
    });
    
    return NextResponse.json({
      success: true,
      negotiation: {
        id: result.id,
        status: result.status,
        initiator: result.initiator,
        target: result.target,
        messageCount: result.messages.length,
        outcome: result.outcome,
      },
    });
  } catch (error) {
    console.error('[DEBUG] Negotiation failed:', error);
    return NextResponse.json(
      { error: 'Negotiation failed', details: String(error) },
      { status: 500 }
    );
  }
}
