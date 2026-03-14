import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PanChat } from '@/components/app-shell/pan-chat';

export default async function HubPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <PanChat 
      panName={session.user.daemonName || 'Pan'} 
      userName={session.user.name || 'there'}
      userId={session.user.id}
    />
  );
}
