'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

const SessionContext = createContext(null);

const AGENT_KEYS = ['intake', 'qa', 'score'];
let _counter = 0;
const makeId = () => `S${++_counter}_${Date.now()}`;
const emptyByAgent = () => Object.fromEntries(AGENT_KEYS.map((k) => [k, []]));
const nullByAgent  = () => Object.fromEntries(AGENT_KEYS.map((k) => [k, null]));

export function SessionProvider({ children }) {
  const [sessionsByAgent, setSessionsByAgent] = useState(emptyByAgent);

  // currentIdByAgent kept in both state (for re-renders) and a ref (for callbacks
  // that must read the latest value without becoming stale).
  const [currentIdByAgent, _setCurrentIdByAgent] = useState(nullByAgent);
  const currentIdRef = useRef(nullByAgent());
  const setCurrentIdByAgent = useCallback((updaterOrValue) => {
    _setCurrentIdByAgent((prev) => {
      const next = typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue;
      currentIdRef.current = next;
      return next;
    });
  }, []);

  // Files stored per session ID, not per agent.
  // Shape: { [sessionId]: File[] }
  const [filesBySession, setFilesBySession] = useState({});

  // Per-agent interceptors: a page can register a function that runs instead of
  // directly adding files. The interceptor receives (fileList) and is responsible
  // for calling commitFiles(fileList) when it's ready.
  // Shape: { [agentKey]: (fileList: File[], commitFiles: (fileList: File[]) => void) => void }
  const interceptorsRef = useRef({});

  const registerFileInterceptor = useCallback((agentKey, fn) => {
    interceptorsRef.current[agentKey] = fn;
  }, []);

  const unregisterFileInterceptor = useCallback((agentKey) => {
    delete interceptorsRef.current[agentKey];
  }, []);

  const newSession = useCallback((agentKey) => {
    const id = makeId();
    setSessionsByAgent((prev) => ({
      ...prev,
      [agentKey]: [
        { id, title: null, createdAt: Date.now(), messages: [], files: [], pinned: false },
        ...(prev[agentKey] || []),
      ],
    }));
    setCurrentIdByAgent((prev) => ({ ...prev, [agentKey]: id }));
    // New session starts with no files — no need to write to filesBySession
  }, [setCurrentIdByAgent]);

  const selectSession = useCallback((agentKey, id) => {
    setCurrentIdByAgent((prev) => ({ ...prev, [agentKey]: id }));
  }, [setCurrentIdByAgent]);

  const deleteSession = useCallback((agentKey, id) => {
    setSessionsByAgent((prev) => ({
      ...prev,
      [agentKey]: (prev[agentKey] || []).filter((s) => s.id !== id),
    }));
    setCurrentIdByAgent((prev) => ({
      ...prev,
      [agentKey]: prev[agentKey] === id ? null : prev[agentKey],
    }));
    // Clean up files for the deleted session
    setFilesBySession((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [setCurrentIdByAgent]);

  const renameSession = useCallback((agentKey, id, title) => {
    setSessionsByAgent((prev) => ({
      ...prev,
      [agentKey]: (prev[agentKey] || []).map((s) => s.id === id ? { ...s, title } : s),
    }));
  }, []);

  const togglePinSession = useCallback((agentKey, id) => {
    setSessionsByAgent((prev) => ({
      ...prev,
      [agentKey]: (prev[agentKey] || []).map((s) => s.id === id ? { ...s, pinned: !s.pinned } : s),
    }));
  }, []);

  const moveSession = useCallback((agentKey, id, direction) => {
    setSessionsByAgent((prev) => {
      const list = [...(prev[agentKey] || [])];
      const idx = list.findIndex((s) => s.id === id);
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= list.length) return prev;
      [list[idx], list[target]] = [list[target], list[idx]];
      return { ...prev, [agentKey]: list };
    });
  }, []);

  const commitFiles = useCallback((agentKey, fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const sessionId = currentIdRef.current[agentKey];
    if (!sessionId) return;
    setFilesBySession((prev) => {
      const existing = new Set((prev[sessionId] || []).map((f) => `${f.name}:${f.size}`));
      const fresh = incoming.filter((f) => !existing.has(`${f.name}:${f.size}`));
      if (!fresh.length) return prev;
      return { ...prev, [sessionId]: [...(prev[sessionId] || []), ...fresh] };
    });
  }, []);

  const addFiles = useCallback((agentKey, fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const interceptor = interceptorsRef.current[agentKey];
    if (interceptor) {
      interceptor(incoming, (files) => commitFiles(agentKey, files));
      return;
    }
    commitFiles(agentKey, incoming);
  }, [commitFiles]);

  const removeFile = useCallback((agentKey, index) => {
    const sessionId = currentIdRef.current[agentKey];
    if (!sessionId) return;
    setFilesBySession((prev) => ({
      ...prev,
      [sessionId]: (prev[sessionId] || []).filter((_, i) => i !== index),
    }));
  }, []);

  return (
    <SessionContext.Provider value={{
      sessionsByAgent,
      currentIdByAgent,
      filesBySession,
      newSession,
      selectSession,
      deleteSession,
      renameSession,
      togglePinSession,
      moveSession,
      addFiles,
      removeFile,
      registerFileInterceptor,
      unregisterFileInterceptor,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

// Convenience hook — returns sessions and bound handlers for one agent
export function useSession(agentKey) {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  const currentSessionId = ctx.currentIdByAgent[agentKey] || null;
  return {
    sessions: ctx.sessionsByAgent[agentKey] || [],
    currentSessionId,
    uploadedFiles: (currentSessionId ? ctx.filesBySession[currentSessionId] : null) || [],
    newSession: () => ctx.newSession(agentKey),
    selectSession: (id) => ctx.selectSession(agentKey, id),
    deleteSession: (id) => ctx.deleteSession(agentKey, id),
    renameSession: (id, title) => ctx.renameSession(agentKey, id, title),
    togglePinSession: (id) => ctx.togglePinSession(agentKey, id),
    moveSession: (id, direction) => ctx.moveSession(agentKey, id, direction),
    addFiles: (fileList) => ctx.addFiles(agentKey, fileList),
    removeFile: (index) => ctx.removeFile(agentKey, index),
    registerFileInterceptor: (fn) => ctx.registerFileInterceptor(agentKey, fn),
    unregisterFileInterceptor: () => ctx.unregisterFileInterceptor(agentKey),
  };
}
