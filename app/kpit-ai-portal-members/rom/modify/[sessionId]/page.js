'use client';

import { useParams, useRouter } from 'next/navigation';
import SessionModificationPage from '../../components/SessionModificationPage';

export default function ModifySessionPage() {
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
    <SessionModificationPage 
      sessionId={sessionId} 
      onClose={handleClose}
    />
  );
}