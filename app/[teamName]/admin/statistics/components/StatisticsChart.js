'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { Box, CircularProgress, FormControl, FormControlLabel, Checkbox, FormGroup, Switch, Typography, Select, MenuItem, useTheme, InputLabel, TextField, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useParams } from 'next/navigation';
import { getAllAssistants } from '@/app/clientServices/assistantService.js';
import { List as WindowList } from 'react-window';

const NUID_ITEM_HEIGHT = 36;
const NUID_LIST_MAX_HEIGHT = 300;
const NO_CATEGORY_VALUE = '__NO_CATEGORY__';
const NO_CATEGORY_LABEL = 'No Category';

const getCategoryLabel = (value) => (value === NO_CATEGORY_VALUE ? NO_CATEGORY_LABEL : value);

const StatisticsChart = () => {
  const theme = useTheme();
  const { teamName } = useParams();
  const [flavor, setFlavor] = useState('total');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariants, setSelectedVariants] = useState([]);
  const [variants, setVariants] = useState([]);
  const [dateRange, setDateRange] = useState('All');
  const [assistants, setAssistants] = useState([]);
  const [localSelectedAssistant, setLocalSelectedAssistant] = useState('all');
  const [selectedAssistantName, setSelectedAssistantName] = useState('');
  const [nuids, setNuids] = useState([]);
  const [selectedNuid, setSelectedNuid] = useState('all');
  const [nuidSearchText, setNuidSearchText] = useState('');
  const [variantCategories, setVariantCategories] = useState([]);
  const [selectedVariantCategory, setSelectedVariantCategory] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const assistantParam = selectedAssistantName ? `&assistantName=${encodeURIComponent(selectedAssistantName)}` : '';
        const nuidParam = selectedNuid && selectedNuid !== 'all' ? `&nuid=${encodeURIComponent(selectedNuid)}` : '';
        const categoryParam = selectedVariantCategory && selectedVariantCategory !== 'all'
          ? `&variantCategory=${encodeURIComponent(selectedVariantCategory)}`
          : '';
        const response = await fetch(`/api/admin/${teamName}/statistics?flavor=${flavor}&dateRange=${dateRange}${assistantParam}${nuidParam}${categoryParam}`);
        const result = await response.json();
        console.log('Fetched statistics:', result);
        const groupedData = groupStatisticsByVariant(result);
        setData(groupedData);
        setVariants(groupedData.map(group => group.label));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching statistics:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [flavor, dateRange, selectedAssistantName, selectedNuid, selectedVariantCategory, teamName]);

  useEffect(() => {
    async function fetchAssistants() {
      try {
        const response = await getAllAssistants(teamName);
        // exclude these assistant names (response.name)
        // const excluded = new Set([
        //   'bcschatbot',
        //   'document-management-shared-service',
        //   'scheduletopay'
        // ]);
        // const filtered = Array.isArray(response)
        //   ? response.filter(a => !excluded.has(a.name))
        //   : [];
        const sortedAssistants = response.slice().sort((a, b) => a.displayName.localeCompare(b.displayName));
        setAssistants(sortedAssistants);
      } catch (e) {
        setAssistants([]);
        setLocalSelectedAssistant('all');
        setSelectedAssistantName('');
        // } finally {
        //   setAssistantsLoaded(true);
      }
    }
    fetchAssistants();
  }, []);

  // Fetch distinct NUIDs when assistant changes
  useEffect(() => {
    async function fetchNuids() {
      try {
        const assistantParam = selectedAssistantName ? `&assistantName=${encodeURIComponent(selectedAssistantName)}` : '';
        const response = await fetch(`/api/admin/${teamName}/statistics?listNuids=true${assistantParam}`);
        const result = await response.json();
        setNuids(Array.isArray(result) ? result : []);
      } catch (e) {
        setNuids([]);
      }
    }
    fetchNuids();
  }, [selectedAssistantName, teamName]);

  useEffect(() => {
    async function fetchVariantCategories() {
      try {
        const assistantParam = selectedAssistantName ? `&assistantName=${encodeURIComponent(selectedAssistantName)}` : '';
        const nuidParam = selectedNuid && selectedNuid !== 'all' ? `&nuid=${encodeURIComponent(selectedNuid)}` : '';
        const response = await fetch(`/api/admin/${teamName}/statistics?listVariantCategories=true${assistantParam}${nuidParam}`);
        const result = await response.json();
        const normalized = Array.isArray(result)
          ? [...new Set(result.map((value) => value || NO_CATEGORY_VALUE))]
          : [];
        setVariantCategories(normalized);
      } catch (e) {
        setVariantCategories([]);
      }
    }

    fetchVariantCategories();
  }, [selectedAssistantName, selectedNuid, teamName]);

  const filteredNuids = useMemo(() => {
    if (!nuidSearchText.trim()) return nuids;
    const search = nuidSearchText.toLowerCase();
    return nuids.filter(n => n && n.toLowerCase().includes(search));
  }, [nuids, nuidSearchText]);

  const handleNuidChange = useCallback((nuid) => {
    setSelectedNuid(nuid);
    setNuidSearchText('');
  }, []);

  const groupStatisticsByVariant = (statistics) => {
    const grouped = statistics.reduce((acc, stat) => {
      const { variant, weekStart } = stat._id;
      const variantCategory = stat?._id?.variantCategory || NO_CATEGORY_VALUE;
      if (!variant) {
        console.error('Undefined variant in stat:', stat);
        return acc;
      }
      const variantKey = `${variantCategory}::${variant}`;
      if (!acc[variantKey]) {
        acc[variantKey] = {
          variant,
          variantCategory,
          weeks: {}
        };
      }
      if (!acc[variantKey].weeks[weekStart]) {
        acc[variantKey].weeks[weekStart] = 0;
      }
      acc[variantKey].weeks[weekStart] += stat.count;
      return acc;
    }, {});

    return Object.values(grouped).map((entry) => ({
      label: `${getCategoryLabel(entry.variantCategory)} | ${entry.variant}`,
      variant: entry.variant,
      variantCategory: entry.variantCategory,
      data: Object.keys(entry.weeks).map((date) => ({
        primary: date,
        secondary: entry.weeks[date],
      })),
    }));
  };

  const handleVariantChange = (variant) => {
    setSelectedVariants((prevSelected) =>
      prevSelected.includes(variant)
        ? prevSelected.filter((v) => v !== variant)
        : [...prevSelected, variant]
    );
  };

  const formatCamelCase = (str) => {
    return str.replace(/([a-z])([A-Z])/g, '$1 $2');
  };

  // Transform data for MUI x-charts BarChart
  const transformChartData = () => {
    if (filteredData.length === 0) return { xAxis: [], series: [] };

    // Get all unique dates across all variants
    const allDates = Array.from(
      new Set(filteredData.flatMap(variant => variant.data.map(d => d.primary)))
    ).sort();

    // Create series for each variant
    const series = filteredData.map(variant => ({
      label: variant.label,
      data: allDates.map(date => {
        const dataPoint = variant.data.find(d => d.primary === date);
        return dataPoint ? dataPoint.secondary : 0;
      }),
    }));

    return {
      xAxis: allDates,
      series: series,
    };
  };

  const handleAssistantChange = (assistantId) => {
    setLocalSelectedAssistant(assistantId);
    const assistantObj = assistants.find(a => a.id === assistantId);
    const assistantName = assistantObj?.name || '';
    setSelectedAssistantName(assistantName);

  };


  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%" width="100%">
        <CircularProgress />
      </Box>
    );
  }

  const filteredData = data.filter((d) => selectedVariants.includes(d.label));

  return (
    <Box display="flex" flexDirection="row" spacing={2} height="100%" width="100%">
      <Box display="flex" flexDirection="column" flex={1} padding={2}>
        <Box marginBottom={2}>
          <FormGroup>
            <FormControlLabel
              control={<Switch checked={flavor === 'unique-nuids'} onChange={() => setFlavor(flavor === 'unique-nuids' ? 'total' : 'unique-nuids')} />}
              label="Unique NUIDs"
            />
          </FormGroup>
        </Box>
        <Box marginBottom={2}>
          <FormControl variant='outlined' sx={{ minWidth: 300 }}>
            <InputLabel sx={{ fontSize: '1rem', fontWeight: 'bold', textAlign: 'center', justifyContent: 'center' }}>Variant Category</InputLabel>
            <Select
              value={selectedVariantCategory}
              onChange={(e) => setSelectedVariantCategory(e.target.value)}
              label="Variant Category"
              fullWidth
            >
              <MenuItem value="all">All Categories</MenuItem>
              {variantCategories.map((category) => (
                <MenuItem key={category} value={category}>
                  {getCategoryLabel(category)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box marginBottom={2}>
          <FormControl variant='outlined' sx={{ minWidth: 300 }}>
            <InputLabel sx={{ fontSize: '1rem', fontWeight: 'bold', textAlign: 'center', justifyContent: 'center' }}>Date Range</InputLabel>
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              label="Date Range"
              fullWidth
            >
              <MenuItem value="This month">This month</MenuItem>
              <MenuItem value="Last 2 months">Last 2 months</MenuItem>
              <MenuItem value="Last 3 months">Last 3 months</MenuItem>
              <MenuItem value="This year">This year</MenuItem>
              <MenuItem value="All">All Time</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box marginBottom={2} display="flex" alignItems="center">
          <FormControl variant="outlined" sx={{ minWidth: 300 }}>
            <InputLabel sx={{ fontSize: '1rem', fontWeight: 'bold', textAlign: 'center', justifyContent: 'center' }}>Select Assistant</InputLabel>
            <Select
              value={localSelectedAssistant || ''}
              onChange={(e) => handleAssistantChange(e.target.value)}
              label="Select Assistant"
              fullWidth
            >
              <MenuItem key={'all'} value={'all'}>All Assistants</MenuItem>
              {assistants.map((assistant) => (
                <MenuItem key={assistant._id} value={assistant.id}>
                  {assistant.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip
            title='Selecting "All Assistants" includes historical data from before assistant tracking was implemented. Results may appear higher than expected.'
            placement="right"
            color='primary'
          >
            <InfoOutlinedIcon sx={{ ml: 1, mt: 0.5, cursor: 'pointer', alignSelf: 'flex-start' }} />
          </Tooltip>
        </Box>
        <Box marginBottom={2}>
          <FormControl variant="outlined" sx={{ minWidth: 300 }}>
            <InputLabel sx={{ fontSize: '1rem', fontWeight: 'bold', textAlign: 'center', justifyContent: 'center' }}>Select NUID</InputLabel>
            <Select
              value={selectedNuid}
              onChange={(e) => handleNuidChange(e.target.value)}
              label="Select NUID"
              fullWidth
              renderValue={(value) => value === 'all' ? 'All NUIDs' : value}
              MenuProps={{
                PaperProps: {
                  sx: { maxHeight: NUID_LIST_MAX_HEIGHT + 60 }
                },
                autoFocus: false
              }}
              onOpen={() => setNuidSearchText('')}
            >
              <MenuItem
                key="nuid-search"
                disableRipple
                onKeyDown={(e) => e.stopPropagation()}
                sx={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'background.paper' }}
              >
                <TextField
                  size="small"
                  placeholder="Search NUIDs..."
                  value={nuidSearchText}
                  onChange={(e) => setNuidSearchText(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  fullWidth
                  autoFocus
                />
              </MenuItem>
              <MenuItem key="all-nuids" value="all">All NUIDs</MenuItem>
              {filteredNuids.length > 20 ? (
                <Box>
                  <WindowList
                    rowCount={filteredNuids.length}
                    rowHeight={NUID_ITEM_HEIGHT}
                    overscanCount={10}
                    rowProps={{ data: filteredNuids }}
                    rowComponent={({ index, style, data }) => {
                      const nuid = data[index];
                      return (
                        <MenuItem
                          key={nuid}
                          value={nuid}
                          style={style}
                          onClick={() => handleNuidChange(nuid)}
                          selected={nuid === selectedNuid}
                        >
                          {nuid}
                        </MenuItem>
                      );
                    }}
                  />
                </Box>
              ) : (
                filteredNuids.map((nuid) => (
                  <MenuItem key={nuid} value={nuid}>{nuid}</MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </Box>
        <Box>
          <FormGroup>
            {variants.map((variant) => (
              <FormControlLabel
                key={variant}
                control={<Checkbox checked={selectedVariants.includes(variant)} onChange={() => handleVariantChange(variant)} />}
                label={formatCamelCase(variant)}
              />
            ))}
          </FormGroup>
        </Box>
      </Box>
      <Box flex={3} padding={0} height={400} width={'100%'}>
        {filteredData.length > 0 ? (
          <BarChart
            xAxis={[{ scaleType: 'band', data: transformChartData().xAxis }]}
            series={transformChartData().series}
            width={1000}
            height={500}
            slotProps={{
              legend: {
                position: {
                  vertical: 'top',
                  horizontal: 'right',
                },
              },
            }}
            margin={{ top: 10, right: 150, bottom: 80, left: 60 }}
          />
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <Typography variant="h6">Please select statistic category checkboxes to display chart.</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default StatisticsChart;