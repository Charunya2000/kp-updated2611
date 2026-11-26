'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Tooltip,
  TextField,
  Divider,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Slider,
} from '@mui/material';
import ChatWidget from './ChatWidget';
import {
  Refresh as RefreshIcon,
  Star as StarIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';

// API Configuration
const API_BASE_URL = '';
const API_PREFIX = '/api/envtracker';

// Generate months from Dec 2025 to Dec 2027 (to cover all release dates)
const generateMonths = (startYearMonth, endYearMonth) => {
  const months = [];
  const [startYear, startMonth] = startYearMonth.split('-').map(Number);
  const [endYear, endMonth] = endYearMonth.split('-').map(Number);

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
};

const ALL_MONTHS = generateMonths('2025-12', '2027-12');

// Default visible range: Jan 2026 - Dec 2026
const DEFAULT_START_INDEX = ALL_MONTHS.indexOf('2026-01');
const DEFAULT_END_INDEX = ALL_MONTHS.indexOf('2026-12');

// Current season: Jan 2026 - Jun 2026
const CURRENT_SEASON_START = '2026-01';
const CURRENT_SEASON_END = '2026-06';

// Today's date for the TODAY line
const TODAY = new Date().toISOString().slice(0, 10);

export default function TestEnvTrackerDashboard() {
  // Tooltip Helper Functions
  const getShortSourceName = (system) => {
    const mapping = {
      'KPHC': 'Upgrade Dates',
      'KP.Org Mobile': 'Mobile Releases',
      'KP.Org Web': 'Web Releases',
      'Membership': 'Email Updates',
      'KPMC': 'KPMC Plan',
      'KPCC': 'Claims Release',
      'MCE': 'Upgrade Dates',
      'EPIC': 'Claims Release',
      'DT Mobile': 'Mobile Releases',
      'FS': 'Email Updates',
      'VVE': 'Web Releases',
    };
    return mapping[system] || system;
  };

  const getEventType = (system) => {
    const mapping = {
      'KPCC': 'Release',
      'EPIC': 'Release',
      'Membership': 'Refresh',
      'FS': 'Refresh',
      'KPMC': 'Planned Outage/Downtime',
      'KPHC': 'Upgrade',
      'MCE': 'Upgrade',
      'KP.Org Mobile': 'Release',
      'DT Mobile': 'Release',
      'KP.Org Web': 'Planned Outage/Downtime',
      'VVE': 'Planned Outage/Downtime',
    };
    return mapping[system] || 'Release';
  };

  const formatTooltip = (source, markets, eventType, others) => {
    const marketDisplay = (markets && markets.length > 0) ? markets.join(', ') : 'National';
    return (
      <Box sx={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>
        <Box sx={{ mb: 0.5 }}><strong>Source:</strong> {source}</Box>
        <Box sx={{ mb: 0.5 }}><strong>Market(s):</strong> {marketDisplay}</Box>
        <Box sx={{ mb: 0.5 }}><strong>Event Type:</strong> {eventType}</Box>
        {others && <Box><strong>Others:</strong> {others}</Box>}
      </Box>
    );
  };

  // State
  const [mceData, setMceData] = useState([]);
  const [epicData, setEpicData] = useState([]);
  const [dtMobileData, setDtMobileData] = useState([]);
  const [fsData, setFsData] = useState([]);
  const [kpmcData, setKpmcData] = useState([]);
  const [kpccData, setKpccData] = useState([]);
  const [vveData, setVveData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterEnvironments, setFilterEnvironments] = useState([]);
  const [filterMarkets, setFilterMarkets] = useState([]); // Market filter for items with non-null market
  const [filterLanes, setFilterLanes] = useState([]); // Lane/row filter
  const [searchText, setSearchText] = useState('');

  // Available lane names for filtering
  const LANE_NAMES = ['KPHC', 'KP.org', 'Legacy Membership', 'KPMC', 'KPCC'];
  const [lastUpdated, setLastUpdated] = useState(null);
  const [kpccDataRefreshDate, setKpccDataRefreshDate] = useState(null);
  const [expandedMce, setExpandedMce] = useState(false);
  const [expandedEpic, setExpandedEpic] = useState(false);
  const [expandedDtMobile, setExpandedDtMobile] = useState(false);
  const [expandedFs, setExpandedFs] = useState(false);
  const [expandedKpmc, setExpandedKpmc] = useState(false);
  const [expandedKpcc, setExpandedKpcc] = useState(false);
  const [expandedVve, setExpandedVve] = useState(false);
  const [monthRange, setMonthRange] = useState([DEFAULT_START_INDEX, DEFAULT_END_INDEX]);

  // Handle month range slider change
  const handleMonthRangeChange = (event, newValue) => {
    setMonthRange(newValue);
  };

  // Format month for slider display
  const formatSliderMonth = (index) => {
    const month = ALL_MONTHS[index];
    if (!month) return '';
    const [year, mon] = month.split('-').map(Number);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[mon - 1]} ${year}`;
  };

  // Market colors - new design system with accessibility
  const marketColors = {
    NATL: '#DFAB85',
    MA: '#90C5C4',
    MAS: '#90C5C4', // Same as MA
    CO: '#CCC1D6',
    NW: '#B9D7A6',
    NCAL: '#AECCED',
    SCAL: '#80A8CD',
    HI: '#C378C5',
    WA: '#F5F5B9',
    GA: '#F3E4AA',
    National: '#E0E0E0', // For items without specific market
    null: '#E0E0E0',
    undefined: '#E0E0E0',
  };

  const getMarketColor = (market) => {
    if (!market) return '#E0E0E0';
    return marketColors[market] || '#E0E0E0';
  };

  // Get text color based on background for accessibility
  const getTextColor = (bgColor) => {
    // For light backgrounds (WA, GA), use dark text
    if (bgColor === '#F5F5B9' || bgColor === '#F3E4AA' || bgColor === '#E0E0E0' || bgColor === '#DFAB85' || bgColor === '#B9D7A6') {
      return '#1A1A1A';
    }
    return '#FFFFFF';
  };

  // Toggle market filter
  const toggleMarketFilter = (market) => {
    setFilterMarkets(prev =>
      prev.includes(market)
        ? prev.filter(m => m !== market)
        : [...prev, market]
    );
  };

  // Toggle lane filter
  const toggleLaneFilter = (lane) => {
    setFilterLanes(prev =>
      prev.includes(lane)
        ? prev.filter(l => l !== lane)
        : [...prev, lane]
    );
  };

  // Check if a lane should be visible
  const isLaneVisible = (laneName) => {
    return filterLanes.length === 0 || filterLanes.includes(laneName);
  };

  // Clear problematic localStorage items on mount to avoid conflicts
  useEffect(() => {
    // Clear assistant/team selection cache that causes issues with this standalone page
    const itemsToClear = [
      'selectedAssistantName',
      'selectedAssistantTeamName',
      'dismissedAppMessages'
    ];
    itemsToClear.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Silently fail if localStorage is not available
        console.warn('Failed to clear localStorage:', e);
      }
    });
  }, []);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // MCE DISABLED - fetch only other data sources
      const [epicResponse, dtMobileResponse, fsResponse, kpmcResponse, kpccResponse, vveResponse] = await Promise.all([
        fetch(`${API_BASE_URL}${API_PREFIX}/epic?limit=1000`),
        fetch(`${API_BASE_URL}${API_PREFIX}/dtmobile?limit=1000`),
        fetch(`${API_BASE_URL}${API_PREFIX}/fs?limit=1000`),
        fetch(`${API_BASE_URL}${API_PREFIX}/kpmc?limit=1000`),
        fetch(`${API_BASE_URL}${API_PREFIX}/kpcc?limit=1000`),
        fetch(`${API_BASE_URL}${API_PREFIX}/vve?limit=1000`),
      ]);

      // Log any API errors but continue with partial data
      if (!epicResponse.ok || !dtMobileResponse.ok || !fsResponse.ok || !kpmcResponse.ok || !kpccResponse.ok || !vveResponse.ok) {
        console.error('API Error - EPIC:', epicResponse.status, 'DT Mobile:', dtMobileResponse.status, 'FS:', fsResponse.status, 'KPMC:', kpmcResponse.status, 'KPCC:', kpccResponse.status, 'VVE:', vveResponse.status);
      }

      // MCE DISABLED - set empty data
      const mceJson = { data: [] };
      const epicJson = epicResponse.ok ? await epicResponse.json() : { data: [] };
      const dtMobileJson = dtMobileResponse.ok ? await dtMobileResponse.json() : { data: [] };
      const fsJson = fsResponse.ok ? await fsResponse.json() : { data: [] };
      const kpmcJson = kpmcResponse.ok ? await kpmcResponse.json() : { data: [] };
      const kpccJson = kpccResponse.ok ? await kpccResponse.json() : { data: [] };
      const vveJson = vveResponse.ok ? await vveResponse.json() : { data: [] };

      // New structure: response is array with { metadata, data, source, created_at, updated_at }
      // Extract data from first item (or flatten if multiple sources)
      const mceItems = Array.isArray(mceJson) ? mceJson.flatMap(item => item.data || []) : (mceJson.data || []);
      const epicItems = Array.isArray(epicJson) ? epicJson.flatMap(item => item.data || []) : (epicJson.data || []);
      const dtMobileItems = Array.isArray(dtMobileJson) ? dtMobileJson.flatMap(item => item.data || []) : (dtMobileJson.data || []);
      const fsItems = Array.isArray(fsJson) ? fsJson.flatMap(item => item.data || []) : (fsJson.data || []);
      const kpmcItems = Array.isArray(kpmcJson) ? kpmcJson.flatMap(item => item.data || []) : (kpmcJson.data || []);
      const kpccItems = Array.isArray(kpccJson) ? kpccJson.flatMap(item => item.data || []) : (kpccJson.data || []);
      const vveItems = Array.isArray(vveJson) ? vveJson.flatMap(item => item.data || []) : (vveJson.data || []);

      setMceData(mceItems);
      setEpicData(epicItems);
      setDtMobileData(dtMobileItems);
      setFsData(fsItems);
      setKpmcData(kpmcItems);
      setKpccData(kpccItems);
      setVveData(vveItems);

      // Extract KPCC metadata extracted_on date
      if (kpccJson && !Array.isArray(kpccJson) && kpccJson.metadata && kpccJson.metadata.extracted_on) {
        const extractedDate = new Date(kpccJson.metadata.extracted_on);
        setKpccDataRefreshDate(extractedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      } else if (Array.isArray(kpccJson) && kpccJson.length > 0 && kpccJson[0].metadata && kpccJson[0].metadata.extracted_on) {
        const extractedDate = new Date(kpccJson[0].metadata.extracted_on);
        setKpccDataRefreshDate(extractedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      }

      // Log sample dates for debugging
      if (epicItems.length > 0) {
        const sample = epicItems.slice(0, 3);
        console.log('📅 Sample EPIC releases:', sample.map(r => ({
          env: r.environment,
          market: r.market,
          start: r.release_start_date,
          end: r.release_end_date,
          range: r.range
        })));
      }

      // Calculate last updated date from wrapper objects
      const wrapperDates = [
        ...(Array.isArray(mceJson) ? mceJson.map(item => item.updated_at) : [mceJson.updated_at]),
        ...(Array.isArray(epicJson) ? epicJson.map(item => item.updated_at) : [epicJson.updated_at]),
        ...(Array.isArray(dtMobileJson) ? dtMobileJson.map(item => item.updated_at) : [dtMobileJson.updated_at]),
        ...(Array.isArray(fsJson) ? fsJson.map(item => item.updated_at) : [fsJson.updated_at]),
        ...(Array.isArray(kpmcJson) ? kpmcJson.map(item => item.updated_at) : [kpmcJson.updated_at]),
        ...(Array.isArray(vveJson) ? vveJson.map(item => item.updated_at) : [vveJson.updated_at]),
      ].filter(Boolean);

      if (wrapperDates.length > 0) {
        const maxDate = new Date(Math.max(...wrapperDates.map(d => new Date(d))));
        setLastUpdated(maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      }

      console.log('📊 MCE data loaded:', mceItems.length, 'releases');
      console.log('📊 EPIC data loaded:', epicItems.length, 'releases');
      console.log('📊 DT Mobile data loaded:', dtMobileItems.length, 'releases');
      console.log('📊 FS data loaded:', fsItems.length, 'releases');
      console.log('📊 KPMC data loaded:', kpmcItems.length, 'releases');
      console.log('📊 VVE data loaded:', vveItems.length, 'releases');
    } catch (err) {
      console.error('Error loading data:', err);
      // Set empty data on error - will show "No Data" messages instead of error alert
      setMceData([]);
      setEpicData([]);
      setDtMobileData([]);
      setFsData([]);
      setKpmcData([]);
      setVveData([]);
    } finally {
      setLoading(false);
    }
  };

  // Get unique values for filters - collect markets from ALL data sources (including National)
  const allMarkets = [
    ...mceData.map(r => r.market),
    ...epicData.map(r => r.market),
    ...fsData.map(r => r.market),
    ...kpmcData.map(r => r.market),
    ...vveData.map(r => r.market),
  ];
  const uniqueMarkets = [...new Set(allMarkets.filter(Boolean))].sort();
  // Add 'National' option for filtering items without specific markets
  uniqueMarkets.unshift('National');
  const uniqueEnvironments = [...new Set(epicData.map(r => r.environment).filter(Boolean))].sort();

  // Apply filters
  const filteredMceData = mceData.filter(release => {
    // Market filter - for merged items, check if ANY market matches; for single items, check the market
    if (filterMarkets.length > 0) {
      const releaseMarkets = release.markets || (release.market ? [release.market] : []);
      // If 'National' is selected, show items without specific markets
      if (filterMarkets.includes('National') && releaseMarkets.length === 0) return true;
      if (releaseMarkets.length > 0 && !releaseMarkets.some(m => filterMarkets.includes(m))) return false;
    }
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchesName = release.name?.toLowerCase().includes(search);
      const matchesApp = release.application?.toLowerCase().includes(search);
      const matchesMarket = release.market?.toLowerCase().includes(search);
      if (!matchesName && !matchesApp && !matchesMarket) return false;
    }
    return true;
  });

  const filteredEpicData = epicData.filter(release => {
    // Market filter - for merged items, check if ANY market matches; for single items, check the market
    if (filterMarkets.length > 0) {
      const releaseMarkets = release.markets || (release.market ? [release.market] : []);
      // If 'National' is selected, show items without specific markets
      if (filterMarkets.includes('National') && releaseMarkets.length === 0) return true;
      if (releaseMarkets.length > 0 && !releaseMarkets.some(m => filterMarkets.includes(m))) return false;
    }
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchesLabel = `${release.environment} ${release.release_period}`.toLowerCase().includes(search);
      const matchesRefresh = release.refresh_details?.toLowerCase().includes(search);
      const matchesMarket = release.market?.toLowerCase().includes(search);
      if (!matchesLabel && !matchesRefresh && !matchesMarket) return false;
    }
    return true;
  });

  const filteredFsData = fsData.filter(release => {
    // Market filter - for merged items, check if ANY market matches; for single items, check the market
    if (filterMarkets.length > 0) {
      const releaseMarkets = release.markets || (release.market ? [release.market] : []);
      // If 'National' is selected, show items without specific markets
      if (filterMarkets.includes('National') && releaseMarkets.length === 0) return true;
      if (releaseMarkets.length > 0 && !releaseMarkets.some(m => filterMarkets.includes(m))) return false;
    }
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchesName = release.name?.toLowerCase().includes(search);
      const matchesApp = release.application?.toLowerCase().includes(search);
      const matchesMarket = release.market?.toLowerCase().includes(search);
      if (!matchesName && !matchesApp && !matchesMarket) return false;
    }
    return true;
  });

  const filteredKpmcData = kpmcData.filter(release => {
    // KPMC has null markets, so market filter doesn't affect it
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchesTask = release.task_name?.toLowerCase().includes(search);
      if (!matchesTask) return false;
    }
    return true;
  });

  const filteredKpccData = kpccData.filter(release => {
    // KPCC filter by market and release_id
    if (filterMarkets.length > 0) {
      const releaseMarkets = release.markets || (release.market ? [release.market] : []);
      // If 'National' is selected, show items without specific markets
      if (filterMarkets.includes('National') && releaseMarkets.length === 0) return true;
      if (releaseMarkets.length > 0 && !releaseMarkets.some(m => filterMarkets.includes(m))) return false;
    }
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchesReleaseId = release.release_id?.toLowerCase().includes(search);
      const matchesMarket = release.market?.toLowerCase().includes(search);
      if (!matchesReleaseId && !matchesMarket) return false;
    }
    return true;
  });

  const filteredDtMobileData = dtMobileData.filter(release => {
    // DT Mobile has null markets, so market filter doesn't affect it
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchesName = release.name?.toLowerCase().includes(search);
      const matchesRelease = release.release?.toLowerCase().includes(search);
      if (!matchesName && !matchesRelease) return false;
    }
    return true;
  });

  const filteredVveData = vveData.filter(release => {
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchesLabel = release.version?.toLowerCase().includes(search);
      const matchesScope = release.scope?.toLowerCase().includes(search);
      if (!matchesLabel && !matchesScope) return false;
    }
    return true;
  });

  // Calculate activity count per month for collapsed view
  const getMonthActivityCount = (data, month, startField, endField) => {
    // Parse month as YYYY-MM to get month boundaries
    const [year, mon] = month.split('-').map(Number);
    const monthStart = new Date(Date.UTC(year, mon - 1, 1)); // First day of month
    const monthEnd = new Date(Date.UTC(year, mon, 0)); // Last day of month

    const count = data.filter(item => {
      if (!item[startField]) return false;

      // Parse dates as UTC to avoid timezone issues
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d));
      };

      const itemStart = parseDate(item[startField]);
      if (!itemStart) return false;

      // If no end field or end date, use start date as end
      const itemEnd = endField && item[endField] ? parseDate(item[endField]) : itemStart;

      // Check if item overlaps with this month
      // Item overlaps if: itemStart <= monthEnd AND itemEnd >= monthStart
      return itemStart <= monthEnd && itemEnd >= monthStart;
    }).length;

    return count > 0 ? count : null; // Return null instead of 0 for empty months
  };

  // Group EPIC by environment
  const epicByEnvironment = filteredEpicData.reduce((acc, release) => {
    const env = release.environment || 'Unknown';
    if (!acc[env]) acc[env] = [];
    acc[env].push(release);
    return acc;
  }, {});

  // Sort environments: PROD first, then alphabetically
  const sortedEnvironments = Object.keys(epicByEnvironment).sort((a, b) => {
    if (a === 'PROD') return -1;
    if (b === 'PROD') return 1;
    return a.localeCompare(b);
  });

  const formatMonthDisplay = (month) => {
    // Parse YYYY-MM directly to avoid timezone issues
    const [year, mon] = month.split('-').map(Number);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const yearStr = String(year).slice(-2);
    return `${monthNames[mon - 1]} ${yearStr}`;
  };

  // Filter months based on slider range
  const visibleMonths = ALL_MONTHS.slice(monthRange[0], monthRange[1] + 1);

  // Column width as percentage of timeline area
  const columnWidthPercent = 100 / visibleMonths.length;

  // Calculate position of TODAY line as percentage
  const getTodayPosition = () => {
    const todayMonth = TODAY.slice(0, 7);
    const monthIndex = visibleMonths.indexOf(todayMonth);
    if (monthIndex === -1) return null;

    const todayDate = new Date(TODAY);
    const monthStart = new Date(todayMonth + '-01');
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0); // Last day of month

    const dayOfMonth = todayDate.getDate();
    const daysInMonth = monthEnd.getDate();
    const percentIntoMonth = dayOfMonth / daysInMonth;

    // Return as percentage
    return (monthIndex + percentIntoMonth) * columnWidthPercent;
  };

  // Calculate release position and width for Gantt chart (percentage-based)
  const calculateReleaseBar = (startDate, endDate, isRange, expandWithinMonth = false) => {
    if (!startDate) return null;

    // Parse dates as UTC to avoid timezone issues
    const parseUTCDate = (dateStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    };

    const start = parseUTCDate(startDate);
    const startYear = start.getUTCFullYear();
    const startMonth = start.getUTCMonth() + 1; // 1-12
    const startDay = start.getUTCDate();
    const startMonthKey = `${startYear}-${String(startMonth).padStart(2, '0')}`;

    const monthIndex = visibleMonths.indexOf(startMonthKey);

    if (monthIndex === -1) {
      // Month not in visible range - skip rendering
      return null;
    }

    // Calculate position within the month using UTC
    const daysInMonth = new Date(Date.UTC(startYear, startMonth, 0)).getUTCDate();
    const percentIntoMonth = (startDay - 1) / daysInMonth;

    // Position as percentage of timeline width
    const leftPercent = (monthIndex + percentIntoMonth) * columnWidthPercent;

    // Dynamic box sizing - proportional to date range
    let widthPercent;

    if (isRange && endDate) {
      const end = parseUTCDate(endDate);
      const endYear = end.getUTCFullYear();
      const endMonth = end.getUTCMonth() + 1;
      const endDay = end.getUTCDate();
      const endMonthKey = `${endYear}-${String(endMonth).padStart(2, '0')}`;
      const endMonthIndex = visibleMonths.indexOf(endMonthKey);

      if (endMonthIndex === -1) {
        // End month not in visible range - extend to edge
        widthPercent = Math.max(columnWidthPercent * 0.3, 100 - leftPercent);
      } else if (endMonthIndex >= monthIndex) {
        const endDaysInMonth = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
        const endPercentIntoMonth = endDay / endDaysInMonth;

        const endPositionPercent = (endMonthIndex + endPercentIntoMonth) * columnWidthPercent;
        const actualWidth = endPositionPercent - leftPercent;

        // Minimum width as 30% of a column
        if (expandWithinMonth && actualWidth < columnWidthPercent * 0.5) {
          widthPercent = columnWidthPercent * 0.6;
        } else {
          widthPercent = Math.max(columnWidthPercent * 0.25, actualWidth);
        }
      } else {
        widthPercent = columnWidthPercent * 0.3;
      }
    } else {
      // Single date: base width, allow adaptive expansion for readability
      const baseWidth = columnWidthPercent * 0.3;
      widthPercent = expandWithinMonth ? Math.min(columnWidthPercent * 0.7, baseWidth * 1.4) : baseWidth;
    }

    // Adaptive width expansion for short events (up to 1 week) within single month
    // Only expand if event is entirely within one month and width is small
    if (isRange && endDate && widthPercent < columnWidthPercent * 0.5) {
      const start = parseUTCDate(startDate);
      const end = parseUTCDate(endDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

      // If event is <= 7 days and within same month, allow up to 40% expansion
      if (daysDiff <= 7 && startMonth === end.getUTCMonth() + 1) {
        const maxExpansion = widthPercent * 1.4;
        widthPercent = Math.min(maxExpansion, columnWidthPercent * 0.6);
      }
    }

    return { left: leftPercent, width: widthPercent, isRange };
  };

  // Collision avoidance - stack overlapping releases
  const packReleasesIntoRows = (releases, calculateBar) => {
    const rows = [];
    const sortedReleases = [...releases].sort((a, b) => {
      const aBar = calculateBar(a);
      const bBar = calculateBar(b);
      if (!aBar || !bBar) return 0;
      return aBar.left - bBar.left;
    });

    sortedReleases.forEach(release => {
      const bar = calculateBar(release);
      if (!bar) return;

      // Find first row where this release fits (with 4px padding between rows)
      let rowIndex = 0;
      let placed = false;

      while (!placed) {
        if (!rows[rowIndex]) {
          rows[rowIndex] = [];
        }

        // Check for collisions in this row
        const hasCollision = rows[rowIndex].some(existing => {
          const existingBar = calculateBar(existing);
          if (!existingBar) return false;
          return !(bar.left >= existingBar.left + existingBar.width || bar.left + bar.width <= existingBar.left);
        });

        if (!hasCollision) {
          rows[rowIndex].push(release);
          placed = true;
        } else {
          rowIndex++;
        }
      }
    });

    return rows;
  };

  // Clean up event text by removing prefixes
  const cleanEventText = (text, eventType) => {
    if (!text) return '';
    let cleaned = text.trim();

    if (eventType === 'fs') {
      // Remove FS:, CM:, TMS: prefixes
      cleaned = cleaned.replace(/^(FS|CM|TMS):\s*/i, '');
    } else if (eventType === 'kpmc') {
      // Remove KPMC - prefix
      cleaned = cleaned.replace(/^KPMC\s*-\s*/i, '');
    }

    return cleaned.trim();
  };

  // Truncate text to first 3 words (after cleanup)
  const truncateToThreeWords = (text) => {
    if (!text) return '';
    const words = text.trim().split(/\s+/);
    if (words.length <= 3) return text;
    return words.slice(0, 3).join(' ');
  };

  // Smart text processing for KPMC - skip generic date prefixes and show meaningful content
  const getKpmcDisplayText = (text) => {
    if (!text) return 'KPMC';

    // First remove "KPMC -" prefix
    let cleaned = cleanEventText(text, 'kpmc');

    // Check if it starts with a month pattern (e.g., "Feb 2025", "Aug 2026")
    const monthPattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*/i;
    const match = cleaned.match(monthPattern);

    if (match) {
      // Extract what comes after the month/year
      const afterDate = cleaned.substring(match[0].length).trim();

      if (afterDate.length > 0) {
        // Show the meaningful content after the date (up to 3 words)
        return truncateToThreeWords(afterDate);
      } else {
        // Nothing after the date, show the date itself
        return match[0].trim();
      }
    }

    // No month pattern found, just truncate normally
    return truncateToThreeWords(cleaned);
  };

  // Calculate box height based on number of markets
  const getMultiMarketHeight = (marketCount, baseHeight) => {
    if (marketCount <= 1) return baseHeight;
    return baseHeight * (1 + 0.25 * (marketCount - 1));
  };

  // Merge identical events across different markets
  const mergeIdenticalEvents = (data, getStartDate, getEndDate, getName) => {
    const grouped = {};

    data.forEach(item => {
      const name = getName(item);
      const start = getStartDate(item);
      const end = getEndDate(item);
      const key = `${name}|${start}|${end}`;

      if (!grouped[key]) {
        grouped[key] = {
          ...item,
          markets: item.market ? [item.market] : [],
          isMultiMarket: false
        };
      } else {
        // Merge markets
        if (item.market && !grouped[key].markets.includes(item.market)) {
          grouped[key].markets.push(item.market);
          grouped[key].isMultiMarket = true;
        }
      }
    });

    return Object.values(grouped);
  };

  // Get dynamic font size based on text length with progressive scaling
  const getFontSize = (widthPercent, textLength = 0) => {
    // Progressive text fit strategy: start with reasonable size, scale down as needed
    if (textLength > 25) return '0.5625rem'; // 9px for very long text
    if (textLength > 20) return '0.625rem'; // 10px for long text
    if (textLength > 15) return '0.6875rem'; // 11px
    if (widthPercent < 5) return '0.6875rem'; // 11px for very narrow
    if (widthPercent < 8) return '0.75rem'; // 12px
    return '0.8125rem'; // 13px default (improved readability)
  };

  // Render loading state
  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  // Render error state
  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={loadData}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Container>
    );
  }

  const todayPosition = getTodayPosition();

  return (
    <Box sx={{ display: 'flex', minHeight: '100%' }}>
      {/* Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Container maxWidth="xl" sx={{ py: 2, px: 2 }}>
          {/* Under Construction Banner */}
          {/* <Alert severity="warning" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography fontSize="14px" fontWeight={500}>
              Under Construction - Still working on this feature
            </Typography>
          </Alert> */}

          {/* Header - Ultra Compact */}
          <Box sx={{ mb: 0.25, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 0, fontSize: '1.8rem', lineHeight: 1.4 }}>
              AI-Powered Environment Tracking
            </Typography>
          </Box>

          {/* Controls - Ultra Compact */}
          <Paper sx={{ p: 1, mb: 0.5 }}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Month Range Slider - acts as zoom control */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 320, flex: 1, maxWidth: 500 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  {formatSliderMonth(monthRange[0])}
                </Typography>
                <Slider
                  value={monthRange}
                  onChange={handleMonthRangeChange}
                  min={0}
                  max={ALL_MONTHS.length - 1}
                  disableSwap
                  valueLabelDisplay="auto"
                  valueLabelFormat={formatSliderMonth}
                  sx={{
                    mx: 1,
                    '& .MuiSlider-thumb': { width: 14, height: 14 },
                    '& .MuiSlider-track': { height: 4 },
                    '& .MuiSlider-rail': { height: 4 },
                  }}
                />
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                  {formatSliderMonth(monthRange[1])}
                </Typography>
              </Box>

              <TextField
                size="small"
                placeholder="Search..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ fontSize: 18, mr: 0.75, color: 'text.secondary' }} />,
                }}
                sx={{ minWidth: 180, '& .MuiInputBase-root': { height: 32, fontSize: '0.875rem' } }}
              />
              <Button size="small" variant="outlined" startIcon={<RefreshIcon sx={{ fontSize: 18 }} />} onClick={loadData} sx={{ height: 32, fontSize: '0.8rem' }}>
                Refresh
              </Button>

              {/* KPCC Source Data Date - manually updated upstream, NOT tied to the Refresh button */}
              <Tooltip title="This is the date the KPCC Claims Release Calendar data was last imported into the system by the data pipeline. It only changes when that pipeline re-runs; clicking Refresh re-checks the database but won't move this date.">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, cursor: 'help' }}>
                  <InfoOutlinedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>KPCC Data As Of:</Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: 'text.primary' }}>{kpccDataRefreshDate || 'Loading...'}</Typography>
                </Box>
              </Tooltip>

              {/* Milestone Legend */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                <StarIcon sx={{ fontSize: 16, color: '#FFD700', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }} />
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>Milestone</Typography>
              </Box>
            </Box>
          </Paper>

          {/* Timeline Grid - Full Width */}
          <Paper sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            border: '3px solid',
            borderColor: 'divider',
            borderRadius: 1,
            mb: 3,
            boxShadow: 2,
            minHeight: 600,
          }}>
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
              {/* Month Headers (Sticky) */}
              <Box sx={{
                display: 'flex',
                position: 'sticky',
                top: 0,
                bgcolor: 'background.paper',
                zIndex: 100,
                borderBottom: '2px solid',
                borderColor: 'divider',
              }}>
                <Box sx={{
                  width: 180,
                  minWidth: 180,
                  flexShrink: 0,
                  fontWeight: 700,
                  p: 0.75,
                  borderRight: '1px solid',
                  borderColor: 'divider',
                  fontSize: '0.8rem',
                  boxSizing: 'border-box',
                }}>

                </Box>
                <Box sx={{ display: 'flex', flex: 1 }}>
                  {visibleMonths.map((month, idx) => (
                    <Box
                      key={month}
                      sx={{
                        flex: `0 0 ${columnWidthPercent}%`,
                        textAlign: 'center',
                        fontWeight: 600,
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        fontSize: '0.7rem',
                        p: 0.5,
                        bgcolor: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                        boxSizing: 'border-box',
                      }}
                    >
                      {formatMonthDisplay(month)}
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* TODAY Line */}
              {todayPosition !== null && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: `calc(180px + (100% - 180px) * ${todayPosition / 100})`,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    bgcolor: 'error.main',
                    opacity: 0.2,
                    zIndex: 50,
                    pointerEvents: 'none',
                  }}
                >
                  <Chip
                    label="TODAY"
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      bgcolor: 'error.main',
                      color: 'white',
                      fontSize: '0.5rem',
                      height: 20,
                    }}
                  />
                </Box>
              )}

              {/* MCE Lane - DISABLED */}
              {false && (() => {
                // Merge identical MCE events across markets
                const mergedMceData = mergeIdenticalEvents(
                  filteredMceData,
                  (item) => item.start,
                  (item) => item.end,
                  (item) => cleanEventText(item.name || item.application || '', 'mce')
                );

                const releaseRows = packReleasesIntoRows(mergedMceData, (release) =>
                  calculateReleaseBar(release.start, release.end, release.range)
                );
                const ROW_HEIGHT = 40;
                const laneHeight = expandedMce ? Math.max(60, releaseRows.length * ROW_HEIGHT + 16) : 52;

                return (
                  <Box sx={{
                    borderBottom: '2px solid #e0e0e0',
                    boxShadow: expandedMce ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                    <Box sx={{ display: 'flex', cursor: 'pointer' }} onClick={() => setExpandedMce(!expandedMce)}>
                      <Box sx={{
                        width: 180,
                        minWidth: 180,
                        flexShrink: 0,
                        p: 0.75,
                        borderRight: '1px solid #e0e0e0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: expandedMce ? 'linear-gradient(180deg, #f8f9fa 0%, #f0f2f5 100%)' : 'linear-gradient(180deg, #e8eaed 0%, #dadce0 100%)',
                        boxSizing: 'border-box',
                        transition: 'background 0.2s ease',
                        '&:hover': { background: 'linear-gradient(180deg, #e3e5e8 0%, #d5d7da 100%)' },
                      }}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a73e8', fontSize: '0.9rem' }}>
                          MCE
                        </Typography>
                        <IconButton size="small" sx={{ p: 0, color: '#5f6368', pointerEvents: 'none' }}>
                          {expandedMce ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      </Box>
                      <Box sx={{
                        flex: 1,
                        position: 'relative',
                        height: laneHeight,
                        background: expandedMce ? '#fafbfc' : 'linear-gradient(180deg, #f5f5f5 0%, #eeeeee 100%)',
                        overflow: 'hidden',
                        transition: 'height 0.2s ease, background 0.2s ease',
                      }}>
                        {/* Month grid and counts */}
                        {visibleMonths.map((month, idx) => {
                          const count = getMonthActivityCount(mergedMceData, month, 'start', 'end');
                          return (
                            <Box
                              key={month}
                              sx={{
                                position: 'absolute',
                                left: `${idx * columnWidthPercent}%`,
                                top: 0,
                                bottom: 0,
                                width: `${columnWidthPercent}%`,
                                borderLeft: idx > 0 ? '1px solid' : 'none',
                                borderColor: 'divider',
                                bgcolor: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {!expandedMce && count && (
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>
                                  {count}
                                </Typography>
                              )}
                            </Box>
                          );
                        })}

                        {/* No Data Message */}
                        {mergedMceData.length === 0 && (
                          <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: '#f5f5f5',
                            zIndex: 10,
                          }}>
                            <Box sx={{ textAlign: 'center', ml: -500 }}>
                              <Typography sx={{ fontWeight: 600, color: '#000000', fontSize: '1rem' }}>
                                No Data to Display
                              </Typography>
                              <Typography sx={{ color: '#333333', mt: 0.5, fontSize: '0.875rem' }}>
                                Check with admin if this is unexpected
                              </Typography>
                            </Box>
                          </Box>
                        )}

                        {/* All MCE Release boxes */}
                        {expandedMce && releaseRows.map((row, rowIdx) =>
                          row.map((release, idx) => {
                            const bar = calculateReleaseBar(release.start, release.end, release.range);
                            if (!bar) return null;

                            const isMultiMarket = release.isMultiMarket;
                            const markets = release.markets || [release.market].filter(Boolean);
                            const bgColor = isMultiMarket && markets.length > 0
                              ? getMarketColor(markets[0])
                              : getMarketColor(release.market);

                            // Display text: Name or Application for MCE
                            const displayText = release.name || release.application || 'MCE';
                            const fontSize = getFontSize(bar.width, displayText.length);

                            const baseHeight = 28; // Reduced by ~15% for better readability
                            const boxHeight = getMultiMarketHeight(markets.length, baseHeight);
                            // Show star only for PROD environment
                            const isProd = (release.environment || '').toUpperCase() === 'PROD';

                            return (
                              <Box
                                key={`${rowIdx}-${idx}`}
                                sx={{
                                  position: 'absolute',
                                  left: `${bar.left}%`,
                                  top: rowIdx * ROW_HEIGHT + 6,
                                  width: `${bar.width}%`,
                                }}
                              >
                                {/* PROD Star Label */}
                                {isProd && (
                                  <StarIcon
                                    sx={{
                                      position: 'absolute',
                                      top: -8,
                                      left: -8,
                                      fontSize: 16,
                                      color: '#FFD700',
                                      zIndex: 20,
                                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
                                    }}
                                  />
                                )}

                                {/* Release Box */}
                                <Tooltip
                                  title={formatTooltip(
                                    getShortSourceName('MCE'),
                                    markets.filter(Boolean),
                                    getEventType('MCE'),
                                    [
                                      release.start ? `Start: ${new Date(release.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                      release.end ? `End: ${new Date(release.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                      release.milestone ? `Milestone: ${release.milestone}` : null,
                                      release.environment_instance ? `Instance: ${release.environment_instance}` : null,
                                    ].filter(Boolean).join(' | ')
                                  )}
                                >
                                  <Box
                                    sx={{
                                      width: '100%',
                                      height: boxHeight,
                                      position: 'relative',
                                      overflow: 'hidden',
                                      border: '1px solid rgba(0,0,0,0.15)',
                                      borderRadius: 0.5,
                                      cursor: 'pointer',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                                      '&:hover': {
                                        boxShadow: '0 3px 8px rgba(0,0,0,0.2)',
                                        zIndex: 10,
                                        transform: 'translateY(-1px)',
                                        transition: 'all 0.15s ease',
                                      },
                                    }}
                                  >
                                    {/* Color-strip segmentation for multi-market */}
                                    {isMultiMarket && markets.length > 1 ? (
                                      <>
                                        {markets.map((market, mIdx) => (
                                          <Box
                                            key={mIdx}
                                            sx={{
                                              position: 'absolute',
                                              top: `${(mIdx / markets.length) * 100}%`,
                                              left: 0,
                                              right: 0,
                                              height: `${100 / markets.length}%`,
                                              bgcolor: getMarketColor(market),
                                            }}
                                          />
                                        ))}
                                        {/* Text overlay */}
                                        <Box
                                          sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            px: '7px',
                                            py: '5px',
                                          }}
                                        >
                                          <Typography
                                            sx={{
                                              fontSize: fontSize,
                                              fontWeight: 600,
                                              fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                                              lineHeight: 1.2,
                                              color: '#FFFFFF',
                                              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                                              textAlign: 'center',
                                              whiteSpace: 'normal',
                                              overflowWrap: 'anywhere',
                                              display: '-webkit-box',
                                              WebkitLineClamp: 2,
                                              WebkitBoxOrient: 'vertical',
                                              overflow: 'hidden',
                                            }}
                                          >
                                            {displayText}
                                          </Typography>
                                        </Box>
                                      </>
                                    ) : (
                                      <Box
                                        sx={{
                                          width: '100%',
                                          height: '100%',
                                          bgcolor: bgColor,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          px: '7px',
                                          py: '5px',
                                        }}
                                      >
                                        <Typography
                                          sx={{
                                            fontSize: fontSize,
                                            fontWeight: 600,
                                            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                                            lineHeight: 1.2,
                                            color: getTextColor(bgColor),
                                            textAlign: 'center',
                                            whiteSpace: 'normal',
                                            overflowWrap: 'anywhere',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                          }}
                                        >
                                          {displayText}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                </Tooltip>
                              </Box>
                            );
                          })
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })()}

              {/* EPIC Lane - Collapsible */}
              {isLaneVisible('KPHC') && (() => {
                // Merge identical EPIC events across markets
                const mergedEpicData = mergeIdenticalEvents(
                  filteredEpicData,
                  (item) => item.release_start_date,
                  (item) => item.release_end_date,
                  (item) => `${item.environment} ${item.release_period || ''}`.trim()
                );

                const releaseRows = packReleasesIntoRows(mergedEpicData, (release) =>
                  calculateReleaseBar(release.release_start_date, release.release_end_date, release.range)
                );
                const ROW_HEIGHT = 40;
                const laneHeight = expandedEpic ? Math.max(60, releaseRows.length * ROW_HEIGHT + 16) : 52;

                return (
                  <Box sx={{
                    borderBottom: '2px solid #e0e0e0',
                    boxShadow: expandedEpic ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                    <Box sx={{ display: 'flex', cursor: 'pointer' }} onClick={() => setExpandedEpic(!expandedEpic)}>
                      <Box sx={{
                        width: 180,
                        minWidth: 180,
                        flexShrink: 0,
                        p: 0.75,
                        borderRight: '1px solid #e0e0e0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: expandedEpic ? 'linear-gradient(180deg, #f8f9fa 0%, #f0f2f5 100%)' : 'linear-gradient(180deg, #e8eaed 0%, #dadce0 100%)',
                        boxSizing: 'border-box',
                        transition: 'background 0.2s ease',
                        '&:hover': { background: 'linear-gradient(180deg, #e3e5e8 0%, #d5d7da 100%)' },
                      }}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a73e8', fontSize: '0.9rem' }}>
                          KPHC
                        </Typography>
                        <IconButton size="small" sx={{ p: 0, color: '#5f6368', pointerEvents: 'none' }}>
                          {expandedEpic ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      </Box>
                      <Box sx={{
                        flex: 1,
                        position: 'relative',
                        height: laneHeight,
                        background: expandedEpic ? '#fafbfc' : 'linear-gradient(180deg, #f5f5f5 0%, #eeeeee 100%)',
                        overflow: 'hidden',
                        transition: 'height 0.2s ease, background 0.2s ease',
                      }}>                        {/* Month grid and counts */}
                        {visibleMonths.map((month, idx) => {
                          const count = getMonthActivityCount(mergedEpicData, month, 'release_start_date', 'release_end_date');
                          return (
                            <Box
                              key={month}
                              sx={{
                                position: 'absolute',
                                left: `${idx * columnWidthPercent}%`,
                                top: 0,
                                bottom: 0,
                                width: `${columnWidthPercent}%`,
                                borderLeft: idx > 0 ? '1px solid' : 'none',
                                borderColor: 'divider',
                                bgcolor: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {!expandedEpic && count && (
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>
                                  {count}
                                </Typography>
                              )}
                            </Box>
                          );
                        })}

                        {/* No Data Message - merged row with no dividers */}
                        {mergedEpicData.length === 0 && (
                          <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: '#f5f5f5',
                            zIndex: 10,
                          }}>
                            <Box sx={{ textAlign: 'center', ml: -500 }}>
                              <Typography sx={{ fontWeight: 600, color: '#000000', fontSize: '1rem' }}>
                                No Data to Display
                              </Typography>
                              <Typography sx={{ color: '#333333', mt: 0.5, fontSize: '0.875rem' }}>
                                Check with admin if this is unexpected
                              </Typography>
                            </Box>
                          </Box>
                        )}

                        {/* All EPIC Release boxes */}
                        {expandedEpic && releaseRows.map((row, rowIdx) =>
                          row.map((release, idx) => {
                            const bar = calculateReleaseBar(release.release_start_date, release.release_end_date, release.range);
                            if (!bar) return null;

                            const isProd = release.environment === 'PROD';
                            const isMultiMarket = release.isMultiMarket;
                            const markets = release.markets || [release.market].filter(Boolean);
                            const bgColor = isMultiMarket && markets.length > 0
                              ? getMarketColor(markets[0])
                              : getMarketColor(release.market);

                            // Display text: Environment for EPIC
                            const displayText = release.environment;
                            const fontSize = getFontSize(bar.width, displayText.length);

                            const baseHeight = 28; // Reduced by ~15% for better readability
                            const boxHeight = getMultiMarketHeight(markets.length, baseHeight);

                            return (
                              <Box
                                key={`${rowIdx}-${idx}`}
                                sx={{
                                  position: 'absolute',
                                  left: `${bar.left}%`,
                                  top: rowIdx * ROW_HEIGHT + 6,
                                  width: `${bar.width}%`,
                                }}
                              >
                                {/* PROD Star Label (side marker) */}
                                {isProd && (
                                  <StarIcon
                                    sx={{
                                      position: 'absolute',
                                      top: -8,
                                      left: -8,
                                      fontSize: 16,
                                      color: '#FFD700',
                                      zIndex: 20,
                                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
                                    }}
                                  />
                                )}

                                {/* Release Box */}
                                <Tooltip
                                  title={formatTooltip(
                                    getShortSourceName('EPIC'),
                                    markets.filter(Boolean),
                                    getEventType('EPIC'),
                                    [
                                      release.release_period ? `Period: ${release.release_period}` : null,
                                      release.release_start_date ? `Start: ${new Date(release.release_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                      release.release_end_date ? `End: ${new Date(release.release_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                      release.refresh_details ? `Details: ${release.refresh_details}` : null,
                                    ].filter(Boolean).join(' | ')
                                  )}
                                >
                                  <Box
                                    sx={{
                                      width: '100%',
                                      height: boxHeight,
                                      position: 'relative',
                                      overflow: 'hidden',
                                      border: '1px solid rgba(0,0,0,0.15)',
                                      borderRadius: 0.5,
                                      cursor: 'pointer',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                                      '&:hover': {
                                        boxShadow: '0 3px 8px rgba(0,0,0,0.2)',
                                        zIndex: 10,
                                        transform: 'translateY(-1px)',
                                        transition: 'all 0.15s ease',
                                      },
                                    }}
                                  >
                                    {/* Color-strip segmentation for multi-market */}
                                    {isMultiMarket && markets.length > 1 ? (
                                      <>
                                        {markets.map((market, mIdx) => (
                                          <Box
                                            key={mIdx}
                                            sx={{
                                              position: 'absolute',
                                              top: `${(mIdx / markets.length) * 100}%`,
                                              left: 0,
                                              right: 0,
                                              height: `${100 / markets.length}%`,
                                              bgcolor: getMarketColor(market),
                                            }}
                                          />
                                        ))}
                                        {/* Text overlay */}
                                        <Box
                                          sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            px: '7px',
                                            py: '5px',
                                          }}
                                        >
                                          <Typography
                                            sx={{
                                              fontSize: fontSize,
                                              fontWeight: 600,
                                              fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                                              lineHeight: 1.2,
                                              color: '#FFFFFF',
                                              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                                              textAlign: 'center',
                                              whiteSpace: 'normal',
                                              overflowWrap: 'anywhere',
                                              display: '-webkit-box',
                                              WebkitLineClamp: 2,
                                              WebkitBoxOrient: 'vertical',
                                              overflow: 'hidden',
                                            }}
                                          >
                                            {displayText}
                                          </Typography>
                                        </Box>
                                      </>
                                    ) : (
                                      <Box
                                        sx={{
                                          width: '100%',
                                          height: '100%',
                                          bgcolor: bgColor,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          px: '7px',
                                          py: '5px',
                                        }}
                                      >
                                        <Typography
                                          sx={{
                                            fontSize: fontSize,
                                            fontWeight: 600,
                                            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                                            lineHeight: 1.2,
                                            color: getTextColor(bgColor),
                                            textAlign: 'center',
                                            whiteSpace: 'normal',
                                            overflowWrap: 'anywhere',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                          }}
                                        >
                                          {displayText}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                </Tooltip>
                              </Box>
                            );
                          })
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })()}

              {/* DT Mobile Lane - Collapsible */}
              {isLaneVisible('KP.org') && (() => {
                // No market merging for DT Mobile (market is null)
                const mergedDtMobileData = filteredDtMobileData;

                const releaseRows = packReleasesIntoRows(mergedDtMobileData, (release) =>
                  calculateReleaseBar(release.start, release.end, release.range)
                );
                const ROW_HEIGHT = 40;
                const laneHeight = expandedDtMobile ? Math.max(60, releaseRows.length * ROW_HEIGHT + 16) : 52;

                return (
                  <Box sx={{
                    borderBottom: '2px solid #e0e0e0',
                    boxShadow: expandedDtMobile ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                    <Box sx={{ display: 'flex', cursor: 'pointer' }} onClick={() => setExpandedDtMobile(!expandedDtMobile)}>
                      <Box sx={{
                        width: 180,
                        minWidth: 180,
                        flexShrink: 0,
                        p: 0.75,
                        borderRight: '1px solid #e0e0e0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: expandedDtMobile ? 'linear-gradient(180deg, #f8f9fa 0%, #f0f2f5 100%)' : 'linear-gradient(180deg, #e8eaed 0%, #dadce0 100%)',
                        boxSizing: 'border-box',
                        transition: 'background 0.2s ease',
                        '&:hover': { background: 'linear-gradient(180deg, #e3e5e8 0%, #d5d7da 100%)' },
                      }}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a73e8', fontSize: '0.9rem' }}>
                          KP.Org
                        </Typography>
                        <IconButton size="small" sx={{ p: 0, color: '#5f6368', pointerEvents: 'none' }}>
                          {expandedDtMobile ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      </Box>
                      <Box sx={{
                        flex: 1,
                        position: 'relative',
                        height: laneHeight,
                        background: expandedDtMobile ? '#fafbfc' : 'linear-gradient(180deg, #f5f5f5 0%, #eeeeee 100%)',
                        overflow: 'hidden',
                        transition: 'height 0.2s ease, background 0.2s ease',
                      }}>
                        {/* Month grid and counts */}
                        {visibleMonths.map((month, idx) => {
                          const count = getMonthActivityCount(mergedDtMobileData, month, 'start', 'end');
                          return (
                            <Box
                              key={month}
                              sx={{
                                position: 'absolute',
                                left: `${idx * columnWidthPercent}%`,
                                top: 0,
                                bottom: 0,
                                width: `${columnWidthPercent}%`,
                                borderLeft: idx > 0 ? '1px solid' : 'none',
                                borderColor: 'divider',
                                bgcolor: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {!expandedDtMobile && count && (
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>
                                  {count}
                                </Typography>
                              )}
                            </Box>
                          );
                        })}

                        {/* No Data Message */}
                        {mergedDtMobileData.length === 0 && (
                          <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: '#f5f5f5',
                            zIndex: 10,
                          }}>
                            <Box sx={{ textAlign: 'center', ml: -500 }}>
                              <Typography sx={{ fontWeight: 600, color: '#000000', fontSize: '1rem' }}>
                                No Data to Display
                              </Typography>
                              <Typography sx={{ color: '#333333', mt: 0.5, fontSize: '0.875rem' }}>
                                Check with admin if this is unexpected
                              </Typography>
                            </Box>
                          </Box>
                        )}

                        {/* All DT Mobile Release boxes */}
                        {expandedDtMobile && releaseRows.map((row, rowIdx) =>
                          row.map((release, idx) => {
                            const bar = calculateReleaseBar(release.start, release.end, release.range);
                            if (!bar) return null;

                            // DT Mobile has null market - use grey color
                            const bgColor = '#9E9E9E';

                            // Display text: "Release - Name" format for DT Mobile
                            const displayText = release.release && release.name
                              ? `${release.release} - ${release.name}`
                              : release.release || release.name || 'DT Mobile';
                            const fontSize = getFontSize(bar.width, displayText.length);

                            const baseHeight = 28; // Reduced by ~15% for better readability
                            // Show star only for PROD environment
                            const isProd = (release.environment || release.name || '').toUpperCase().includes('PROD');

                            return (
                              <Box
                                key={`${rowIdx}-${idx}`}
                                sx={{
                                  position: 'absolute',
                                  left: `${bar.left}%`,
                                  top: rowIdx * ROW_HEIGHT + 6,
                                  width: `${bar.width}%`,
                                }}
                              >
                                {/* PROD Star Label */}
                                {isProd && (
                                  <StarIcon
                                    sx={{
                                      position: 'absolute',
                                      top: -8,
                                      left: -8,
                                      fontSize: 16,
                                      color: '#FFD700',
                                      zIndex: 20,
                                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
                                    }}
                                  />
                                )}

                                {/* Release Box */}
                                <Tooltip
                                  title={formatTooltip(
                                    getShortSourceName('DT Mobile'),
                                    [],
                                    getEventType('DT Mobile'),
                                    [
                                      release.release ? `Release: ${release.release}` : null,
                                      release.start ? `Start: ${new Date(release.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                      release.end ? `End: ${new Date(release.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                      release.sprints ? `Sprints: ${release.sprints}` : null,
                                      release.notes ? `Notes: ${release.notes}` : null,
                                    ].filter(Boolean).join(' | ')
                                  )}
                                >
                                  <Box
                                    sx={{
                                      width: '100%',
                                      height: baseHeight,
                                      bgcolor: bgColor,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      px: '7px',
                                      py: '5px',
                                      border: '1px solid rgba(0,0,0,0.15)',
                                      borderRadius: 0.5,
                                      cursor: 'pointer',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                                      '&:hover': {
                                        boxShadow: '0 3px 8px rgba(0,0,0,0.2)',
                                        zIndex: 10,
                                        transform: 'translateY(-1px)',
                                        transition: 'all 0.15s ease',
                                      },
                                    }}
                                  >
                                    <Typography
                                      sx={{
                                        fontSize: fontSize,
                                        fontWeight: 600,
                                        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                                        lineHeight: 1.2,
                                        color: getTextColor(bgColor),
                                        textAlign: 'center',
                                        whiteSpace: 'normal',
                                        overflowWrap: 'anywhere',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                      }}
                                    >
                                      {displayText}
                                    </Typography>
                                  </Box>
                                </Tooltip>
                              </Box>
                            );
                          })
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })()}

              {/* FS Lane - Collapsible */}
              {isLaneVisible('Legacy Membership') && (() => {
                // Merge identical events across markets (use cleaned text for matching)
                const mergedFsData = mergeIdenticalEvents(
                  filteredFsData,
                  (item) => item.start,
                  (item) => item.end,
                  (item) => cleanEventText(item.name || item.application || '', 'fs')
                );

                const releaseRows = packReleasesIntoRows(mergedFsData, (release) =>
                  calculateReleaseBar(release.start, release.end, release.range)
                );
                const ROW_HEIGHT = 40;
                const laneHeight = expandedFs ? Math.max(60, releaseRows.length * ROW_HEIGHT + 16) : 52;

                return (
                  <Box sx={{
                    borderBottom: '2px solid #e0e0e0',
                    boxShadow: expandedFs ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                    <Box sx={{ display: 'flex', cursor: 'pointer' }} onClick={() => setExpandedFs(!expandedFs)}>
                      <Box sx={{
                        width: 180,
                        minWidth: 180,
                        flexShrink: 0,
                        p: 0.75,
                        borderRight: '1px solid #e0e0e0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: expandedFs ? 'linear-gradient(180deg, #f8f9fa 0%, #f0f2f5 100%)' : 'linear-gradient(180deg, #e0e7ed 0%, #c5d4e0 100%)',
                        boxSizing: 'border-box',
                        transition: 'background 0.2s ease',
                        '&:hover': { background: 'linear-gradient(180deg, #d8dfe5 0%, #c0d0dd 100%)' },
                      }}
                      >
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a73e8', fontSize: '0.9rem', lineHeight: 1.2, fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif' }}>
                            Legacy Membership
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#1a73e8', fontSize: '0.7rem', opacity: 0.7 }}>
                            FS/CM/TMS
                          </Typography>
                        </Box>
                        <IconButton size="small" sx={{ p: 0, color: '#5f6368', pointerEvents: 'none' }}>
                          {expandedFs ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      </Box>
                      <Box sx={{
                        flex: 1,
                        position: 'relative',
                        height: laneHeight,
                        background: expandedFs ? '#fafbfc' : 'linear-gradient(180deg, #f5f5f5 0%, #e8e8e8 100%)',
                        overflow: 'hidden',
                        transition: 'height 0.2s ease, background 0.2s ease',
                      }}>                        {/* Month grid and counts */}
                        {visibleMonths.map((month, idx) => {
                          const count = getMonthActivityCount(mergedFsData, month, 'start', 'end');
                          return (
                            <Box
                              key={month}
                              sx={{
                                position: 'absolute',
                                left: `${idx * columnWidthPercent}%`,
                                top: 0,
                                bottom: 0,
                                width: `${columnWidthPercent}%`,
                                borderLeft: idx > 0 ? '1px solid' : 'none',
                                borderColor: 'divider',
                                bgcolor: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {!expandedFs && count && (
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>
                                  {count}
                                </Typography>
                              )}
                            </Box>
                          );
                        })}

                        {/* No Data Message - merged row with no dividers */}
                        {mergedFsData.length === 0 && (
                          <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: '#f5f5f5',
                            zIndex: 10,
                          }}>
                            <Box sx={{ textAlign: 'center', ml: -500 }}>
                              <Typography sx={{ fontWeight: 600, color: '#000000', fontSize: '1rem' }}>
                                No Data to Display
                              </Typography>
                              <Typography sx={{ color: '#333333', mt: 0.5, fontSize: '0.875rem' }}>
                                Check with admin if this is unexpected
                              </Typography>
                            </Box>
                          </Box>
                        )}

                        {/* All FS Release boxes */}
                        {expandedFs && releaseRows.map((row, rowIdx) =>
                          row.map((release, idx) => {
                            const bar = calculateReleaseBar(release.start, release.end, release.range);
                            if (!bar) return null;

                            // Multi-market handling
                            const isMultiMarket = release.isMultiMarket;
                            const markets = release.markets || [release.market].filter(Boolean);
                            const bgColor = isMultiMarket && markets.length > 0
                              ? getMarketColor(markets[0])
                              : getMarketColor(release.market);

                            // Clean up text: remove FS:, CM:, TMS: prefixes, then truncate to first 3 words
                            const fullText = release.name || release.application || 'FS';
                            const cleanedText = cleanEventText(fullText, 'fs');
                            const displayText = truncateToThreeWords(cleanedText);
                            const fontSize = getFontSize(bar.width, displayText.length);

                            const baseHeight = 28; // Reduced by ~15% for better readability
                            const boxHeight = getMultiMarketHeight(markets.length, baseHeight);

                            return (
                              <Box
                                key={`${rowIdx}-${idx}`}
                                sx={{
                                  position: 'absolute',
                                  left: `${bar.left}%`,
                                  top: rowIdx * ROW_HEIGHT + 6,
                                  width: `${bar.width}%`,
                                }}
                              >
                                {/* Release Box */}
                                <Tooltip
                                  key={`${rowIdx}-${idx}`}
                                  title={formatTooltip(
                                    getShortSourceName('FS'),
                                    markets.filter(Boolean),
                                    getEventType('FS'),
                                    [
                                      release.application ? `App: ${release.application}` : null,
                                      release.start ? `Start: ${new Date(release.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                      release.end ? `End: ${new Date(release.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                    ].filter(Boolean).join(' | ')
                                  )}
                                >
                                  <Box
                                    sx={{
                                      width: '100%',
                                      height: boxHeight,
                                      position: 'relative',
                                      overflow: 'hidden',
                                      border: '1px solid rgba(0,0,0,0.15)',
                                      borderRadius: 0.5,
                                      cursor: 'pointer',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                                      '&:hover': {
                                        boxShadow: '0 3px 8px rgba(0,0,0,0.2)',
                                        zIndex: 10,
                                        transform: 'translateY(-1px)',
                                        transition: 'all 0.15s ease',
                                      },
                                    }}
                                  >
                                    {/* Color-strip segmentation for multi-market */}
                                    {isMultiMarket && markets.length > 1 ? (
                                      <>
                                        {markets.map((market, mIdx) => (
                                          <Box
                                            key={mIdx}
                                            sx={{
                                              position: 'absolute',
                                              top: `${(mIdx / markets.length) * 100}%`,
                                              left: 0,
                                              right: 0,
                                              height: `${100 / markets.length}%`,
                                              bgcolor: getMarketColor(market),
                                            }}
                                          />
                                        ))}
                                        {/* Text overlay */}
                                        <Box
                                          sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            px: '7px',
                                            py: '5px',
                                          }}
                                        >
                                          <Typography
                                            sx={{
                                              fontSize: fontSize,
                                              fontWeight: 600,
                                              fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                                              lineHeight: 1.2,
                                              color: '#FFFFFF',
                                              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                                              textAlign: 'center',
                                              whiteSpace: 'normal',
                                              overflowWrap: 'anywhere',
                                              display: '-webkit-box',
                                              WebkitLineClamp: 2,
                                              WebkitBoxOrient: 'vertical',
                                              overflow: 'hidden',
                                            }}
                                          >
                                            {displayText}
                                          </Typography>
                                        </Box>
                                      </>
                                    ) : (
                                      <Box
                                        sx={{
                                          width: '100%',
                                          height: '100%',
                                          bgcolor: bgColor,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          px: '7px',
                                          py: '5px',
                                        }}
                                      >
                                        <Typography
                                          sx={{
                                            fontSize: fontSize,
                                            fontWeight: 600,
                                            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                                            lineHeight: 1.2,
                                            color: getTextColor(bgColor),
                                            textAlign: 'center',
                                            whiteSpace: 'normal',
                                            overflowWrap: 'anywhere',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                          }}
                                        >
                                          {displayText}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                </Tooltip>
                              </Box>
                            );
                          })
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })()}

              {/* KPMC Lane - Collapsible */}
              {isLaneVisible('KPMC') && (() => {
                // Merge identical KPMC events (use cleaned text for matching)
                const mergedKpmcData = mergeIdenticalEvents(
                  filteredKpmcData,
                  (item) => item.start,
                  (item) => item.finish,
                  (item) => cleanEventText(item.task_name || '', 'kpmc')
                );

                const releaseRows = packReleasesIntoRows(mergedKpmcData, (release) =>
                  calculateReleaseBar(release.start, release.finish, release.range, true)
                );
                const ROW_HEIGHT = 40;
                const laneHeight = expandedKpmc ? Math.max(60, releaseRows.length * ROW_HEIGHT + 16) : 52;

                return (
                  <Box sx={{
                    borderBottom: '2px solid #e0e0e0',
                    boxShadow: expandedKpmc ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                    <Box sx={{ display: 'flex', cursor: 'pointer' }} onClick={() => setExpandedKpmc(!expandedKpmc)}>
                      <Box sx={{
                        width: 180,
                        minWidth: 180,
                        flexShrink: 0,
                        p: 0.75,
                        borderRight: '1px solid #e0e0e0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: expandedKpmc ? 'linear-gradient(180deg, #f8f9fa 0%, #f0f2f5 100%)' : 'linear-gradient(180deg, #e8e0ed 0%, #d0c5dc 100%)',
                        boxSizing: 'border-box',
                        transition: 'background 0.2s ease',
                        '&:hover': { background: 'linear-gradient(180deg, #e0d8e5 0%, #c8c0d5 100%)' },
                      }}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a73e8', fontSize: '0.9rem', fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif' }}>
                          KPMC
                        </Typography>
                        <IconButton size="small" sx={{ p: 0, color: '#5f6368', pointerEvents: 'none' }}>
                          {expandedKpmc ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      </Box>
                      <Box sx={{
                        flex: 1,
                        position: 'relative',
                        height: laneHeight,
                        background: expandedKpmc ? '#fafbfc' : 'linear-gradient(180deg, #f5f5f5 0%, #e8e8e8 100%)',
                        overflow: 'hidden',
                        transition: 'height 0.2s ease, background 0.2s ease',
                      }}>                        {/* Month grid and counts */}
                        {visibleMonths.map((month, idx) => {
                          const count = getMonthActivityCount(mergedKpmcData, month, 'start', 'finish');
                          return (
                            <Box
                              key={month}
                              sx={{
                                position: 'absolute',
                                left: `${idx * columnWidthPercent}%`,
                                top: 0,
                                bottom: 0,
                                width: `${columnWidthPercent}%`,
                                borderLeft: idx > 0 ? '1px solid' : 'none',
                                borderColor: 'divider',
                                bgcolor: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {!expandedKpmc && count && (
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>
                                  {count}
                                </Typography>
                              )}
                            </Box>
                          );
                        })}

                        {/* No Data Message - merged row with no dividers */}
                        {mergedKpmcData.length === 0 && (
                          <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: '#f5f5f5',
                            zIndex: 10,
                          }}>
                            <Box sx={{ textAlign: 'center', ml: -500 }}>
                              <Typography sx={{ fontWeight: 600, color: '#000000', fontSize: '1rem' }}>
                                No Data to Display
                              </Typography>
                              <Typography sx={{ color: '#333333', mt: 0.5, fontSize: '0.875rem' }}>
                                Check with admin if this is unexpected
                              </Typography>
                            </Box>
                          </Box>
                        )}

                        {/* All KPMC Release boxes */}
                        {expandedKpmc && releaseRows.map((row, rowIdx) =>
                          row.map((release, idx) => {
                            const bar = calculateReleaseBar(release.start, release.finish, release.range, true);
                            if (!bar) return null;

                            // Smart text processing for KPMC - skip generic date prefixes
                            const fullText = release.task_name || 'KPMC';
                            const displayText = getKpmcDisplayText(fullText);
                            const fontSize = getFontSize(bar.width, displayText.length);

                            // Base height for KPMC (reduced to match other lanes)
                            const baseHeight = 28; // Reduced by ~15% for better readability

                            return (
                              <Tooltip
                                key={`${rowIdx}-${idx}`}
                                title={formatTooltip(
                                  getShortSourceName('KPMC'),
                                  [],
                                  getEventType('KPMC'),
                                  [
                                    release.start ? `Start: ${new Date(release.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                    release.finish ? `Finish: ${new Date(release.finish).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                    release.submit_manifest_by ? `Submit By: ${new Date(release.submit_manifest_by).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                  ].filter(Boolean).join(' | ')
                                )}
                              >
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    left: `${bar.left}%`,
                                    top: rowIdx * ROW_HEIGHT + 6,
                                    width: `${bar.width}%`,
                                    height: baseHeight,
                                    bgcolor: '#9E9E9E',
                                    border: '1px solid rgba(0,0,0,0.15)',
                                    borderRadius: 0.5,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    px: '10px',
                                    py: '7px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                                    '&:hover': {
                                      bgcolor: '#757575',
                                      boxShadow: '0 3px 8px rgba(0,0,0,0.2)',
                                      zIndex: 10,
                                      transform: 'translateY(-1px)',
                                      transition: 'all 0.15s ease',
                                    },
                                  }}
                                >
                                  <Typography
                                    sx={{
                                      fontSize: fontSize,
                                      fontWeight: 600,
                                      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                                      lineHeight: 1.3,
                                      color: '#FFFFFF',
                                      textAlign: 'center',
                                      whiteSpace: 'normal',
                                      overflowWrap: 'anywhere',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {displayText}
                                  </Typography>
                                </Box>
                              </Tooltip>
                            );
                          })
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })()}

              {/* KPCC Lane - Collapsible */}
              {isLaneVisible('KPCC') && (() => {
                // Merge identical KPCC events across markets
                const mergedKpccData = mergeIdenticalEvents(
                  filteredKpccData,
                  (item) => item.golive_date,
                  (item) => null,
                  (item) => item.release_id
                );

                const releaseRows = packReleasesIntoRows(mergedKpccData, (release) =>
                  calculateReleaseBar(release.golive_date, null, false)
                );
                const ROW_HEIGHT = 40;
                const laneHeight = expandedKpcc ? Math.max(60, releaseRows.length * ROW_HEIGHT + 16) : 52;

                return (
                  <Box sx={{
                    borderBottom: '2px solid #e0e0e0',
                    boxShadow: expandedKpcc ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                    <Box sx={{ display: 'flex', cursor: 'pointer' }} onClick={() => setExpandedKpcc(!expandedKpcc)}>
                      <Box sx={{
                        width: 180,
                        minWidth: 180,
                        flexShrink: 0,
                        p: 0.75,
                        borderRight: '1px solid #e0e0e0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: expandedKpcc ? 'linear-gradient(180deg, #f8f9fa 0%, #f0f2f5 100%)' : 'linear-gradient(180deg, #e3f2fd 0%, #bbdefb 100%)',
                        boxSizing: 'border-box',
                        transition: 'background 0.2s ease',
                        '&:hover': { background: 'linear-gradient(180deg, #d1e8fa 0%, #b0d4f7 100%)' },
                      }}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a73e8', fontSize: '0.9rem', fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif' }}>
                          KPCC
                        </Typography>
                        <IconButton size="small" sx={{ p: 0, color: '#5f6368', pointerEvents: 'none' }}>
                          {expandedKpcc ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      </Box>
                      <Box sx={{
                        flex: 1,
                        position: 'relative',
                        height: laneHeight,
                        background: expandedKpcc ? '#fafbfc' : 'linear-gradient(180deg, #f5f5f5 0%, #eeeeee 100%)',
                        overflow: 'hidden',
                        transition: 'height 0.2s ease, background 0.2s ease',
                      }}>
                        {/* Month grid and counts */}
                        {visibleMonths.map((month, idx) => {
                          const count = getMonthActivityCount(mergedKpccData, month, 'golive_date', null);
                          return (
                            <Box
                              key={month}
                              sx={{
                                position: 'absolute',
                                left: `${idx * columnWidthPercent}%`,
                                top: 0,
                                bottom: 0,
                                width: `${columnWidthPercent}%`,
                                borderLeft: idx > 0 ? '1px solid' : 'none',
                                borderColor: 'divider',
                                bgcolor: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {!expandedKpcc && count && (
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>
                                  {count}
                                </Typography>
                              )}
                            </Box>
                          );
                        })}

                        {/* No Data Message */}
                        {mergedKpccData.length === 0 && (
                          <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: '#f5f5f5',
                            zIndex: 10,
                          }}>
                            <Box sx={{ textAlign: 'center', ml: -500 }}>
                              <Typography sx={{ fontWeight: 600, color: '#000000', fontSize: '1rem' }}>
                                No Data to Display
                              </Typography>
                              <Typography sx={{ color: '#333333', mt: 0.5, fontSize: '0.875rem' }}>
                                Check with admin if this is unexpected
                              </Typography>
                            </Box>
                          </Box>
                        )}

                        {/* All KPCC Release boxes */}
                        {expandedKpcc && releaseRows.map((row, rowIdx) =>
                          row.map((release, idx) => {
                            const bar = calculateReleaseBar(release.golive_date, null, false);
                            if (!bar) return null;

                            const isMultiMarket = release.isMultiMarket;
                            const markets = release.markets || [release.market].filter(Boolean);
                            const bgColor = isMultiMarket && markets.length > 0
                              ? getMarketColor(markets[0])
                              : getMarketColor(release.market);

                            // Display text: release_id
                            const displayText = release.release_id || 'KPCC';
                            const fontSize = getFontSize(bar.width, displayText.length);

                            const baseHeight = 24; // Reduced for half-size to prevent overlap
                            const boxHeight = getMultiMarketHeight(markets.length, baseHeight);

                            return (
                              <Box
                                key={`${rowIdx}-${idx}`}
                                sx={{
                                  position: 'absolute',
                                  left: `${bar.left}%`,
                                  top: rowIdx * ROW_HEIGHT + 6,
                                  width: `${bar.width}%`,
                                }}
                              >
                                {/* Release Box */}
                                <Tooltip
                                  title={formatTooltip(
                                    getShortSourceName('KPCC'),
                                    markets.filter(Boolean),
                                    getEventType('KPCC'),
                                    [
                                      release.golive_date ? `Go-Live: ${new Date(release.golive_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                      release.dor_date ? `DOR: ${new Date(release.dor_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                      release.ots_install_start_date ? `OTS Install: ${new Date(release.ots_install_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                      release.auto_regression_start_date ? `Auto Regression: ${new Date(release.auto_regression_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                      release.dry_run_start_date ? `Dry Run: ${new Date(release.dry_run_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
                                    ].filter(Boolean).join(' | ')
                                  )}
                                >
                                  <Box
                                    sx={{
                                      width: '100%',
                                      height: boxHeight,
                                      position: 'relative',
                                      overflow: 'hidden',
                                      border: '1px solid rgba(0,0,0,0.15)',
                                      borderRadius: 0.5,
                                      cursor: 'pointer',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                                      '&:hover': {
                                        boxShadow: '0 3px 8px rgba(0,0,0,0.2)',
                                        zIndex: 10,
                                        transform: 'translateY(-1px)',
                                        transition: 'all 0.15s ease',
                                      },
                                    }}
                                  >
                                    {/* Color-strip segmentation for multi-market */}
                                    {isMultiMarket && markets.length > 1 ? (
                                      <>
                                        {markets.map((market, mIdx) => (
                                          <Box
                                            key={mIdx}
                                            sx={{
                                              position: 'absolute',
                                              top: `${(mIdx / markets.length) * 100}%`,
                                              left: 0,
                                              right: 0,
                                              height: `${100 / markets.length}%`,
                                              bgcolor: getMarketColor(market),
                                            }}
                                          />
                                        ))}
                                        {/* Text overlay */}
                                        <Box
                                          sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            px: '7px',
                                            py: '5px',
                                          }}
                                        >
                                          <Typography
                                            sx={{
                                              fontSize: fontSize,
                                              fontWeight: 600,
                                              fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                                              lineHeight: 1.2,
                                              color: '#FFFFFF',
                                              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                                              textAlign: 'center',
                                              whiteSpace: 'normal',
                                              overflowWrap: 'anywhere',
                                              display: '-webkit-box',
                                              WebkitLineClamp: 2,
                                              WebkitBoxOrient: 'vertical',
                                              overflow: 'hidden',
                                            }}
                                          >
                                            {displayText}
                                          </Typography>
                                        </Box>
                                      </>
                                    ) : (
                                      <Box
                                        sx={{
                                          width: '100%',
                                          height: '100%',
                                          bgcolor: bgColor,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          px: '7px',
                                          py: '5px',
                                        }}
                                      >
                                        <Typography
                                          sx={{
                                            fontSize: fontSize,
                                            fontWeight: 600,
                                            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                                            lineHeight: 1.2,
                                            color: getTextColor(bgColor),
                                            textAlign: 'center',
                                            whiteSpace: 'normal',
                                            overflowWrap: 'anywhere',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                          }}
                                        >
                                          {displayText}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                </Tooltip>
                              </Box>
                            );
                          })
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })()}

              {/* VVE Lane - HIDDEN */}

              {/* Bottom spacer for breathing room */}
              <Box sx={{ height: 16, flexShrink: 0 }} />
            </Box>
          </Paper>
        </Container>
      </Box>

      {/* Right Legend Panel - Compact */}
      <Paper sx={{ width: 200, p: 1.5, borderLeft: '1px solid', borderColor: 'divider', overflow: 'auto' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, fontSize: '0.875rem' }}>
          Markets
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {uniqueMarkets.length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
              No markets available
            </Typography>
          ) : (
            uniqueMarkets.map((market) => {
              const color = getMarketColor(market);
              const isSelected = filterMarkets.includes(market);
              return (
                <Box
                  key={market}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    cursor: 'pointer',
                    p: 0.5,
                    borderRadius: 0.75,
                    bgcolor: isSelected ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                    border: isSelected ? '1px solid rgba(25, 118, 210, 0.3)' : '1px solid transparent',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: isSelected ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                  onClick={() => toggleMarketFilter(market)}
                >
                  <Box sx={{
                    width: 18,
                    height: 18,
                    borderRadius: 0.75,
                    bgcolor: color,
                    border: isSelected ? '2px solid #1976d2' : '1px solid rgba(0,0,0,0.1)',
                    flexShrink: 0,
                    transition: 'border 0.2s ease',
                    position: 'relative',
                  }}>
                    {isSelected && (
                      <CheckCircleIcon sx={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        fontSize: 14,
                        color: '#1976d2',
                        bgcolor: 'white',
                        borderRadius: '50%',
                      }} />
                    )}
                  </Box>
                  <Typography variant="caption" sx={{
                    fontWeight: isSelected ? 600 : 500,
                    fontSize: '0.75rem',
                    color: isSelected ? '#1976d2' : 'inherit',
                    transition: 'all 0.2s ease',
                  }}>{market}</Typography>
                </Box>
              );
            })
          )}
        </Box>

        {/* Lanes Filter Legend */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2, mb: 1.5, fontSize: '0.875rem' }}>
          Applications
        </Typography>
        <FormControl fullWidth size="small">
          <InputLabel id="applications-filter-label">Select Applications</InputLabel>
          <Select
            labelId="applications-filter-label"
            id="applications-filter"
            multiple
            value={filterLanes}
            onChange={(e) => setFilterLanes(e.target.value)}
            input={<OutlinedInput label="Select Applications" />}
            renderValue={(selected) => selected.length === 0 ? 'All' : `${selected.length} selected`}
            MenuProps={{
              PaperProps: {
                style: {
                  maxHeight: 300,
                },
              },
            }}
          >
            {LANE_NAMES.map((lane) => (
              <MenuItem key={lane} value={lane}>
                <Checkbox checked={filterLanes.includes(lane)} />
                <ListItemText primary={lane} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {/* Chat Widget */}
      <ChatWidget />
    </Box>
  );
}

