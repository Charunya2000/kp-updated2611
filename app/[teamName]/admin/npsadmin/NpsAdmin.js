"use client";
import React, { useState } from 'react';
import {
  saveAdminText, getAdminText, triggerUserStoryLoad,
  triggerSharepointLoad, triggerIncidentDataLoad,
  validateConfluencePages,
  triggerConfluenceLoad, triggerScoreCardLoad, triggerReleaseNotesLoad
} from '../../../clientServices/npsAdminService';

// ── Helper: format yesterday as YYYY-MM-DD for input[type=date] ──
function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// ── Helper: convert YYYY-MM-DD to YYYY/MM/DD for JIRA ──
function toJiraDate(isoDate) {
  return isoDate.replace(/-/g, '/');
}

// ── StatusBadge component ──
function StatusBadge({ status }) {
  if (!status) return null;
  const colors = {
    SUCCESS: { bg: '#d4edda', color: '#155724' },
    PARTIAL_SUCCESS: { bg: '#fff3cd', color: '#856404' },
    FAILED: { bg: '#f8d7da', color: '#721c24' },
    LOADING: { bg: '#cce5ff', color: '#004085' },
  };
  const style = colors[status] || colors.LOADING;
  return (
    <span style={{ ...style, padding: '2px 10px', borderRadius: 4, fontWeight: 600, fontSize: '0.85rem' }}>
      {status}
    </span>
  );
}
export default function NpsAdmin() {
  const [nuid, setNuid] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [dialogJson, setDialogJson] = useState(null);

  // ── Data load state Added for NPS April Release 04/14/26

  const [imDate, setImDate] = useState(getYesterdayStr());
  const [imLoading, setImLoading] = useState(false);
  const [imResult, setImResult] = useState(null);

  const [usDate, setUsDate] = useState(getYesterdayStr());
  const [usLoading, setUsLoading] = useState(false);
  const [usResult, setUsResult] = useState(null);

  const [spDate, setSpDate] = useState(getYesterdayStr());
  const [spLoading, setSpLoading] = useState(false);
  const [spResult, setSpResult] = useState(null);

  const [confPageIds, setConfPageIds] = useState("");
  const [confLoading, setConfLoading] = useState(false);
  const [confValidation, setConfValidation] = useState(null);
  const [confResult, setConfResult] = useState(null);

  const [scorecardDate, setScorecardDate] = useState(getYesterdayStr());
  const [scorecardLoading, setscorecardLoading] = useState(false);
  const [scorecardResult, setscorecardResult] = useState(null);

  const [releaseNotesDate, setRNDate] = useState(getYesterdayStr());
  const [releaseNotesLoading, setRNLoading] = useState(false);
  const [releaseNotesResult, setRNResult] = useState(null);


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


  // ── Data Load handlers NPS April Release 4/14 Start

  const handleIncidentLoad = async () => {
    setImLoading(true); setImResult(null);
    const sinceISO = new Date(imDate).toISOString();

    const res = await triggerIncidentDataLoad(sinceISO);
    setImResult(res);
    setImLoading(false);
  };

  const handleUserStoryLoad = async () => {
    setUsLoading(true); setUsResult(null);
    const res = await triggerUserStoryLoad(toJiraDate(usDate));
    setUsResult(res);
    setUsLoading(false);
  };

  const handleSharepointLoad = async () => {
    setSpLoading(true); setSpResult(null);
    const sinceISO = new Date(spDate).toISOString();
    const res = await triggerSharepointLoad(sinceISO);
    setSpResult(res);
    setSpLoading(false);
  };

  const handleConfluenceValidate = async () => {
    setConfLoading(true); setConfValidation(null); setConfResult(null);
    const ids = confPageIds.split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      setConfValidation({ success: false, error: 'Enter at least one page ID' });
      setConfLoading(false);
      return;
    }
    const res = await validateConfluencePages(ids);
    setConfValidation(res);
    setConfLoading(false);
  };

  const handleConfluenceLoad = async () => {
    setConfLoading(true); setConfResult(null);
    const ids = confPageIds.split(',').map(s => s.trim()).filter(Boolean);
    const res = await triggerConfluenceLoad(ids);
    setConfResult(res);
    setConfLoading(false);
  };

  const handleScoreCardLoad = async () => {
    setscorecardLoading(true); setscorecardResult(null);
    const res = await triggerScoreCardLoad();
    setscorecardResult(res);
    setscorecardLoading(false);
  };

  const handleReleaseNotesLoad = async () => {
    setRNLoading(true); setRNResult(null);
    const sinceISO = new Date(releaseNotesDate).toISOString();
    const res = await triggerReleaseNotesLoad(sinceISO);
    //console.log("Release")
    setRNResult(res);
    setRNLoading(false);
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

  const confValidated = confValidation?.success && confValidation?.summary?.invalid === 0;

  //End - NPS April Release 4/14

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
      <h1>NPS Admin Page</h1>
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

      {/* ── Data Load Jobs Section ──NPS April Release 4/14/26 Start */}
      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '2px solid #ddd' }} />
      <h2>📊 Daily Data Load Jobs</h2>

      {/* ── ServiceNow Load ── */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 0.8rem 0' }}>📁 ServiceNow Data Load</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 0.8rem 0' }}>
          Scans ServiceNow for recent incident and uploads to <code>nps-incident-001</code> index.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem' }}>From date:</label>
          <input type="date" value={imDate} onChange={e => setImDate(e.target.value)} style={inputStyle} />
          <button onClick={handleIncidentLoad} disabled={imLoading}
            style={{ ...btnStyle, background: imLoading ? '#999' : '#28a1a7' }}>
            {imLoading ? '⏳ Loading...' : '🚀 Load Incident Data'}
          </button>
        </div>
        {imResult && (
          <div style={{ marginTop: '0.8rem' }}>
            <StatusBadge status={imResult.verification?.status || (imResult.success ? 'SUCCESS' : 'FAILED')} />
            <pre style={{ background: '#f4f4f4', padding: '0.8rem', borderRadius: 6, fontSize: '0.85rem', marginTop: '0.5rem', maxHeight: 250, overflow: 'auto' }}>
              {JSON.stringify(imResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* ── User Story Load ── */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 0.8rem 0' }}>📋 User Story Data Load</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 0.8rem 0' }}>
          Fetches new JIRA user stories and uploads to <code>nps-userstory-001</code> index.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem' }}>Since date:</label>
          <input type="date" value={usDate} onChange={e => setUsDate(e.target.value)} style={inputStyle} />
          <button onClick={handleUserStoryLoad} disabled={usLoading}
            style={{ ...btnStyle, background: usLoading ? '#999' : '#0070f3' }}>
            {usLoading ? '⏳ Loading...' : '🚀 Load User Stories'}
          </button>
        </div>
        {usResult && (
          <div style={{ marginTop: '0.8rem' }}>
            <StatusBadge status={usResult.verification?.status || (usResult.success ? 'SUCCESS' : 'FAILED')} />
            <pre style={{ background: '#f4f4f4', padding: '0.8rem', borderRadius: 6, fontSize: '0.85rem', marginTop: '0.5rem', maxHeight: 250, overflow: 'auto' }}>
              {JSON.stringify(usResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* ── SharePoint Load ── */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 0.8rem 0' }}>📁 SharePoint Data Load</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 0.8rem 0' }}>
          Scans SharePoint for new/modified files and uploads to <code>nps-knowledge-001</code> index.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem' }}>Since date:</label>
          <input type="date" value={spDate} onChange={e => setSpDate(e.target.value)} style={inputStyle} />
          <button onClick={handleSharepointLoad} disabled={spLoading}
            style={{ ...btnStyle, background: spLoading ? '#999' : '#28a745' }}>
            {spLoading ? '⏳ Loading...' : '🚀 Load SharePoint Data'}
          </button>
        </div>
        {spResult && (
          <div style={{ marginTop: '0.8rem' }}>
            <StatusBadge status={spResult.verification?.status || (spResult.success ? 'SUCCESS' : 'FAILED')} />
            <pre style={{ background: '#f4f4f4', padding: '0.8rem', borderRadius: 6, fontSize: '0.85rem', marginTop: '0.5rem', maxHeight: 250, overflow: 'auto' }}>
              {JSON.stringify(spResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* ── Confluence Load ── */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 0.8rem 0' }}>📚 Confluence Data Load</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 0.8rem 0' }}>
          Extracts content from Confluence pages and uploads to <code>nps-knowledge-001</code> index.
        </p>
        <div style={{ marginBottom: '0.8rem' }}>
          <label style={{ fontSize: '0.9rem', display: 'block', marginBottom: '0.3rem' }}>Root Page IDs (comma-separated):</label>
          <input type="text" value={confPageIds} onChange={e => setConfPageIds(e.target.value)}
            style={{ ...inputStyle, width: '100%', marginRight: 0 }}
            placeholder="e.g. 387915559, 295111925" />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={handleConfluenceValidate} disabled={confLoading || !confPageIds.trim()}
            style={{ ...btnStyle, background: confLoading ? '#999' : '#6f42c1' }}>
            {confLoading && !confResult ? '⏳ Validating...' : '🔍 Validate Pages'}
          </button>
          <button onClick={handleConfluenceLoad}
            disabled={confLoading || !confValidated}
            title={!confValidated ? 'Validate pages first' : ''}
            style={{ ...btnStyle, background: (!confValidated || confLoading) ? '#999' : '#fd7e14', cursor: confValidated ? 'pointer' : 'not-allowed' }}>
            {confLoading && confResult ? '⏳ Loading...' : '🚀 Load Confluence Data'}
          </button>
        </div>

        {confValidation && (
          <div style={{ marginTop: '0.8rem' }}>
            <strong>Validation:</strong>
            <pre style={{ background: confValidated ? '#d4edda' : '#fff3cd', padding: '0.8rem', borderRadius: 6, fontSize: '0.85rem', marginTop: '0.3rem', maxHeight: 200, overflow: 'auto' }}>
              {confValidation.message || JSON.stringify(confValidation, null, 2)}
            </pre>
            {confValidation.validation && (
              <div style={{ marginTop: '0.3rem' }}>
                {confValidation.validation.map((v, i) => (
                  <div key={i} style={{ fontSize: '0.85rem', padding: '0.2rem 0' }}>
                    {v.status === 'valid' ? '✅' : '❌'} <strong>{v.pageId}</strong>: {v.title || v.error}
                    {v.directChildPages != null && ` (${v.directChildPages} direct children)`}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {confResult && (
          <div style={{ marginTop: '0.8rem' }}>
            <StatusBadge status={confResult.verification?.status || (confResult.success ? 'SUCCESS' : 'FAILED')} />
            <pre style={{ background: '#f4f4f4', padding: '0.8rem', borderRadius: 6, fontSize: '0.85rem', marginTop: '0.5rem', maxHeight: 250, overflow: 'auto' }}>
              {JSON.stringify(confResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* ── ScoreCard Data Load ── */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 0.8rem 0' }}>📋 ScoreCard Data Load</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 0.8rem 0' }}>
          Fetches latest scorecard report from NPS STG.NPG_SCORECARD table and uploads to <code>NPS_SCORECARD </code> Collection.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button onClick={handleScoreCardLoad} disabled={scorecardLoading}
            style={{ ...btnStyle, background: scorecardLoading ? '#999' : '#0070f3' }}>
            {scorecardLoading ? '⏳ Loading...' : '🚀 Load ScoreCard Records'}
          </button>
        </div>
        {scorecardResult && (
          <div style={{ marginTop: '0.8rem' }}>
            <StatusBadge status={scorecardResult.verification?.status || (scorecardResult.success ? 'SUCCESS' : 'FAILED')} />
            <pre style={{ background: '#f4f4f4', padding: '0.8rem', borderRadius: 6, fontSize: '0.85rem', marginTop: '0.5rem', maxHeight: 250, overflow: 'auto' }}>
              {JSON.stringify(scorecardResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
      {/* ── SharePoint Load ── */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 0.8rem 0' }}>📁 Release Notes Data Load</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 0.8rem 0' }}>
          Scans Confluence for new/modified UAT Releases and uploads to MongoDB.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem' }}>Since date:</label>
          <input type="date" value={releaseNotesDate} onChange={e => setRNDate(e.target.value)} style={inputStyle} />
          <button onClick={handleReleaseNotesLoad} disabled={releaseNotesLoading}
            style={{ ...btnStyle, background: releaseNotesLoading ? '#999' : '#28a745' }}>
            {releaseNotesLoading ? '⏳ Loading...' : '🚀 Load Release Notes Data'}
          </button>
        </div>
        {releaseNotesResult && (
          <div style={{ marginTop: '0.8rem' }}>
            <StatusBadge status={releaseNotesResult.verification?.status || (releaseNotesResult.success ? 'SUCCESS' : 'FAILED')} />
            <pre style={{ background: '#f4f4f4', padding: '0.8rem', borderRadius: 6, fontSize: '0.85rem', marginTop: '0.5rem', maxHeight: 250, overflow: 'auto' }}>
              {JSON.stringify(releaseNotesResult, null, 2)}
            </pre>
          </div>
        )}
      </div>


      {/* ──NPS April release 4/14/26 End ── */}



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
