import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import SftpClient from 'ssh2-sftp-client';
import { RCNOA_DEFAULTS } from './rcnoaCore.js';
import { RCNOA_TIMEOUT_DEFAULTS } from './rcnoaBusinessConfigurationService.js';

const MAX_ATTEMPTS = 3;

function requiredEnvironment(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function normalizedFingerprint(value) {
  return String(value || '').trim().replace(/^SHA256:/i, '');
}

function fingerprintsEqual(left, right) {
  const leftBuffer = Buffer.from(normalizedFingerprint(left));
  const rightBuffer = Buffer.from(normalizedFingerprint(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function remotePath(...parts) {
  return path.posix.join(...parts.map((part) => String(part || '').replace(/\\/g, '/')));
}

function connectionConfig(connectionTimeoutSeconds) {
  const fingerprint = requiredEnvironment('RCNOA_SFTP_HOST_KEY_SHA256');
  return {
    host: requiredEnvironment('RCNOA_REMOTE_SERVER'),
    port: Number(process.env.RCNOA_REMOTE_PORT || 22),
    username: requiredEnvironment('RCNOA_USERNAME'),
    password: requiredEnvironment('RCNOA_PASSWORD'),
    readyTimeout: Number(connectionTimeoutSeconds) * 1000,
    retries: 0,
    hostHash: 'sha256',
    hostVerifier: (hashedKey) => fingerprintsEqual(hashedKey, fingerprint),
  };
}

function isTransient(error) {
  const code = String(error?.code || '').toUpperCase();
  return ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE'].includes(code)
    || /timed? out|connection (?:lost|closed|reset)/i.test(String(error?.message || ''));
}

async function withSftp(operationName, connectionTimeoutSeconds, operation) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const client = new SftpClient(`rcnoa-${operationName}`);
    try {
      await client.connect(connectionConfig(connectionTimeoutSeconds));
      return await operation(client);
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === MAX_ATTEMPTS) throw error;
    } finally {
      try {
        await client.end();
      } catch {
        // Connection may already be closed after a transport failure.
      }
    }
  }
  throw lastError;
}

export async function receiveNextRcnoFile(
  connectionTimeoutSeconds = RCNOA_TIMEOUT_DEFAULTS.sftpConnectionTimeoutSeconds,
) {
  const folder = requiredEnvironment('RCNOA_REMOTE_FOLDER');
  const patternText = process.env.RCNOA_INBOUND_FILE_PATTERN || RCNOA_DEFAULTS.inboundFilePattern;
  let pattern;
  try {
    pattern = new RegExp(patternText);
  } catch {
    throw new Error('RCNOA_INBOUND_FILE_PATTERN must be a valid regular expression');
  }

  return withSftp('receive', connectionTimeoutSeconds, async (client) => {
    const files = (await client.list(folder))
      .filter((entry) => entry.type === '-' && pattern.test(entry.name))
      .sort((left, right) => left.modifyTime - right.modifyTime || left.name.localeCompare(right.name));
    if (!files.length) return null;
    const selected = files[0];
    const content = await client.get(remotePath(folder, selected.name));
    return { fileName: selected.name, content: Buffer.from(content) };
  });
}

export async function deliverRcnoaOutput(
  fileName,
  content,
  connectionTimeoutSeconds = RCNOA_TIMEOUT_DEFAULTS.sftpConnectionTimeoutSeconds,
) {
  const folder = requiredEnvironment('RCNOA_REMOTE_FOLDER');
  const outboundFolder = process.env.RCNOA_REMOTE_OUTPUT_FOLDER || folder;
  const temporaryName = `.${fileName}.uploading`;
  return withSftp('deliver', connectionTimeoutSeconds, async (client) => {
    const temporaryPath = remotePath(outboundFolder, temporaryName);
    const finalPath = remotePath(outboundFolder, fileName);
    await client.put(content, temporaryPath);
    await client.rename(temporaryPath, finalPath);
    return { delivered: true };
  });
}

export async function archiveRcnoaInput(
  fileName,
  connectionTimeoutSeconds = RCNOA_TIMEOUT_DEFAULTS.sftpConnectionTimeoutSeconds,
) {
  const folder = requiredEnvironment('RCNOA_REMOTE_FOLDER');
  const archiveFolder = process.env.RCNOA_REMOTE_ARCHIVE_FOLDER || remotePath(folder, 'archive');
  return withSftp('archive', connectionTimeoutSeconds, async (client) => {
    if (!await client.exists(archiveFolder)) await client.mkdir(archiveFolder, true);
    await client.rename(remotePath(folder, fileName), remotePath(archiveFolder, fileName));
    return { archived: true };
  });
}