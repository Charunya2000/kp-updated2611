'use client'

import { Box, useTheme, useMediaQuery } from "@mui/material";
import DashboardBox from "./components/DashboardBox";

const TeamDashboard = () => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('lg'));
  const isLg = useMediaQuery(theme.breakpoints.between('lg', 'xl'));
  const isXl = useMediaQuery(theme.breakpoints.up('xl'));

  // Determine grid columns and item spans based on breakpoint
  const getGridConfig = () => {
    if (isXs) {
      return {
        columns: 4,
        assistants: 4,
        statistics: 4,
        costCenter: 4,
        members: 4,
        indexes: 4,
        graphs: 4,
        workflows: 4,
        rows: 'auto'
      };
    } else if (isLg) {
      return {
        columns: 12,
        assistants: 4,
        statistics: 8,
        costCenter: 4,
        members: 4,
        indexes: 4,
        graphs: 4,
        workflows: 4,
        rows: 'repeat(2, 1fr)'
      };
    } else {
      return {
        columns: 16,
        assistants: 4,
        statistics: 8,
        costCenter: 4,
        members: 4,
        indexes: 4,
        graphs: 4,
        workflows: 4,
        rows: 'repeat(2, 1fr)'
      };
    }
  };

  const gridConfig = getGridConfig();

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridConfig.columns}, 1fr)`,
          gridTemplateRows: gridConfig.rows,
          gap: '16px',
          maxWidth: '2048px',
          width: '100%',
          height: '100%'
        }}
      >
        {/* First Row */}
        <div style={{ gridColumn: `span ${gridConfig.assistants}` }}>
          <DashboardBox title="Assistants" />
        </div>
        <div style={{ gridColumn: `span ${gridConfig.statistics}` }}>
          <DashboardBox title="Statistics" />
        </div>
        <div style={{ gridColumn: `span ${gridConfig.costCenter}` }}>
          <DashboardBox title="Cost Center" />
        </div>

        {/* Second Row */}
        <div style={{ gridColumn: `span ${gridConfig.members}` }}>
          <DashboardBox title="Members" />
        </div>
        <div style={{ gridColumn: `span ${gridConfig.indexes}` }}>
          <DashboardBox title="Indexes" />
        </div>
        <div style={{ gridColumn: `span ${gridConfig.graphs}` }}>
          <DashboardBox title="Graphs" />
        </div>
        <div style={{ gridColumn: `span ${gridConfig.workflows}` }}>
          <DashboardBox title="Workflows" />
        </div>
      </div>
    </Box>
  );
}

export default TeamDashboard;