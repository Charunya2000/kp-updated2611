'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    TextField,
    Alert,
    CircularProgress,
    Stack,
    ToggleButtonGroup,
    ToggleButton,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    ListItemText,
} from '@mui/material';
import {
    Download,
    Login,
    People,
    Groups,
    ChatBubble,
    Diversity3,
} from '@mui/icons-material';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import DashboardBox from '@/app/components/admin/DashboardBox';

function formatLocalDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getDefaultDates() {
    const end = new Date();

    // Construct start using local year/month/day to avoid UTC shifts from toISOString
    const tentativeStart = new Date(end.getFullYear(), end.getMonth() - 6, end.getDate());

    // If the day rolled forward because target month has fewer days (e.g., 31 -> 30),
    // adjust to the last day of the target month instead of letting the Date roll into the next month.
    let targetYear = end.getFullYear();
    let targetMonthIndex = end.getMonth() - 6;
    if (targetMonthIndex < 0) {
        targetMonthIndex += 12;
        targetYear -= 1;
    }

    let start = tentativeStart;
    if (start.getMonth() !== targetMonthIndex || start.getFullYear() !== targetYear) {
        const lastDay = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
        start = new Date(targetYear, targetMonthIndex, lastDay);
    }

    return {
        startDate: formatLocalDate(start),
        endDate: formatLocalDate(end),
    };
}

/**
 * Aggregate daily data into weekly or monthly buckets.
 */
function aggregateData(daily, granularity) {
    if (granularity === 'daily') return daily;

    const buckets = {};
    for (const day of daily) {
        let key;
        if (granularity === 'weekly') {
            const d = new Date(day.date);
            const dayOfWeek = d.getUTCDay();
            const monday = new Date(d);
            monday.setUTCDate(d.getUTCDate() - ((dayOfWeek + 6) % 7));
            key = monday.toISOString().slice(0, 10);
        } else {
            key = day.date.slice(0, 7); // YYYY-MM
        }

        if (!buckets[key]) {
            buckets[key] = { date: key, logins: 0, uniqueLoginUsers: 0, totalPrompts: 0, totalPromptUsers: 0, teams: {} };
        }
        const b = buckets[key];
        b.logins += day.logins;
        b.uniqueLoginUsers += day.uniqueLoginUsers;
        b.totalPrompts += day.totalPrompts;
        b.totalPromptUsers += day.totalPromptUsers;

        for (const [team, stats] of Object.entries(day.teams || {})) {
            if (!b.teams[team]) b.teams[team] = { prompts: 0, uniqueUsers: 0 };
            b.teams[team].prompts += stats.prompts;
            b.teams[team].uniqueUsers += stats.uniqueUsers;
        }
    }

    return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
}

const ENV_LABELS = { dev: 'DEV', pp: 'Preprod', uat: 'UAT', psup: 'PSUP', prod: 'Prod' };

export default function UsageReport({ envName }) {
    const defaults = getDefaultDates();
    const [startDate, setStartDate] = useState(defaults.startDate);
    const [endDate, setEndDate] = useState(defaults.endDate);

    // Download state
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState(null);

    // Executive summary state
    const [summaryData, setSummaryData] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState(null);
    const [selectedEnv, setSelectedEnv] = useState('dev');

    // Chart state
    const [chartDataByEnv, setChartDataByEnv] = useState({});
    const [chartError, setChartError] = useState(null);
    const [granularity, setGranularity] = useState('daily');
    const [metric, setMetric] = useState('logins');
    const [chartType, setChartType] = useState('bar');
    const [selectedTeams, setSelectedTeams] = useState([]);
    const [selectedChartEnvs, setSelectedChartEnvs] = useState(['dev']);

    // Available environments — authoritative list from the API after summary loads;
    // falls back to a client-side default while the request is in flight.
    const availableEnvs = useMemo(() => {
        if (summaryData?.environments?.length) return summaryData.environments;

        if (envName === 'psup') return ['psup'];
        if (envName === 'prod') return ['prod'];

        // Default to the non-prod grouping (dev/uat/pp)
        return ['dev', 'uat', 'pp'];
    }, [summaryData, envName]);

    const handleDownload = async () => {
        if (!startDate || !endDate) {
            setDownloadError('Please select both start and end dates.');
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            setDownloadError('Start date must be before end date.');
            return;
        }

        setDownloadError(null);
        setDownloading(true);

        try {
            const qs = new URLSearchParams({ startDate, endDate });
            const res = await fetch(`/api/admin/usage-report?${qs}`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Request failed with status ${res.status}`);
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `usage-report-${startDate}-to-${endDate}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setDownloadError(err.message);
        } finally {
            setDownloading(false);
        }
    };

    const loadSummaryData = useCallback(async () => {
        if (!startDate || !endDate) return;
        if (new Date(startDate) > new Date(endDate)) return;

        setSummaryError(null);
        setSummaryLoading(true);

        try {
            const qs = new URLSearchParams({ startDate, endDate });
            const res = await fetch(`/api/admin/usage-report/executive-summary?${qs}`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Request failed with status ${res.status}`);
            }
            setSummaryData(await res.json());
        } catch (err) {
            setSummaryError(err.message);
        } finally {
            setSummaryLoading(false);
        }
    }, [startDate, endDate]);

    const [chartLoadingEnvs, setChartLoadingEnvs] = useState(new Set());

    const fetchChartEnv = useCallback(async (env, start, end) => {
        setChartLoadingEnvs((prev) => new Set([...prev, env]));
        setChartError(null);
        try {
            const qs = new URLSearchParams({ startDate: start, endDate: end, env });
            const res = await fetch(`/api/admin/usage-report/chart-data?${qs}`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Request failed with status ${res.status}`);
            }
            const data = await res.json();
            setChartDataByEnv((prev) => ({ ...prev, [env]: data }));
        } catch (err) {
            setChartError(err.message);
        } finally {
            setChartLoadingEnvs((prev) => { const next = new Set(prev); next.delete(env); return next; });
        }
    }, []);

    const loadAllChartData = useCallback(async (start, end, targetEnvs) => {
        if (!start || !end) return;
        if (new Date(start) > new Date(end)) return;

        // Non-pp envs load in parallel; pp runs sequentially (CosmosDB rate limiting)
        const nonPp = targetEnvs.filter((e) => e !== 'pp');
        const includePp = targetEnvs.includes('pp');
        await Promise.all(nonPp.map((env) => fetchChartEnv(env, start, end)));
        if (includePp) await fetchChartEnv('pp', start, end);
    }, [fetchChartEnv]);

    // Reload summary when dates change
    useEffect(() => {
        setSummaryData(null);
        loadSummaryData();
    }, [loadSummaryData]);

    // Sync selectedEnv to a valid value when available environments change
    useEffect(() => {
        if (!availableEnvs.includes(selectedEnv)) {
            setSelectedEnv(availableEnvs[0]);
        }
    }, [availableEnvs, selectedEnv]);

    // Reload chart data when dates or available environments change
    const availableEnvsKey = availableEnvs.join(',');
    useEffect(() => {
        if (!startDate || !endDate) return;
        setChartDataByEnv({});
        setSelectedChartEnvs((prev) => {
            const valid = prev.filter((e) => availableEnvs.includes(e));
            return valid.length > 0 ? valid : [availableEnvs[0]];
        });
        loadAllChartData(startDate, endDate, availableEnvs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate, availableEnvsKey]);

    // No auto-selection of teams when env changes — user controls team selection manually

    const chartLoading = selectedChartEnvs.some(env => chartLoadingEnvs.has(env));

    // Union of team names from all selected envs
    const combinedTeamNames = useMemo(() =>
        [...new Set(selectedChartEnvs.flatMap(env => chartDataByEnv[env]?.teamNames || []))].sort(),
        [selectedChartEnvs, chartDataByEnv]
    );

    // Aggregated daily data per env
    const aggregatedByEnv = useMemo(() => {
        const result = {};
        for (const env of selectedChartEnvs) {
            const data = chartDataByEnv[env];
            if (data?.daily) result[env] = aggregateData(data.daily, granularity);
        }
        return result;
    }, [chartDataByEnv, selectedChartEnvs, granularity]);

    const chartConfig = useMemo(() => {
        const multiEnv = selectedChartEnvs.length > 1;
        const loadedEnvs = selectedChartEnvs.filter(env => aggregatedByEnv[env]?.length);
        if (!loadedEnvs.length) return null;

        const allDates = [...new Set(
            loadedEnvs.flatMap(env => aggregatedByEnv[env].map(d => d.date))
        )].sort();
        if (!allDates.length) return null;

        const xLabels = allDates;

        if (metric === 'logins') {
            const series = loadedEnvs.map(env => {
                const byDate = Object.fromEntries(aggregatedByEnv[env].map(d => [d.date, d]));
                const prefix = multiEnv ? `${ENV_LABELS[env]} - ` : '';
                return { data: allDates.map(d => byDate[d]?.logins || 0), label: `${prefix}Total Logins` };
            });
            return { xLabels, series };
        }

        if (metric === 'prompts') {
            const series = loadedEnvs.map(env => {
                const byDate = Object.fromEntries(aggregatedByEnv[env].map(d => [d.date, d]));
                const prefix = multiEnv ? `${ENV_LABELS[env]} - ` : '';
                return { data: allDates.map(d => byDate[d]?.totalPrompts || 0), label: `${prefix}Total Prompts` };
            });
            return { xLabels, series };
        }

        if (metric === 'teamPrompts') {
            const series = loadedEnvs.flatMap(env => {
                const byDate = Object.fromEntries(aggregatedByEnv[env].map(d => [d.date, d]));
                const suffix = multiEnv ? ` (${ENV_LABELS[env]})` : '';
                return selectedTeams.map(teamName => ({
                    data: allDates.map(d => byDate[d]?.teams[teamName]?.prompts || 0),
                    label: `${teamName}${suffix}`,
                }));
            });
            return { xLabels, series };
        }

        if (metric === 'teamUsers') {
            const series = loadedEnvs.flatMap(env => {
                const byDate = Object.fromEntries(aggregatedByEnv[env].map(d => [d.date, d]));
                const suffix = multiEnv ? ` (${ENV_LABELS[env]})` : '';
                return selectedTeams.map(teamName => ({
                    data: allDates.map(d => byDate[d]?.teams[teamName]?.uniqueUsers || 0),
                    label: `${teamName}${suffix}`,
                }));
            });
            return { xLabels, series };
        }

        return null;
    }, [aggregatedByEnv, selectedChartEnvs, metric, selectedTeams]);

    const ChartComponent = chartType === 'line' ? LineChart : BarChart;

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
                Usage Report
            </Typography>

            {/* Date Range Controls */}
            <DashboardBox title="Report Settings" sx={{ mb: 3, minHeight: 'auto', p: 4 }}>
                <Stack direction="row" spacing={2} alignItems="flex-end" flexWrap="wrap" useFlexGap>
                    <TextField
                        label="Start Date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                        sx={{ width: 200 }}
                    />
                    <TextField
                        label="End Date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                        sx={{ width: 200 }}
                    />
                    <Button
                        variant="primary"
                        startIcon={downloading ? <CircularProgress size={18} color="inherit" /> : <Download />}
                        onClick={handleDownload}
                        disabled={downloading}
                    >
                        {downloading ? 'Generating...' : 'Download Excel'}
                    </Button>
                    {/* Show-all toggle removed. */}
                </Stack>
                {downloadError && <Alert severity="error" sx={{ mt: 2 }}>{downloadError}</Alert>}
            </DashboardBox>

            {/* Executive Summary */}
            <DashboardBox title="Executive Summary" sx={{ mb: 3, minHeight: 'auto', p: 4 }}>
                {summaryLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : summaryData?.summaries ? (() => {
                    const envData = summaryData.summaries[selectedEnv];
                    const metrics = [
                        { label: 'Total Logins', value: envData?.totalLogins, icon: <Login /> },
                        { label: 'Unique Users', value: envData?.uniqueUsers, icon: <People /> },
                        { label: 'Team Users', value: envData?.totalTeamUniqueUsers, icon: <Groups /> },
                        { label: 'Total Prompts', value: envData?.totalTeamPrompts, icon: <ChatBubble /> },
                        { label: 'Active Teams', value: envData?.activeTeams, icon: <Diversity3 /> },
                    ];

                    return (
                        <>
                            <Stack direction="row" spacing={1} sx={{ mb: 3 }} alignItems="center">
                                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                                    Environment:
                                </Typography>
                                <ToggleButtonGroup
                                    value={selectedEnv}
                                    exclusive
                                    onChange={(e, v) => v && setSelectedEnv(v)}
                                    size="small"
                                >
                                    {summaryData.environments.map((env) => (
                                        <ToggleButton key={env} value={env}>
                                            {summaryData.summaries[env]?.displayName || env.toUpperCase()}
                                        </ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                                {envData?.reportPeriod && (
                                    <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                                        {envData.reportPeriod}
                                    </Typography>
                                )}
                            </Stack>
                            {envData?.error ? (
                                <Alert severity="error">Failed to load data for {envData.displayName}: {envData.error}</Alert>
                            ) : (
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 }}>
                                    {metrics.map((item) => (
                                        <Box
                                            key={item.label}
                                            sx={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                p: 3,
                                                borderRadius: 3,
                                                bgcolor: 'action.hover',
                                                border: '1px solid',
                                                borderColor: 'divider',
                                            }}
                                        >
                                            <Box sx={{ color: 'primary.main', mb: 1 }}>{item.icon}</Box>
                                            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                                                {typeof item.value === 'number' ? item.value.toLocaleString() : '—'}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {item.label}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </>
                    );
                })() : summaryError ? (
                    <Alert severity="error">{summaryError}</Alert>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        No data available.
                    </Typography>
                )}
            </DashboardBox>

            {/* Charts Section */}
            <DashboardBox title="Usage Charts" sx={{ minHeight: 'auto', p: 4 }}>
                {/* Chart Controls */}
                <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
                    <ToggleButtonGroup
                        value={granularity}
                        exclusive
                        onChange={(e, v) => v && setGranularity(v)}
                        size="small"
                    >
                        <ToggleButton value="daily">Daily</ToggleButton>
                        <ToggleButton value="weekly">Weekly</ToggleButton>
                        <ToggleButton value="monthly">Monthly</ToggleButton>
                    </ToggleButtonGroup>

                    <ToggleButtonGroup
                        value={metric}
                        exclusive
                        onChange={(e, v) => v && setMetric(v)}
                        size="small"
                    >
                        <ToggleButton value="logins">Logins</ToggleButton>
                        <ToggleButton value="prompts">Prompts</ToggleButton>
                        <ToggleButton value="teamPrompts">By Team (Prompts)</ToggleButton>
                        <ToggleButton value="teamUsers">By Team (Users)</ToggleButton>
                    </ToggleButtonGroup>

                    <ToggleButtonGroup
                        value={chartType}
                        exclusive
                        onChange={(e, v) => v && setChartType(v)}
                        size="small"
                    >
                        <ToggleButton value="bar">Bar</ToggleButton>
                        <ToggleButton value="line">Line</ToggleButton>
                    </ToggleButtonGroup>

                    <ToggleButtonGroup
                        value={selectedChartEnvs}
                        onChange={(e, v) => v.length > 0 && setSelectedChartEnvs(v)}
                        size="small"
                    >
                        {availableEnvs.map((env) => (
                            <ToggleButton key={env} value={env}>
                                {chartLoadingEnvs.has(env)
                                    ? <><CircularProgress size={12} sx={{ mr: 0.75 }} />{ENV_LABELS[env] || env.toUpperCase()}</>
                                    : (ENV_LABELS[env] || env.toUpperCase())}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>

                    {(metric === 'teamPrompts' || metric === 'teamUsers') && combinedTeamNames.length > 0 && (
                        <>
                            <FormControl size="small" sx={{ minWidth: 220 }}>
                                <InputLabel>Teams</InputLabel>
                                <Select
                                    multiple
                                    value={selectedTeams}
                                    onChange={(e) => setSelectedTeams(e.target.value)}
                                    label="Teams"
                                    renderValue={(selected) => `${selected.length} team${selected.length !== 1 ? 's' : ''}`}
                                >
                                    {combinedTeamNames.map((name) => (
                                        <MenuItem key={name} value={name}>
                                            <Checkbox checked={selectedTeams.includes(name)} />
                                            <ListItemText primary={name} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', ml: 1 }}>
                                <Button
                                    size="small"
                                    onClick={() => setSelectedTeams(combinedTeamNames.slice())}
                                >
                                    Select all Teams
                                </Button>
                                <Button
                                    size="small"
                                    onClick={() => setSelectedTeams([])}
                                >
                                    Deselect all Teams
                                </Button>
                            </Stack>
                        </>
                    )}
                </Stack>

                {/* Chart */}
                {chartLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : chartConfig && chartConfig.series.length > 0 ? (
                    <Box sx={{ width: '100%', height: 500 }}>
                        <ChartComponent
                            xAxis={[{
                                data: chartConfig.xLabels,
                                scaleType: 'band',
                                label: granularity === 'monthly' ? 'Month' : granularity === 'weekly' ? 'Week of' : 'Date',
                                tickLabelStyle: { angle: -45, textAnchor: 'end', fontSize: 11 },
                            }]}
                            yAxis={[{
                                label: metric === 'teamPrompts' ? 'Prompts' : metric === 'teamUsers' ? 'Unique Users' : 'Count',
                            }]}
                            series={chartConfig.series}
                            height={500}
                            margin={{ bottom: 100 }}
                            slotProps={{ legend: { direction: 'row', position: { vertical: 'top', horizontal: 'middle' } } }}
                        />
                    </Box>
                ) : chartError ? (
                    <Alert severity="error">{chartError}</Alert>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        No data available for the selected period and filters.
                    </Typography>
                )}
            </DashboardBox>
        </Box>
    );
}
