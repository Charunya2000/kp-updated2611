'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AGENT_CONFIG, AGENT_KEYS } from '../../lib/agentConfig';
import { useSession } from '../../lib/SessionContext';

// ── Helpers ──────────────────────────────────────
const fmtSize = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};
const fileExtIcon = (name) => {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  return '📎';
};

// ── AgentCard ─────────────────────────────────────
function AgentCard({ agentKey, isActive }) {
  const cfg = AGENT_CONFIG[agentKey];
  return (
    <Link
      href={cfg.href}
      className={`kp-agent-card${isActive ? ' active' : ''}`}
    >
      <div className="kp-agent-icon-bubble" style={{ background: cfg.gradient }}>
        {cfg.icon}
      </div>
      <div className="kp-agent-info">
        <div className="kp-agent-name">{cfg.shortName}</div>
        <div className="kp-agent-desc">{cfg.desc}</div>
      </div>
      {isActive && <div className="kp-agent-active-dot" />}
    </Link>
  );
}

// ── SessionItem ───────────────────────────────────
function SessionItem({ session, agentKey, isActive, onSelect, onDelete, onRename, onTogglePin, onMove, canMoveUp, canMoveDown, scopeIds }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const cfg = AGENT_CONFIG[agentKey];
  const title = session.title || 'New conversation';

  const beginEdit = (e) => { e.stopPropagation(); setDraftTitle(title); setIsEditing(true); };
  const commitEdit = (e) => {
    e?.stopPropagation?.();
    onRename?.(session.id, String(draftTitle || '').trim() || 'New conversation');
    setIsEditing(false);
  };
  const cancelEdit = (e) => { e?.stopPropagation?.(); setIsEditing(false); setDraftTitle(''); };

  return (
    <div className={`kp-session-item${isActive ? ' active' : ''}`} onClick={() => onSelect(session.id)}>
      <div className="kp-session-dot" style={{ background: cfg.color }} />
      <div className="kp-session-text">
        {isEditing ? (
          <input
            className="kp-session-inline-edit"
            value={draftTitle}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(e); if (e.key === 'Escape') cancelEdit(e); }}
          />
        ) : (
          <div className="kp-session-title">{title}</div>
        )}
        <div className="kp-session-agent-label">{cfg.shortName}</div>
      </div>
      <div className="kp-session-actions">
        <button className={`kp-session-action-btn${session.pinned ? ' pin-active' : ''}`} onClick={(e) => { e.stopPropagation(); onTogglePin?.(session.id); }} title={session.pinned ? 'Unpin' : 'Pin'}>
          {session.pinned ? '📌' : '📍'}
        </button>
        <button className="kp-session-action-btn" onClick={(e) => { e.stopPropagation(); onMove?.(session.id, 'up', scopeIds || []); }} title="Move up" disabled={!canMoveUp}>↑</button>
        <button className="kp-session-action-btn" onClick={(e) => { e.stopPropagation(); onMove?.(session.id, 'down', scopeIds || []); }} title="Move down" disabled={!canMoveDown}>↓</button>
        <button className="kp-session-action-btn" onClick={beginEdit} title="Rename">✎</button>
      </div>
      <button className="kp-session-del" onClick={(e) => { e.stopPropagation(); onDelete(session.id); }} title="Delete">×</button>
    </div>
  );
}

// ── FileUploadZone ────────────────────────────────
function FileUploadZone({ agentKey, onFiles }) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const cfg = AGENT_CONFIG[agentKey];

  return (
    <div
      className={`kp-upload-zone${isDragOver ? ' dragover' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); onFiles(e.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        className="kp-upload-input"
        multiple
        accept=".pdf,.doc,.docx,.pptx,.xls,.xlsx,.xlsm,.csv,.txt,.md,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp,.gif"
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
      />
      <div className="kp-upload-icon">☁️</div>
      <div className="kp-upload-title">{cfg.uploadTitle}</div>
      <div className="kp-upload-hint">{cfg.uploadHint}</div>
    </div>
  );
}

// ── FileList ──────────────────────────────────────
function FileList({ files, onRemove }) {
  if (!files.length) return <div className="kp-no-files">No files uploaded yet</div>;
  return (
    <>
      {files.map((f, i) => (
        <div key={f.name + i} className="kp-file-item">
          <div className="kp-file-icon">{fileExtIcon(f.name)}</div>
          <div className="kp-file-info">
            <div className="kp-file-name">{f.name}</div>
            <div className="kp-file-size">{fmtSize(f.size)}</div>
          </div>
          <button className="kp-file-remove" onClick={() => onRemove(i)} title="Remove">×</button>
        </div>
      ))}
    </>
  );
}

// ── Sidebar (main export) ─────────────────────────
export default function Sidebar() {
  const pathname = usePathname();
  const [sessionSearch, setSessionSearch] = useState('');

  // Derive active agent key from route
  const currentAgent = pathname?.startsWith('/qa')
    ? 'qa'
    : pathname?.startsWith('/scoring')
    ? 'score'
    : 'intake';

  // Pull per-agent sessions + files from Context
  const {
    sessions,
    currentSessionId,
    uploadedFiles,
    newSession: onNewSession,
    selectSession: onSelectSession,
    deleteSession: onDeleteSession,
    renameSession: onRenameSession,
    togglePinSession: onTogglePinSession,
    moveSession: onMoveSession,
    addFiles: onFiles,
    removeFile: onRemoveFile,
  } = useSession(currentAgent);

  const normalizedQuery = String(sessionSearch || '').trim().toLowerCase();
  const filtered = sessions.filter((s) =>
    !normalizedQuery || String(s.title || 'New conversation').toLowerCase().includes(normalizedQuery)
  );
  const pinned = filtered.filter((s) => s.pinned);
  const regular = filtered.filter((s) => !s.pinned);

  const renderList = (items) => {
    const ids = items.map((s) => s.id);
    return items.map((s, i) => (
      <SessionItem
        key={s.id}
        session={s}
        agentKey={currentAgent}
        isActive={s.id === currentSessionId}
        onSelect={onSelectSession}
        onDelete={onDeleteSession}
        onRename={onRenameSession}
        onTogglePin={onTogglePinSession}
        onMove={onMoveSession}
        canMoveUp={i > 0}
        canMoveDown={i < items.length - 1}
        scopeIds={ids}
      />
    ));
  };

  return (
    <aside className="kp-sidebar">
      <div className="kp-sidebar-header">
        <div className="kp-sidebar-label">AI Agents</div>
      </div>
      <div className="kp-sidebar-scroll">
        <div className="kp-sidebar-top">
          {AGENT_KEYS.map((key) => (
            <AgentCard key={key} agentKey={key} isActive={currentAgent === key} />
          ))}
          <button className="kp-new-chat-btn" onClick={onNewSession}>
            ＋ New chat
          </button>
        </div>

        <div className="kp-sidebar-files">
          <div className="kp-sidebar-divider" />
          <div className="kp-sidebar-label" style={{ padding: '0 4px', marginBottom: 8 }}>Files</div>
          <FileUploadZone agentKey={currentAgent} onFiles={onFiles} />
          <FileList files={uploadedFiles} onRemove={onRemoveFile} />
        </div>

        <div className="kp-sessions-panel">
          <div className="kp-sidebar-divider" />
          <div className="kp-sidebar-label" style={{ padding: '0 4px', marginBottom: 8 }}>Recent Conversations</div>
          <div className="kp-sessions-section">
            <input
              className="kp-session-search"
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
              placeholder="Search chat titles..."
            />
            {filtered.length > 0 ? (
              <>
                {pinned.length > 0 && (
                  <>
                    <div className="kp-session-section-title">Pinned</div>
                    {renderList(pinned)}
                  </>
                )}
                {regular.length > 0 && (
                  <>
                    <div className="kp-session-section-title">Recent</div>
                    {renderList(regular)}
                  </>
                )}
              </>
            ) : (
              <div className="kp-empty-sessions">
                {sessions.length > 0 ? 'No conversations match that search.' : 'No conversations yet'}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
