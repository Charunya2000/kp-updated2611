'use client';
import React from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  DeleteOutline as DeleteOutlineIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

export const ACTION_ICON_STYLES = {
  delete: {
    color: '#d32f2f',
    // '&:hover': {
    //   backgroundColor: 'rgba(211, 47, 47, 0.25)',
    //   color: '#e21717ff',
    //   boxShadow: '0 0 8px 2px rgba(211, 47, 47, 0.25)',
    // }
  },
  edit: {
    color: '#FFA500',
    // '&:hover': {
    //   backgroundColor: 'rgba(255, 165, 0, 0.25)',
    //   color: '#FF8C00',
    //   boxShadow: '0 0 8px 2px rgba(255, 165, 0, 0.25)',
    // }
  },
  enabled: (theme) => ({
    // color: theme.palette.color.contrastBlue,
    // '&.Mui-checked': {
    //   color: theme.palette.color.contrastBlue,
    // },
    // '&:hover': {
    //   backgroundColor: `rgba(0, 116, 173, 0.25)`,
    //   boxShadow: '0 0 8px 2px rgba(0, 116, 173, 0.25)',
    // },
    // padding: '8px',
    // '& .MuiSvgIcon-root': {
    //   fontSize: '1.6rem',
    // }
  })
};

const TableWithActions = ({
  title = "Items",
  data = [],
  loading = false,
  columns = [],
  onAdd,
  onEdit,
  onDelete,
  onToggleEnabled,
  orderBy,
  order,
  onSort,
  emptyMessage = "No items found",
  addButtonText = "New Item",
  extraHeaderButton
}) => {
  const theme = useTheme();

  const sortedData = React.useMemo(() => {
    return [...data].sort((a, b) => {
      if (!orderBy) return 0;

      let aValue = a[orderBy];
      let bValue = b[orderBy];

      // If the value is an array, join for sorting
      if (Array.isArray(aValue)) aValue = aValue.join(', ');
      if (Array.isArray(bValue)) bValue = bValue.join(', ');

      aValue = aValue || '';
      bValue = bValue || '';

      // To handle numeric sorting
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return order === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // To handle string sorting
      return order === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });
  }, [data, order, orderBy]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress sx={{ color: theme.palette.color.contrastBlue }} />
      </Box>
    );
  }

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      pt: 2
    }}>
      {/* Add New Button and optional Extra Button, extraHeaderButton is right-end-aligned */}
      <Box
        display="flex"
        alignItems="center"
        mb={3}
        sx={{ flexShrink: 0 }}
      >
        <Button
          variant="contained"
          startIcon={<AddIcon sx={{ fontSize: '1.2rem' }} />}
          onClick={onAdd}
          sx={{
            fontWeight: 'bold',
            fontSize: '1rem',
            py: 1.2,
            px: 3,
            backgroundColor: theme.palette.color.contrastBlue,
            color: 'white',
            borderRadius: '25px',
            textTransform: 'none',
            '&:hover': {
              backgroundColor: theme.palette.color.midnight,
            }
          }}
        >
          {data.length === 0 ? `Create First ${title}` : addButtonText}
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        {extraHeaderButton && (
          <Box>
            {extraHeaderButton}
          </Box>
        )}
      </Box>

      {/* Table */}
      <Box sx={{
        flexGrow: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <TableContainer sx={{
          flexGrow: 1,
          overflow: 'auto',
          maxHeight: 'calc(100vh - 300px)',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#f1f1f1',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: theme.palette.color.graphiteDeep,
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: theme.palette.color.slate,
            },
          },
        }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    sx={{
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      position: 'sticky',
                      top: 0,
                      zIndex: 100,
                      textAlign: column.align || 'left',
                      width: column.width
                    }}
                  >
                    {column.sortable ? (
                      <TableSortLabel
                        active={orderBy === column.key}
                        onClick={() => onSort(column.key)}
                        hideSortIcon={false}
                        IconComponent={orderBy === column.key ?
                          (order === 'asc' ? KeyboardArrowUpIcon : KeyboardArrowDownIcon) :
                          KeyboardArrowUpIcon
                        }
                        sx={{
                          fontWeight: 'bold',
                          fontSize: '1.1rem',
                          '& .MuiTableSortLabel-icon': {
                            opacity: 1,
                            marginLeft: '8px',
                          },
                        }}
                      >
                        {column.label}
                      </TableSortLabel>
                    ) : (
                      column.label
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom sx={{ fontSize: '1.3rem', color: theme.palette.color.dolphin }}>
                      {emptyMessage}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((item, index) => (
                  <TableRow
                    key={item.id || index}
                    sx={{
                      // Stripe every other row with more specific targeting - matching PersonasManagement
                      '&:nth-of-type(even)': {
                        backgroundColor: theme.palette.mode === 'dark'
                          ? 'transparent' // Dark blue stripe for dark mode
                          : 'rgba(0, 0, 0, 0.08)', // Light gray stripe for light mode
                      },
                      '&:nth-of-type(odd)': {
                        backgroundColor: theme.palette.mode === 'dark'
                          ? '#0D1C3D'
                          : '#F7F7F7',
                      },
                      '&:hover': {
                        backgroundColor: theme.palette.mode === 'dark'
                          ? '#0056b3' // Bright blue hover for dark mode
                          : 'rgba(0, 0, 0, 0.20)', // Darker hover for light mode
                      },
                      // Override Material-UI table cell backgrounds
                      '& td': {
                        borderBottom: index === sortedData.length - 1 ? 'none' : undefined,
                        backgroundColor: 'inherit',
                      },
                      transition: 'background-color 0.2s ease-in-out', // Smooth transitions when hover to next
                    }}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        sx={{
                          width: column.width,
                          textAlign: column.align || 'left',
                          cursor: column.tooltip ? 'help' : undefined
                        }}
                      >
                        {column.render ? column.render(item, index) : item[column.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default TableWithActions;