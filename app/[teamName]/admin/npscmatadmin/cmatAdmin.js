"use client";
import React, { useState } from 'react';
import {
  saveAdminText, getAdminText,
} from '../../../clientServices/npsCmatAdminService';


export default function CMATAdmin() {
  const [nuid, setNuid] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [dialogJson, setDialogJson] = useState(null);


  // - April Release 04/14/26 End

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await saveAdminText({ nuid, text });
      setResult({ success: true, data: response });
    } catch (error) {
      setResult({ success: false, error: error.message });
    }
    setLoading(false);
  };

  const handleLoad = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await getAdminText(nuid);
      if (response.success && Array.isArray(response.data) && response.data.length > 0) {
        setText(response.data[response.data.length - 1].text || "");
      } else {
        setText("");
        setLoadError("No admin text found for this NUID.");
      }
    } catch (error) {
      setLoadError(error.message);
    }
    setLoading(false);
  };



  // ── Shared styles ──
  const cardStyle = {
    border: '1px solid #ddd', borderRadius: 8, padding: '1.2rem', marginBottom: '1rem',
    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
  };
  const btnStyle = {
    padding: '0.5rem 1.2rem', fontSize: '0.95rem', borderRadius: 4, border: 'none',
    color: '#fff', cursor: 'pointer', marginRight: '0.5rem'
  };
  const inputStyle = {
    padding: '0.4rem 0.6rem', fontSize: '0.95rem', border: '1px solid #ccc',
    borderRadius: 4, marginRight: '0.5rem'
  };


  // Helper component to render JSON with hyperlinks for stringified JSON values
  function JsonWithLinks({ data, onJsonLink }) {
    if (!data) return null;
    const renderValue = function (val) {
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          if (typeof parsed === 'object' && parsed !== null) {
            return React.createElement('a', {
              href: '#',
              style: { color: '#0070f3', textDecoration: 'underline' },
              onClick: e => { e.preventDefault(); onJsonLink(parsed); }
            }, '[JSON]');
          }
        } catch (e) {
          // Not valid JSON, just render as string
        }
        return React.createElement('span', null, val);
      }
      if (Array.isArray(val)) {
        return React.createElement('span', null,
          '[',
          val.map((v, i) => React.createElement('span', { key: i }, renderValue(v), i < val.length - 1 ? ', ' : '')),
          ']'
        );
      }
      if (typeof val === 'object' && val !== null) {
        return React.createElement('span', null,
          '{',
          Object.entries(val).map(([k, v], i) => React.createElement('span', { key: k },
            React.createElement('strong', null, k), ': ', renderValue(v), i < Object.keys(val).length - 1 ? ', ' : '')),
          '}'
        );
      }
      return React.createElement('span', null, String(val));
    };
    return React.createElement('pre', {
      style: { background: '#f4f4f4', padding: '1rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '1rem' }
    }, renderValue(data));
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 700, margin: 'auto' }}>
      <h1>CMAT Admin Page</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={nuid}
          onChange={e => setNuid(e.target.value)}
          style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem', fontSize: '1rem' }}
          placeholder="Enter NUID..."
          required
        />
        <button type="button" onClick={handleLoad} disabled={loading || !nuid} style={{ marginBottom: '1rem', padding: '0.5rem 1rem', fontSize: '1rem' }}>
          {loading ? 'Loading...' : 'Load Current Admin Text'}
        </button>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={16}
          style={{ width: '100%', fontSize: '1rem', marginBottom: '1rem', fontFamily: 'monospace', background: '#f4f4f4', color: '#222', border: '1px solid #ccc', padding: '1rem' }}
          placeholder="Enter JSON config here..."
          required
        />
        <button type="submit" disabled={loading} style={{ padding: '0.5rem 1.5rem', fontSize: '1rem' }}>
          {loading ? 'Saving...' : 'Save'}
        </button>
      </form>
      {loadError && (
        <div style={{ color: 'red', marginTop: '1rem' }}>{loadError}</div>
      )}
      {result && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Result:</strong>
          <JsonWithLinks data={result.data} onJsonLink={setDialogJson} />
        </div>
      )}



      {dialogJson && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 1000 }} onClick={() => setDialogJson(null)}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', maxWidth: '600px', margin: '10vh auto', boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h2>JSON Value</h2>
            <pre style={{ fontFamily: 'monospace', fontSize: '1rem', background: '#f4f4f4', padding: '1rem', borderRadius: '6px' }}>{JSON.stringify(dialogJson, null, 2)}</pre>
            <button style={{ marginTop: '1rem', padding: '0.5rem 1rem' }} onClick={() => setDialogJson(null)}>Close</button>
          </div>
        </div>
      )}
    </main>
  );
}
