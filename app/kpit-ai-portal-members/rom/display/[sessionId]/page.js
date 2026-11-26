'use client';

import { useParams, useRouter } from 'next/navigation';
import SessionDisplayPage from '../../components/SessionDisplayPage';

export default function DisplaySessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId;

  const handleClose = () => {
    // Close current tab/window or navigate back
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/kpit-ai-portal-members/rom');
    }
  };

  return (
    <SessionDisplayPage 
      sessionId={sessionId} 
      onClose={handleClose}
    />
  );
}