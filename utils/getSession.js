import { getOpenIdSession } from '@/lib/openidSession';
import { getOpenIdSession as getOpenIdSessionGeisinger } from '@/lib/openidSessionGeisinger';

export async function getServerSession() {
  let verified;
  if (typeof process.env.USE_VAULT !== 'undefined' && process.env.USE_VAULT === 'true') {
    verified = await getOpenIdSessionGeisinger();
  } else {
    verified = await getOpenIdSession();;
  }

  if (!verified || verified.expired) {
    throw new Error('Unauthorized');
  }
  verified.payload.nuid = verified.payload.sub;
  let modifiedGroups = verified.payload.groups || [];
  const tempAppAdminFix = process.env.USE_VAULT === 'true' && process.env.GEISINGER_APP_ADMINS;
  const userIsTempAdmin = tempAppAdminFix && process.env.GEISINGER_APP_ADMINS.split(",").includes(verified.payload.sub.toUpperCase());
  if (userIsTempAdmin) {
    modifiedGroups = [...modifiedGroups, 'HPTS_AIPORTAL_ADMIN'];
  }
  return { ...verified.payload, groups: modifiedGroups };
}

export async function getCurrentUserNuid() {
  let verified;
  if (typeof process.env.USE_VAULT !== 'undefined' && process.env.USE_VAULT === 'true') {
    verified = await getOpenIdSessionGeisinger();
  } else {
    verified = await getOpenIdSession();;
  }

  // Accept session even if access token expired; higher-level logic should refresh.
  if (!verified) throw new Error('User not authenticated');
  if (verified.jwtExpired || verified.idleExpired || verified.absoluteExpired || verified.revoked) {
    throw new Error('User not authenticated');
  }
  const nuid = verified.payload.sub;
  if (!nuid) throw new Error('User NUID not found in session');
  return nuid;
}
