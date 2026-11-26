'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
  Metric,
  Link,
  TextField,
  Stack,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DownloadIcon from '@mui/icons-material/Download';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import EmailIcon from '@mui/icons-material/Email';
import { useAuth } from '@/app/contexts/OpenIdAuthContext';
import { sendEmailFromPortal } from '@/app/clientServices/emailService';


const getErrorMessage = async (response) => {
  try {
    const data = await response.json();
    if (typeof data.detail === 'string') return data.detail;
    if (data.message) return data.message;
    return `Request failed with status ${response.status}`;
  } catch {
    const text = await response.text();
    return text || `Request failed with status ${response.status}`;
  }
};

const PerformanceReport = ({ analysisResult, sessionId, apiBaseUrl, analysisError }) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const { user } = useAuth();
  const currentUserNUID = user?.nuid || user?.userId || user?.id || '';

  useEffect(() => {
    console.log('[PerformanceReport] analysisError prop:', analysisError);
    if (analysisError) {
      setError(analysisError);
      setReportData(null);
    }
  }, [analysisError]);


  // Simple markdown to HTML converter
  const renderMarkdown = (markdown) => {
    if (!markdown) return '';

    // Remove code fence markers
    let html = markdown.replace(/```markdown\n?/g, '').replace(/```\n?$/g, '');

    // Convert headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Convert bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Convert horizontal rules
    html = html.replace(/^---$/gim, '<hr />');

    // Convert unordered lists
    html = html.replace(/^\- (.+)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Convert tables
    const lines = html.split('\n');
    let inTable = false;
    let tableHTML = '';
    let processedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if line is a table row
      if (line.trim().startsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHTML = '<table class="markdown-table">';

          // Check if next line is separator
          const nextLine = lines[i + 1];
          const isHeader = nextLine && nextLine.includes('---');

          if (isHeader) {
            tableHTML += '<thead><tr>';
            const cells = line.split('|').filter(c => c.trim());
            cells.forEach(cell => {
              tableHTML += `<th>${cell.trim()}</th>`;
            });
            tableHTML += '</tr></thead><tbody>';
            i++; // Skip separator line
          } else {
            tableHTML += '<tbody><tr>';
            const cells = line.split('|').filter(c => c.trim());
            cells.forEach(cell => {
              tableHTML += `<td>${cell.trim()}</td>`;
            });
            tableHTML += '</tr>';
          }
        } else {
          tableHTML += '<tr>';
          const cells = line.split('|').filter(c => c.trim());
          cells.forEach(cell => {
            tableHTML += `<td>${cell.trim()}</td>`;
          });
          tableHTML += '</tr>';
        }
      } else if (inTable) {
        // End of table
        tableHTML += '</tbody></table>';
        processedLines.push(tableHTML);
        tableHTML = '';
        inTable = false;
        processedLines.push(line);
      } else {
        processedLines.push(line);
      }
    }

    if (inTable) {
      tableHTML += '</tbody></table>';
      processedLines.push(tableHTML);
    }

    html = processedLines.join('\n');

    // Convert line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>(<h[123]>)/g, '$1');
    html = html.replace(/(<\/h[123]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr \/>)<\/p>/g, '$1');
    html = html.replace(/<p>(<table)/g, '$1');
    html = html.replace(/(<\/table>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');

    return html;
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setError('');

      let reportEndpoint = '';
      if (analysisResult && analysisResult.progress_url) {
        reportEndpoint = analysisResult.progress_url;        // /api/pts/progress/...
      } else {
        reportEndpoint = `/api/pts/session/${sessionId}`;    // /api/pts/session/...
      }

      console.log('[PerformanceReport] sessionId:', sessionId);
      console.log('[PerformanceReport] analysisResult:', analysisResult);
      console.log('[PerformanceReport] chosen endpoint:', reportEndpoint);


      const response = await fetch(reportEndpoint);

      if (!response.ok) {
        const msg = await getErrorMessage(response);
        throw new Error(msg);
      }

      const data = await response.json();

      console.log('[PerformanceReport] data from backend:', data);


      // 1) If calling progress endpoint and it failed: use progress.error_message
      if (data.status === 'failed' && data.progress?.error_message) {
        setError(data.progress.error_message);
      }

      // 2) If calling session endpoint and it failed: use error_message
      if (data.status === 'failed' && data.error_message) {
        setError(data.error_message);
      }


      setReportData(data);
    } catch (err) {
      console.error('[PerformanceReport/fetchReportData] Error:', err);
      setError(err.message || 'An error occurred while fetching the report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchReportData();
    }
  }, [sessionId, analysisResult]);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSendReportEmail = async (reportUrl) => {
    setEmailStatus(null);

    const trimmed = (emailRecipients || '').trim();
    if (!trimmed) {
      setEmailStatus({ severity: 'error', message: 'Enter at least one recipient email.' });
      return;
    }

    const tokens = [...new Set(
      trimmed.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
    )];
    const invalid = tokens.filter((t) => !EMAIL_REGEX.test(t));
    if (invalid.length > 0) {
      setEmailStatus({
        severity: 'error',
        message: `Invalid email address: ${invalid.join(', ')}`,
      });
      return;
    }

    try {
      setEmailSending(true);

      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const subject = `Performance Report${sessionId ? ` — ${sessionId}` : ''}`;
      const text =
        `This is the performance report generated by the Performance Team AI Solutions on ${today}.\n\n` +
        `Session ID: ${sessionId || 'N/A'}\n\n` +
        `Click the link below to download the report:\n${reportUrl}\n\n` +
        `Note: This download link is read-only and will expire in 7 days.\n\n` +
        `--\nThis is an automated message. Please do not reply to this email.`;
      const html =
        `<p>This is the performance report generated by the Performance Team AI Solutions on <strong>${today}</strong>.</p>` +
        `<p><strong>Session ID:</strong> ${sessionId || 'N/A'}</p>` +
        `<p><a href="${reportUrl}" style="display:inline-block;padding:10px 20px;background-color:#0066cc;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;">Download Report</a></p>` +
        `<p style="font-size:0.85em;color:#666;">&#9432;&nbsp;This download link is read-only and will expire in <strong>7 days</strong>.</p>` +
        `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd;" />` +
        `<p style="font-size:0.8em;color:#888;">This is an automated message. Please do not reply to this email.</p>`;


      const result = await sendEmailFromPortal({
        recipients: tokens,
        subject,
        text,
        html,
        sessionId,
        createdByNUID: currentUserNUID,
      });
      setEmailStatus({
        severity: 'success',
        message: `Email sent to ${result.recipientCount || tokens.length} recipient(s).`,
      });
      setEmailRecipients('');
    } catch (err) {
      setEmailStatus({
        severity: 'error',
        message: err?.message || 'Failed to send email',
      });
    } finally {
      setEmailSending(false);
    }
  };

  const renderEmailReportCard = (reportUrl) => (
    <Card sx={{ mb: 3 }}>
      <CardHeader title="Email Report Link" />
      <Divider />
      <CardContent>
        <Stack direction="column" spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Enter one or more recipient email addresses (comma-separated) to email
            them the download link for this performance report.
          </Typography>
          <TextField
            label="Recipient email(s)"
            placeholder="user1@kp.org, user2@kp.org"
            fullWidth
            value={emailRecipients}
            onChange={(e) => setEmailRecipients(e.target.value)}
            disabled={emailSending}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              startIcon={<EmailIcon />}
              onClick={() => handleSendReportEmail(reportUrl)}
              disabled={emailSending || !emailRecipients.trim()}
            >
              {emailSending ? 'Sending...' : 'Send Email'}
            </Button>
          </Box>
          {emailStatus && (
            <Alert severity={emailStatus.severity}>{emailStatus.message}</Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );

  const downloadCSV = (data, filename) => {
    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map((row) =>
        Object.values(row)
          .map((v) => `"${v}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  // If no analysisResult but reportData exists, show report link only
  if (!analysisResult && reportData) {
    const { report_url } = reportData;
    return (
      <Card>
        <CardContent>
          {report_url && report_url.trim() ? (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                Report available for this session.
                <Button
                  variant="primary"
                  size="large"
                  startIcon={<FileDownloadIcon />}
                  href={report_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    ml: 2,
                    color: 'white !important',
                    '& .MuiButton-startIcon': {
                      color: 'white'
                    }
                  }}
                >
                  Download Performance Report
                </Button>
              </Alert>
              {renderEmailReportCard(report_url)}
            </>
          ) : (
            <Alert severity="info">
              Run analysis to generate a new performance report
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  // If no data at all
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />

          </Box>
        </CardContent>
      </Card>
    );
  }

  if (!reportData) {
    return (
      <Card>
        <CardContent>
          {error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            <Alert severity="info">
              Run analysis to generate the performance report
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }


  const {
    summary,
    condensed_summary,
    report,
    recommendation = [],
    report_url,
    status,
  } = reportData;

  // Check if analysis hasn't been run yet
  if (status === 'not_started' || (!summary && !condensed_summary && !report)) {
    return (
      <Card>
        <CardContent>
          <Alert severity="info">
            Run the analysis to generate the executive summary and report
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Helper function to extract table data and create collapsible sections
  const processTablesForReact = (htmlContent) => {
    if (!htmlContent) return { processedHtml: '', tables: [] };

    // Create a temporary DOM element to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    const bodyElement = tempDiv.querySelector('body');
    const contentElement = bodyElement || tempDiv;

    // Remove script and style elements for security
    const scripts = contentElement.querySelectorAll('script');
    const styles = contentElement.querySelectorAll('style');
    scripts.forEach(script => script.remove());
    styles.forEach(style => style.remove());

    // Extract tables and their data
    const tables = [];
    const tableElements = contentElement.querySelectorAll('table');

    tableElements.forEach((table, index) => {
      // Extract table data
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length > 0) {
        const tableData = rows.map(row => {
          const cells = Array.from(row.querySelectorAll('th, td'));
          return cells.map(cell => cell.textContent.trim());
        });

        // Find the table title (look for preceding h2, h3, etc.)
        let tableTitle = `Analysis Data ${index + 1}`;
        let prevElement = table.previousElementSibling;

        // Helper function to extract clean text from HTML content
        const extractCleanTitle = (element) => {
          if (!element) return null;

          let text = element.textContent.trim();

          // If the element contains HTML tags, try to extract meaningful text
          if (element.innerHTML && element.innerHTML !== text) {
            // Look for strong, bold, h tags within the element
            const strongEl = element.querySelector('strong, b, h1, h2, h3, h4, h5, h6');
            if (strongEl) {
              text = strongEl.textContent.trim();
            }

            // If still no good title, try to extract first meaningful text before colon
            if (!text || text.length < 3) {
              const htmlContent = element.innerHTML;
              const strongMatch = htmlContent.match(/<(?:strong|b|h[1-6])[^>]*>([^<]+):<?\//);
              if (strongMatch) {
                text = strongMatch[1].trim();
              } else {
                // Look for any text followed by colon
                const colonMatch = htmlContent.match(/([^<>\n]{3,50}):/);
                if (colonMatch) {
                  text = colonMatch[1].trim();
                }
              }
            }
          }

          // Clean up the text
          if (text) {
            text = text.replace(/[:\s]+$/, '').trim(); // Remove trailing colons and spaces
            // Ignore generated placeholder tokens (e.g. [TABLE_PLACEHOLDER_6])
            if (/^\[TABLE_PLACEHOLDER_\d+\]$/i.test(text)) {
              return null;
            }
            if (text.length > 2 && text.length < 100 && !text.includes('\n')) {
              return text;
            }
          }

          return null;
        };

        // Look for the immediate preceding header
        while (prevElement) {
          // Skip generated placeholder nodes inserted during processing
          if (prevElement.getAttribute && prevElement.getAttribute('data-table-id')) {
            prevElement = prevElement.previousElementSibling;
            continue;
          }

          if (prevElement.tagName && prevElement.tagName.match(/^H[1-6]$/)) {
            const cleanTitle = extractCleanTitle(prevElement);
            if (cleanTitle) {
              tableTitle = cleanTitle;
              break;
            }
          }

          // Also check for text content in div or p elements that might be titles
          if (prevElement.tagName && (prevElement.tagName === 'DIV' || prevElement.tagName === 'P')) {
            const cleanTitle = extractCleanTitle(prevElement);
            if (cleanTitle) {
              tableTitle = cleanTitle;
              break;
            }
          }

          prevElement = prevElement.previousElementSibling;
        }

        // If we still have a generic title, look at the parent container or table wrapper
        if (tableTitle.startsWith('Analysis Data')) {
          let parentElement = table.parentElement;
          while (parentElement && parentElement !== contentElement) {
            // Check if parent has a title attribute or data attribute
            const titleAttr = parentElement.getAttribute('title') || parentElement.getAttribute('data-title');
            if (titleAttr) {
              tableTitle = titleAttr;
              break;
            }

            // Look for a preceding sibling of the parent that might be a title
            let siblingElement = parentElement.previousElementSibling;
            if (siblingElement && siblingElement.tagName && siblingElement.tagName.match(/^H[1-6]$/)) {
              tableTitle = siblingElement.textContent.trim();
              break;
            }

            parentElement = parentElement.parentElement;
          }
        }

        tables.push({
          id: `table-${index}`,
          title: tableTitle,
          data: tableData,
          html: table.outerHTML
        });

        // Replace table with placeholder
        const placeholder = document.createElement('div');
        placeholder.setAttribute('data-table-id', `table-${index}`);
        placeholder.textContent = `[TABLE_PLACEHOLDER_${index}]`;
        table.parentNode.replaceChild(placeholder, table);
      }
    });

    // Clean up any inline styles that might conflict with our styling
    const elementsWithStyle = contentElement.querySelectorAll('*[style]');
    elementsWithStyle.forEach(element => {
      if (!element.tagName.match(/^(TABLE|TH|TD)$/)) {
        const currentStyle = element.getAttribute('style') || '';
        let cleanedStyle = currentStyle
          .replace(/color\s*:\s*[^;]+;?/gi, '')
          .replace(/font-family\s*:\s*[^;]+;?/gi, '')
          .replace(/font-size\s*:\s*[^;]+;?/gi, '')
          .replace(/background-color\s*:\s*[^;]+;?/gi, '')
          .replace(/background\s*:\s*[^;]+;?/gi, '')
          .replace(/border-left\s*:\s*[^;]+;?/gi, '')
          .replace(/border-radius\s*:\s*[^;]+;?/gi, '')
          .replace(/padding\s*:\s*[^;]+;?/gi, '')
          .replace(/margin\s*:\s*[^;]+;?/gi, '')
          .replace(/margin-top\s*:\s*[^;]+;?/gi, '')
          .replace(/margin-bottom\s*:\s*[^;]+;?/gi, '')
          .replace(/margin-left\s*:\s*[^;]+;?/gi, '')
          .replace(/margin-right\s*:\s*[^;]+;?/gi, '');
        element.setAttribute('style', cleanedStyle);
      }
    });

    return {
      processedHtml: contentElement.innerHTML,
      tables
    };
  };

  // Helper function to extract content from HTML report with consistent formatting
  const extractHtmlContent = (htmlContent) => {
    if (!htmlContent) return { processedHtml: '', tables: [] };

    const result = processTablesForReact(htmlContent);

    // Normalize header hierarchy for consistent formatting
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = result.processedHtml;

    const headers = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headers.forEach(header => {
      const text = header.textContent.trim().toLowerCase();

      // Main section headers should be h2
      if (text.includes('overall summary') ||
        text.includes('executive summary') ||
        text.includes('performance summary') ||
        text.includes('detailed breakdown') ||
        text.includes('loadrunner analysis') ||
        text.includes('error per second analysis') ||
        text.includes('http error analysis') ||
        text.includes('dynatrace analysis') ||
        text.includes('azure analysis')) {
        if (header.tagName !== 'H2') {
          const newHeader = document.createElement('h2');
          newHeader.innerHTML = header.innerHTML;
          header.parentNode.replaceChild(newHeader, header);
        }
      }
      // Sub-section headers should be h3
      else if (header.tagName === 'H1' || header.tagName === 'H4' || header.tagName === 'H5' || header.tagName === 'H6') {
        const newHeader = document.createElement('h3');
        newHeader.innerHTML = header.innerHTML;
        header.parentNode.replaceChild(newHeader, header);
      }
    });

    return {
      processedHtml: tempDiv.innerHTML,
      tables: result.tables
    };
  };

  // Determine what content to display (prioritize HTML report, then condensed_summary, then summary)
  let displayContent = '';
  let isHtmlContent = false;
  let extractedTables = [];

  if (report && typeof report === 'string' && report.trim().startsWith('<!DOCTYPE html>')) {
    const result = extractHtmlContent(report);
    displayContent = result.processedHtml;
    extractedTables = result.tables;
    isHtmlContent = true;
  } else if (condensed_summary) {
    displayContent = condensed_summary;
    isHtmlContent = false;
  } else if (summary) {
    displayContent = summary;
    isHtmlContent = false;
  }

  // Helper function to render content with collapsible tables
  const renderContentWithTables = (htmlContent, tables) => {
    if (!tables || tables.length === 0) {
      return <Box dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    }

    // Split content by table placeholders
    let processedContent = htmlContent;
    const sections = [];

    tables.forEach((table, index) => {
      const placeholder = `[TABLE_PLACEHOLDER_${index}]`;
      const parts = processedContent.split(placeholder);

      if (parts.length > 1) {
        // Add content before table
        if (parts[0].trim()) {
          sections.push({
            type: 'content',
            html: parts[0],
            key: `content-${index}`
          });
        }

        // Add collapsible table
        sections.push({
          type: 'table',
          table: table,
          key: `table-${index}`
        });

        // Update content to remaining parts
        processedContent = parts.slice(1).join(placeholder);
      }
    });

    // Add remaining content
    if (processedContent.trim()) {
      sections.push({
        type: 'content',
        html: processedContent,
        key: 'content-final'
      });
    }

    return (
      <Box>
        {sections.map((section, index) => {
          if (section.type === 'content') {
            return (
              <Box key={section.key} dangerouslySetInnerHTML={{ __html: section.html }} />
            );
          } else if (section.type === 'table') {
            return (
              <Accordion key={section.key} sx={{ my: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">{section.table.title}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ width: '100%' }}>
                    <Box
                      sx={{
                        overflowX: 'auto',
                        '& table': {
                          minWidth: '100%',
                          borderCollapse: 'collapse',
                          border: '1px solid #ddd',
                          backgroundColor: 'white',
                        },
                        '& table th': {
                          backgroundColor: '#3498db !important',
                          color: 'white !important',
                          padding: '12px 8px !important',
                          textAlign: 'left',
                          fontWeight: 'bold !important',
                          border: '1px solid #2980b9 !important',
                          fontSize: '0.875rem',
                        },
                        '& table td': {
                          padding: '8px !important',
                          border: '1px solid #ddd !important',
                          fontSize: '0.875rem',
                          color: '#333 !important',
                        },
                        '& table tbody tr:hover': {
                          backgroundColor: '#f5f5f5 !important',
                        },
                      }}
                    >
                      <Box
                        dangerouslySetInnerHTML={{ __html: section.table.html }}
                      />
                    </Box>
                    <Button
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => downloadCSV(section.table.data, `${sessionId}_${section.table.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`)}
                      sx={{ mt: 1 }}
                    >
                      Download CSV
                    </Button>
                  </Box>
                </AccordionDetails>
              </Accordion>
            );
          }
          return null;
        })}
      </Box>
    );
  };

  return (
    <Box sx={{ pb: 3 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Download PDF Button */}
      {report_url && report_url.trim() && (
        <>
          <Alert severity="success" sx={{ mb: 2 }}>
            Report generated successfully!
            <Button
              variant="primary"
              size="large"
              startIcon={<FileDownloadIcon />}
              href={report_url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                ml: 2,
                color: 'white !important',
                '& .MuiButton-startIcon': {
                  color: 'white'
                }
              }}
            >
              Download Performance Report
            </Button>
          </Alert>
          {renderEmailReportCard(report_url)}
        </>
      )}

      {/* Summary Report */}
      {displayContent && (
        <Card sx={{ mb: 3 }}>
          <CardHeader title="Summary Report" />
          <Divider />
          <CardContent>
            {isHtmlContent ? (
              <Box
                sx={{
                  '& h1': {
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    borderBottom: '3px solid #3498db',
                    pb: 1,
                    mb: 2,
                    mt: 2,
                  },
                  '& h2': {
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#34495e',
                    borderBottom: '2px solid #95a5a6',
                    pb: 1,
                    mt: 3,
                    mb: 2,
                  },
                  '& h3': {
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    color: '#555',
                    mt: 2,
                    mb: 1,
                  },
                  '& h4': {
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    color: '#666',
                    mt: 2,
                    mb: 1,
                  },
                  '& p': {
                    mb: 1,
                    lineHeight: 1.6,
                  },
                  '& ul': {
                    ml: 3,
                    mb: 2,
                  },
                  '& ol': {
                    ml: 3,
                    mb: 2,
                  },
                  '& li': {
                    mb: 0.5,
                  },
                  '& hr': {
                    border: 'none',
                    borderTop: '1px solid #ddd',
                    my: 2,
                  },
                  '& strong': {
                    fontWeight: 'bold',
                    color: '#2c3e50',
                  },
                  '& em': {
                    fontStyle: 'italic',
                  },
                  // Status indicators
                  '& .status-met': {
                    color: '#2e7d32',
                    fontWeight: 'bold',
                    fontSize: '1.1em',
                    padding: '10px',
                    backgroundColor: '#e8f5e9',
                    borderRadius: '5px',
                    display: 'inline-block',
                    margin: '10px 0',
                  },
                  '& .status-not-met': {
                    color: '#c62828',
                    fontWeight: 'bold',
                    fontSize: '1.1em',
                    padding: '10px',
                    backgroundColor: '#ffebee',
                    borderRadius: '5px',
                    display: 'inline-block',
                    margin: '10px 0',
                  },
                  // Hide the header from HTML report since we have our own
                  '& .header': {
                    display: 'none',
                  },
                  '& .container': {
                    boxShadow: 'none',
                    background: 'transparent',
                    borderRadius: 0,
                  },
                  // Style divs that might contain analysis sections
                  '& div[style*="border-left"]': {
                    borderLeft: '4px solid #3498db !important',
                    paddingLeft: '16px !important',
                    marginBottom: '16px !important',
                  },
                  // Ensure consistent font family
                  '& *': {
                    fontFamily: 'inherit',
                    maxWidth: '100%',
                  },
                }}
              >
                {renderContentWithTables(displayContent, extractedTables)}
              </Box>
            ) : (
              <Box
                sx={{
                  '& h1': {
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    borderBottom: '3px solid #3498db',
                    pb: 1,
                    mb: 2,
                    mt: 2,
                  },
                  '& h2': {
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#34495e',
                    borderBottom: '2px solid #95a5a6',
                    pb: 1,
                    mt: 3,
                    mb: 2,
                  },
                  '& h3': {
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    color: '#555',
                    mt: 2,
                    mb: 1,
                  },
                  '& p': {
                    mb: 1,
                    lineHeight: 1.6,
                  },
                  '& ul': {
                    ml: 3,
                    mb: 2,
                  },
                  '& li': {
                    mb: 0.5,
                  },
                  '& hr': {
                    border: 'none',
                    borderTop: '1px solid #ddd',
                    my: 2,
                  },
                  '& table.markdown-table': {
                    width: '100%',
                    borderCollapse: 'collapse',
                    my: 2,
                    border: '1px solid #ddd',
                  },
                  '& table.markdown-table th': {
                    bgcolor: '#3498db',
                    color: 'white',
                    p: 1.5,
                    textAlign: 'left',
                    fontWeight: 'bold',
                    border: '1px solid #2980b9',
                  },
                  '& table.markdown-table td': {
                    p: 1,
                    border: '1px solid #ddd',
                  },
                  '& table.markdown-table tbody tr:hover': {
                    bgcolor: '#f5f5f5',
                  },
                  '& strong': {
                    fontWeight: 'bold',
                    color: '#2c3e50',
                  },
                  '& .status-met': {
                    color: '#2e7d32',
                    fontWeight: 'bold',
                    fontSize: '1.1em',
                    padding: '10px',
                    backgroundColor: '#e8f5e9',
                    borderRadius: '5px',
                    display: 'inline-block',
                    margin: '10px 0',
                  },
                  '& .status-not-met': {
                    color: '#c62828',
                    fontWeight: 'bold',
                    fontSize: '1.1em',
                    padding: '10px',
                    backgroundColor: '#ffebee',
                    borderRadius: '5px',
                    display: 'inline-block',
                    margin: '10px 0',
                  },
                }}
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(displayContent),
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

    </Box>
  );
};

export default PerformanceReport;
