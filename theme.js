'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createTheme } from '@mui/material/styles';

// Theme Mode Context
const ThemeModeContext = createContext();

export const useThemeMode = () => {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }
  return context;
};

export const ThemeModeProvider = ({ children }) => {
  const [mode, setMode] = useState('light');

  useEffect(() => {
    // Check if user has a saved preference
    const savedMode = localStorage.getItem('themeMode');
    if (savedMode) {
      setMode(savedMode);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(prefersDark ? 'dark' : 'light');
    }
  }, []);

  const toggleMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    localStorage.setItem('themeMode', newMode);
  };

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode }}>
      {children}
    </ThemeModeContext.Provider>
  );
};

// Default theme configuration (mode-independent)
const defaultTheme = {
  typography: {
    fontFamily: 'var(--font-roboto)',
    h1: {
      fontSize: 48,
      fontWeight: 400,
      lineHeight: 1.25,
    },
    h2: {
      fontSize: 40,
      lineHeight: 1.2,
    },
    h3: {
      fontSize: 32,
      lineHeight: 1.15,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontSize: 26,
    },
    h5: {
      fontSize: 22,
      lineHeight: 1.4,
      letterSpacing: '0.01em',
    },
    h6: {
      fontSize: 20,
      lineHeight: 1.5,
      letterSpacing: '0.01em',
    },
  },
};

// Light theme color configuration
const lightTheme = {
  palette: {
    mode: 'light',
    color: {
      inky: '#0D1C3D',
      midnight: '#003B71',
      dolphin: '#677083',
      contrastBlue: '#0074AD',
      kpBlue: '#0078B3',
      slate: '#878F9B',
      dolphinMid: '#A0A5B6',
      dolphinLight: '#B3B6C5',
      sky: '#90CEF1',
      graphiteDeep: '#D3D6DC',
      graphite: '#E9EBEE',
      blue10: '#E6F2F7',
      graphiteLight: '#F4F5F6',
      paleBlue: '#F0F7FA',
      blue5: '#F2F8FB',
      pebble: '#F7F7F7',
      blueExtraDark: '#002343',
      lightBlue: '#e6f0fb',
      lightBlueDarker: '#d4e7fa'
    },
    background: {
      default: '#F7F7F7',
      paper: '#FCFCFC',
      dialog: '#f8f8f8',
      subtle: '#9fc0db1a',
      drawer: "#FCFCFC"
    },
    transparency: {
      "90": 'rgba(0, 0, 0, 0.9)',
      "80": 'rgba(0, 0, 0, 0.8)',
      "70": 'rgba(0, 0, 0, 0.7)',
      "60": 'rgba(0, 0, 0, 0.6)',
      "50": 'rgba(0, 0, 0, 0.5)',
      "40": 'rgba(0, 0, 0, 0.4)',
      "30": 'rgba(0, 0, 0, 0.3)',
      "20": 'rgba(0, 0, 0, 0.2)',
      "10": 'rgba(0, 0, 0, 0.1)',
      "05": 'rgba(0, 0, 0, 0.05)',
    },
    primary: {
      main: '#0078B3', // Using kpBlue
      light: '#0072f5',
      dark: '#003B71'
    },
    secondary: {
      main: '#8B4FE2',
      light: '#a778ed',
      dark: '#573091'
    },
    error: {
      main: '#D00000',
      dark: '#B63125',
      light: '#F89D9D'
    },
    success: {
      main: '#33A437',
      dark: '#4A7628',
      light: '#A4D751'
    },
    text: {
      primary: '#000000',
      reverse: '#ffffff',
      heading: '#003B71',
      muted: '#6e6e6e'
    },
    link: {
      main: '#0078B3', // Primary link color
      hover: '#003B71', // Link hover color
      visited: '#677083', // Visited link color
      active: '#0074AD', // Active/pressed link color
    },
    listitem: {
      selected: {
        background: '#4169E1',
        text: 'white',
      },
      hover: {
        background: '#0078B3',
        text: '#F7F7F7',
      },
      active: {
        background: '#0074AD',
        text: '#F7F7F7',
      },
      default: {
        background: 'white',
        text: 'black',
      },
      header: '#e6f0fb'
    },
    table: {
      head: {
        background: '#E6F2F7',
        text: '#0D1C3D',
      },
      row: {
        background: '#F7F7F7',
        oddBackground: '#F2F8FB',
        text: '#0D1C3D',
        hover: {
          background: '#F0F7FA',
        },
        selected: {
          background: '#F2F8FB',
        }
      }
    },
    card: {
      body: {
        main: '#e6f0fb',
        dark: '#d4e7fa',
        deep: '#ffffff',
      },
      border: {
        main: '#747f8a',
        dark: '#4d545a',
        deep: '#000028',
      }
    },
    toggleBtn: {
      border: {
        main: '#bdbdbd',
        hover: '#a0a5b6',
        selected: '#677083'
      },
      background: {
        main: '#ffffff',
        hover: '#d4e7fa',
        selected: '#e6f0fb'
      }
    },
    shadow: {
      light: '#ffffff1a',
      medium: '#ffffff33',
      dark: '#ffffff4d',
    },
    gradient: {
      ltr: 'linear-gradient(to right, #ffffffff, transparent)',
      rtl: 'linear-gradient(to left, #ffffffff, transparent)',
    },
    prompt: {
      request: {
        background: '#e6f0fb',
        text: '#0D1C3D',
      },
      response: {
        background: '#f2f2f2',
        text: '#0D1C3D',
      }
    },
    form: {
      background: '#FAFAFA'
    },
  },
};

// Dark theme color configuration
const darkTheme = {
  palette: {
    mode: 'dark',
    color: {
      inky: '#0D1C3D',
      midnight: '#003B71',
      dolphin: '#677083',
      contrastBlue: '#0074AD',
      kpBlue: '#0078B3',
      slate: '#878F9B',
      dolphinMid: '#A0A5B6',
      dolphinLight: '#B3B6C5',
      sky: '#90CEF1',
      graphiteDeep: '#D3D6DC',
      graphite: '#E9EBEE',
      blue10: '#E6F2F7',
      graphiteLight: '#F4F5F6',
      paleBlue: '#F0F7FA',
      blue5: '#F2F8FB',
      pebble: '#F7F7F7',
      blueExtraDark: '#002343',
      lightBlue: '#e6f0fb',
      lightBlueDarker: '#d4e7fa'
    },
    background: {
      default: '#000028',
      paper: '#000a1c',
      dialog: '#03111e',
      subtle: '#1976d20a',
      drawer: "#0D1C3D"
    },
    transparency: {
      "90": 'rgba(255, 255, 255, 0.9)',
      "80": 'rgba(255, 255, 255, 0.8)',
      "70": 'rgba(255, 255, 255, 0.7)',
      "60": 'rgba(255, 255, 255, 0.6)',
      "50": 'rgba(255, 255, 255, 0.5)',
      "40": 'rgba(255, 255, 255, 0.4)',
      "30": 'rgba(255, 255, 255, 0.3)',
      "20": 'rgba(255, 255, 255, 0.2)',
      "10": 'rgba(255, 255, 255, 0.1)',
      "05": 'rgba(255, 255, 255, 0.05)',
    },
    primary: {
      main: '#84d2f9',
      light: '#55c6ff',
      dark: '#04689b'
    },
    secondary: {
      main: '#00ffb7',
      light: '#aefde8',
      dark: '#00c08d'
    },
    error: {
      main: '#D00000',
      dark: '#B63125',
      light: '#F89D9D'
    },
    success: {
      main: '#33A437',
      dark: '#4A7628',
      light: '#A4D751'
    },
    text: {
      primary: '#fcfcfc',
      reverse: '#000000',
      heading: '#F2F8FB',
      muted: '#9e9e9e'
    },
    link: {
      main: '#90CEF1',
      hover: '#0078B3',
      visited: '#B3B6C5',
      active: '#0074AD',
    },
    listitem: {
      selected: {
        background: '#F2F8FB',
        text: '#0D1C3D',
      },
      hover: {
        background: '#0078B3',
        text: '#F7F7F7',
      },
      active: {
        background: '#0074AD',
        text: '#F7F7F7',
      },
      default: {
        background: '#0b3e70',
        text: '#F7F7F7',
      },
      header: '#002343',
    },
    table: {
      head: {
        background: '#0D1C3D',
        text: '#F7F7F7',
      },
      row: {
        background: '#0D1C3D',
        oddBackground: '#0A162D',
        text: '#F7F7F7',
        hover: {
          background: '#02234b',
        },
        selected: {
          background: '#032c5d',
        }
      }
    },
    card: {
      body: {
        main: '#003b71',
        dark: '#00315f',
        deep: '#001121'
      },
      border: {
        main: '#e6f0fb',
        dark: '#d4e7fa',
        deep: '#ffffff',
      }
    },
    toggleBtn: {
      border: {
        main: '#bdbdbd',
        hover: '#a0a5b6',
        selected: '#677083'
      },
      background: {
        main: '#ffffff',
        hover: '#d4e7fa',
        selected: '#e6f0fb'
      }
    },
    shadow: {
      light: '#0000001a',
      medium: '#00000033',
      dark: '#0000004d',
    },
    gradient: {
      ltr: 'linear-gradient(to right, #0000021a, transparent)',
      rtl: 'linear-gradient(to left, #0000029c, transparent)',
    },
    prompt: {
      request: {
        background: '#0074AD',
        text: '#FFFFFF',
      },
      response: {
        background: '#1a1a1a',
        text: '#FFFFFF',
      }
    },
    grey: {
      50: '#212121',
      100: '#424242',
      200: '#616161',
      300: '#757575',
      400: '#9e9e9e',
      500: '#bdbdbd',
      600: '#e0e0e0',
      700: '#eeeeee',
      800: '#f5f5f5',
      900: '#fafafa',
    },
    form: {
      background: 'rgba(255,255,255,0.05)' // dark-mode subtle lift
    }
  },
};

const sharedComponentTheme = {
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        html: {
          height: '100%',
        },
        body: {
          margin: 0,
          padding: 0,
          boxSizing: 'border-box',
          fontFamily: 'var(--font-roboto)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
        '#__next': {
          height: '100%',
        },
        '*': {
          margin: 0,
          padding: 0,
          boxSizing: 'inherit',
        },
        'pre': {
          border: '1px solid',
          borderRadius: '4px',
          padding: '12px',
          fontFamily: '"Courier New", monospace',
          fontSize: '14px',
          overflowX: 'auto',
        },
        'pre code': {
          backgroundColor: 'transparent',
          fontFamily: 'inherit',
        }
      }),
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '28px',
          textTransform: 'none',
          textAlign: 'center',
          fontSize: '16px',
          fontStyle: 'normal',
          fontWeight: '500',
          lineHeight: '24px',
          flexShrink: 0,
        },
        sizeSmall: {
          minWidth: '120px',
          height: '32px',
          fontSize: '14px',
          lineHeight: '20px',
        },
        sizeMedium: {
          minWidth: '180px',
          height: '40px',
          fontSize: '16px',
          lineHeight: '24px',
        },
        sizeLarge: {
          minWidth: '220px',
          height: '56px',
          fontSize: '18px',
          lineHeight: '28px',
        },
        startIcon: {
          '& > *:first-of-type': {
            fontSize: '24px'
          }
        },
        '&.MuiButton-sizeSmall .MuiButton-startIcon > *:first-of-type': {
          fontSize: '20px'
        },
        '&.MuiButton-sizeMedium .MuiButton-startIcon > *:first-of-type': {
          fontSize: '24px'
        },
        '&.MuiButton-sizeLarge .MuiButton-startIcon > *:first-of-type': {
          fontSize: '28px'
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '50%',
        }
      }
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          '& .MuiSvgIcon-root': {
            fontSize: '1.5rem',
            borderRadius: '4px',
          },
        }
      }
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          paddingY: 0.5,
          borderRadius: '28px',
          textTransform: 'none',
          fontSize: '13pt',
          fontWeight: 'fontWeightRegular',
          marginRight: 0.5,
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          fontSize: '1rem',
          '&.listDetail': {
            borderRadius: '12px',
            BorderAllRounded: 'true',
            textTransform: 'none',
            fontSize: '13pt',
            fontWeight: '300'
          }
        }
      }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: 'inherit',
          '&.listDetail': {
            borderRadius: '1px',
            BorderAllRounded: 'true',
            textTransform: 'none',
            fontSize: '13pt',
            fontWeight: '300'
          }
        }
      }
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          fontSize: 'inherit',
          '&.listDetail': {
            borderRadius: '18px',
            textTransform: 'none',
            fontSize: '18pt',
            fontWeight: '300',
            '&:hover': {
              borderRadius: '18px',
            }
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '28px',
          textTransform: 'none',
          fontSize: '13pt',
          fontWeight: '300'
        }
      }
    },
    MuiPopper: {
      styleOverrides: {
        root: {
          zIndex: 1300,
        }
      }
    },
    MuiLink: {
      styleOverrides: {
        root: {
          textDecoration: 'none',
          transition: 'color 0.1s ease-in-out',
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
        }
      }
    },
    MuiPickersTextField: {
      styleOverrides: {
        root: {
          margin: 0
        }
      }
    },
    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiAlert-root': {
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
          }
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 500,
        }
      }
    },
  }
};

const lightComponentTheme = {
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '.react-flow__edge-path': {
          stroke: '#003B71',
        },
        '.react-flow__edge.selected .react-flow__edge-path, .react-flow__edge.selectable:focus .react-flow__edge-path': {
          stroke: '#0078B3',
        },
        '.react-flow__connectionline': {
          stroke: '#049b36',
          strokeWidth: '1',
        },
        'a, a:link, a:any-link': {
          color: '#0078B3',
          textDecoration: 'none !important',
          transition: 'color 0.2s ease-in-out',
          '&:hover': {
            color: '#003B71',
          },
          '&:visited': {
            color: '#677083',
          },
          '&:hover:visited': {
            color: '#003B71',
          },
          '&:active': {
            color: '#0074AD',
          },
          '&:hover:active': {
            color: '#0074AD',
          },
        },
        // Ensure links in Material-UI components get themed
        '.MuiTypography-root a, .MuiListItemText-root a, .MuiPaper-root a': {
          color: '#0078B3',
          textDecoration: 'none',
          transition: 'color 0.2s ease-in-out',
          '&:hover': {
            color: '#003B71',
          },
          '&:visited': {
            color: '#677083',
          },
          '&:hover:visited': {
            color: '#003B71',
          },
          '&:active': {
            color: '#0074AD',
          },
          '&:hover:active': {
            color: '#0074AD',
          },
        },
        // Specific targeting for Next.js Link components
        '[data-nextjs-link] a, [href] a': {
          color: '#0078B3',
          textDecoration: 'none',
          transition: 'color 0.2s ease-in-out',
          '&:hover': {
            color: '#003B71',
          },
          '&:visited': {
            color: '#677083',
          },
          '&:hover:visited': {
            color: '#003B71',
          },
          '&:active': {
            color: '#0074AD',
          },
          '&:hover:active': {
            color: '#0074AD',
          },
        },
        'pre': {
          backgroundColor: '#ffffff !important',
          borderColor: '#dddddd !important',
          color: '#000000 !important',
        },
        '.word-wrap pre': {
          backgroundColor: '#ffffff !important',
          borderColor: '#dddddd !important',
          color: '#000000 !important',
        }
      }
    },
    MuiButton: {
      variants: [
        {
          props: { variant: 'action' },
          style: {
            color: '#0074AD',
            border: '1px solid #0074AD',
            backgroundColor: '#F2F8FB',
            '&:hover': {
              color: '#003B71',
              backgroundColor: '#F2F8FB',
              border: '1px solid #003B71',
            },
            '&.Mui-disabled': {
              backgroundColor: '#E9EBEE',
              color: '#A0A5B6',
              border: '1px solid #A0A5B6',
            },
          },
        },
      ],
      styleOverrides: {
        destructive: {
          color: '#FFF',
          backgroundColor: '#D00000',
          '&:hover': {
            backgroundColor: '#B63125',
            border: 'none',
          },
          '&.Mui-disabled': {
            backgroundColor: '#E9EBEE',
            border: '1px solid #A0A5B6',
          },
        },
        positive: {
          color: '#FFF',
          backgroundColor: '#33A437',
          '&:hover': {
            backgroundColor: '#4A7628',
            border: 'none',
          },
          '&.Mui-disabled': {
            backgroundColor: '#E9EBEE',
            border: '1px solid #A0A5B6',
          },
        },
        primary: {
          color: '#FFF',
          backgroundColor: '#0074AD',
          '&:hover': {
            backgroundColor: '#003B71',
            border: 'none',
          },
          '&.Mui-disabled': {
            color: '#E9EBEE',
            backgroundColor: '#A0A5B6',
          },
        },
        secondary: {
          color: '#0074AD',
          border: '1px solid #0074AD',
          backgroundColor: '#FFFFFF',
          '&:hover': {
            color: '#FFF',
            backgroundColor: '#003B71',
            border: '1px solid #003B71',
          },
          '&.Mui-disabled': {
            backgroundColor: '#E9EBEE',
            border: '1px solid #A0A5B6',
          },
        },
        action: {
          color: '#0074AD',
          border: '1px solid #0074AD',
          backgroundColor: '#F2F8FB',
          '&:hover': {
            color: '#003B71',
            backgroundColor: '#F2F8FB',
            border: '1px solid #003B71',
          },
          '&.Mui-disabled': {
            backgroundColor: '#E9EBEE',
            color: '#A0A5B6',
            border: '1px solid #A0A5B6',
          },
        },
        text: {
          '&.Mui-disabled, &.Mui-disabled a': {
            color: '#A0A5B6',
          },
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#0074AD',
          '&.MuiIconButton-colorError': {
            color: '#D00000',
            '&.Mui-disabled': {
              color: '#A0A5B6',
            },
          },
        }
      }
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: '#0078B3',
          '&.Mui-checked': {
            color: '#0078B3',
          },
          '&.Mui-disabled .MuiSvgIcon-root': {
            color: '#A0A5B6',
          },
          '&.Mui-disabled.Mui-checked .MuiSvgIcon-root': {
            backgroundColor: '#A0A5B6',
            color: '#D3D6DC',
          },
        }
      }
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderColor: '#bdbdbd',
          color: '#0D1C3D',
          '&.Mui-selected': {
            backgroundColor: '#e6f0fb',
            borderColor: '#d4e7fa',
          },
          '&:hover': {
            backgroundColor: '#d4e7fa',
            borderColor: '#878F9B',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          '&.MuiOutlinedInput-root': {
            backgroundColor: '#FFFFFF',
            '& fieldset': {
              borderColor: '#878F9B', // slate color
            },
          },
          '&.listDetail': {
            color: '#0D1C3D',
          }
        }
      }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '&.listDetail': {
            color: 'black',
          }
        }
      }
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          '&.listDetail': {
            color: 'black',
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          color: 'black',
          backgroundColor: '#f4f4f4',
        }
      }
    },
    MuiPopper: {
      styleOverrides: {
        root: {
          '&.MuiPopper-root': {
            '& .MuiTooltip-tooltip': {
              backgroundColor: '#E9EBEE',
              color: '#000000',
              border: '1px solid #677083',
            }

          }
        }
      }
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: '#0078B3',
          '&:hover': {
            color: '#003B71',
          },
          '&:visited': {
            color: '#677083',
          },
          '&:active': {
            color: '#0074AD',
          },
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#FFFFFF',
            '& fieldset': {
              borderColor: '#878F9B', // slate color
            },
            '&:hover fieldset': {
              borderColor: '#000000',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#0078B3',
            },
            '&.Mui-disabled': {
              backgroundColor: '#F4F5F6'
            }
          },
        }
      }
    },
    MuiPickersInputBase: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          color: '#0D1C3D',
          '& fieldset': {
            borderColor: '#878F9B',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#000000',
          },
          '&.Mui-disabled': {
            backgroundColor: '#F4F5F6'
          }
        }
      }
    },
    MuiPickerDay: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            color: '#FFFFFF',
          }
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          // Light mode: active tabs are white, inactive are inky
          '&.Mui-selected': {
            color: '#fff !important',
          },
          '&:not(.Mui-selected)': {
            color: '#0D1C3D !important', // inky color for inactive tabs
          },
        }
      }
    },
  }
};

const darkComponentTheme = {
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '.react-flow__edge-path': {
          stroke: '#04689b',
        },
        '.react-flow__edge.selected .react-flow__edge-path, .react-flow__edge.selectable:focus .react-flow__edge-path': {
          stroke: '#84d2f9',
        },
        '.react-flow__connectionline': {
          stroke: '#049b36',
          strokeWidth: '1',
        },
        'a, a:link, a:any-link': {
          color: '#90CEF1',
          textDecoration: 'none !important',
          transition: 'color 0.2s ease-in-out',
          '&:hover': {
            color: '#0078B3',
          },
          '&:visited': {
            color: '#a3c6d9',
          },
          '&:hover:visited': {
            color: '#0078B3',
          },
          '&:active': {
            color: '#0074AD',
          },
          '&:hover:active': {
            color: '#0074AD',
          },
        },
        // Ensure links in Material-UI components get themed
        '.MuiTypography-root a, .MuiListItemText-root a, .MuiPaper-root a': {
          color: '#90CEF1',
          textDecoration: 'none',
          transition: 'color 0.2s ease-in-out',
          '&:hover': {
            color: '#0078B3',
          },
          '&:visited': {
            color: '#a3c6d7',
          },
          '&:hover:visited': {
            color: '#0078B3',
          },
          '&:active': {
            color: '#0074AD',
          },
          '&:hover:active': {
            color: '#0074AD',
          },
        },
        // Specific targeting for Next.js Link components
        '[data-nextjs-link] a, [href] a': {
          color: '#90CEF1',
          textDecoration: 'none',
          transition: 'color 0.2s ease-in-out',
          '&:hover': {
            color: '#0078B3',
          },
          '&:visited': {
            color: '#a3c6d8',
          },
          '&:hover:visited': {
            color: '#0078B3',
          },
          '&:active': {
            color: '#0074AD',
          },
          '&:hover:active': {
            color: '#0074AD',
          },
        },
        'pre': {
          backgroundColor: '#383f45 !important',
          borderColor: '#677083 !important',
          color: '#F7F7F7 !important',
        },
        '.word-wrap pre': {
          backgroundColor: '#383f45 !important',
          borderColor: '#677083 !important',
          color: '#F7F7F7 !important',
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        contained: {
          '&.Mui-disabled': {
            color: '#E9EBEE',
            backgroundColor: '#A0A5B6',
          },
        },
        destructive: {
          color: '#F7F7F7',
          backgroundColor: '#D00000',
          '&:hover': {
            backgroundColor: '#B63125',
            border: 'none',
          },
          '&.Mui-disabled': {
            backgroundColor: '#677083',
            border: '1px solid #A0A5B6',
          },
        },
        positive: {
          color: '#F7F7F7',
          backgroundColor: '#33A437',
          '&:hover': {
            backgroundColor: '#4A7628',
            border: 'none',
          },
          '&.Mui-disabled': {
            backgroundColor: '#677083',
            border: '1px solid #A0A5B6',
          },
        },
        primary: {
          color: '#0D1C3D',
          backgroundColor: '#E6F2F7',
          '& .MuiSvgIcon-root': {
            color: '#0D1C3D',
          },
          '&:hover': {
            backgroundColor: '#92CCF0',
            color: '#0D1C3D',
            border: 'none',
            '& .MuiSvgIcon-root': {
              color: '#0D1C3D',
            },
          },
          '&.Mui-disabled': {
            color: '#A0A5B6',
            backgroundColor: '#677083',
            '& .MuiSvgIcon-root': {
              color: '#A0A5B6',
            },
          },
        },
        secondary: {
          color: '#E6F2F7',
          border: '1px solid #E6F2F7',
          backgroundColor: 'transparent',
          '& .MuiSvgIcon-root': {
            color: '#E6F2F7',
          },
          '&:hover': {
            color: '#0D1C3D',
            backgroundColor: '#92CCF0',
            border: '1px solid #92CCF0',
            '& .MuiSvgIcon-root': {
              color: '#0D1C3D',
            },
          },
          '&.Mui-disabled': {
            backgroundColor: '#677083',
            border: '1px solid #A0A5B6',
            color: '#A0A5B6',
            '& .MuiSvgIcon-root': {
              color: '#A0A5B6',
            },
          },
        },
        action: {
          color: '#90CEF1',
          border: '1px solid #90CEF1',
          backgroundColor: '#003B71',
          '& .MuiSvgIcon-root': {
            color: '#90CEF1',
          },
          '&:hover': {
            color: '#0D1C3D',
            backgroundColor: '#90CEF1',
            border: '1px solid #90CEF1',
            '& .MuiSvgIcon-root': {
              color: '#0D1C3D',
            },
          },
          '&.Mui-disabled': {
            backgroundColor: '#677083',
            color: '#A0A5B6',
            border: '1px solid #A0A5B6',
            '& .MuiSvgIcon-root': {
              color: '#A0A5B6',
            },
          },
        },
        text: {
          '&.Mui-disabled, &.Mui-disabled a': {
            color: '#A0A5B6',
          },
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#90CEF1',
          '&.MuiIconButton-colorError': {
            color: '#D00000',
            '&.Mui-disabled': {
              color: '#A0A5B6',
            },
          },
        }
      }
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: '#90CEF1',
          '&.Mui-checked': {
            color: '#90CEF1',
          },
          '&.Mui-disabled .MuiSvgIcon-root': {
            color: '#677083',
          },
          '&.Mui-disabled.Mui-checked .MuiSvgIcon-root': {
            backgroundColor: '#677083',
            color: '#A0A5B6',
          },
        }
      }
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: '1px solid #677083',
          borderColor: '#677083',
          color: '#F7F7F7',
          '&.Mui-selected': {
            backgroundColor: '#003B71',
            borderColor: '#0078B3',
            color: 'white',
          },
          '&:hover': {
            backgroundColor: '#003B71',
            borderColor: '#90CEF1',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: '#0D1C3D',
          color: '#F7F7F7',
          '& fieldset': {
            borderColor: '#878F9B',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#90CEF1',
          },
          '&.Mui-disabled': {
            backgroundColor: '#202b42'
          },
          '&.listDetail': {
            color: '#F7F7F7',
          }
        }
      }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: '#F7F7F7',
          '&.listDetail': {
            color: '#F7F7F7',
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          color: '#F7F7F7',
          backgroundColor: '#003B71',
        }
      }
    },
    MuiPopper: {
      styleOverrides: {
        root: {
          '&.MuiPopper-root': {
            '& .MuiTooltip-tooltip': {
              backgroundColor: '#003B71',
              color: '#F7F7F7',
              border: '1px solid #677083',
            }
          }
        }
      }
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: '#90CEF1',
          '&:hover': {
            color: '#0078B3',
          },
          '&:visited': {
            color: '#B3B6C5',
          },
          '&:active': {
            color: '#0074AD',
          },
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#0D1C3D',
            color: '#F7F7F7',
            '& fieldset': {
              borderColor: '#878F9B',
            },
            '&:hover fieldset': {
              borderColor: '#FCFCFC',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#90CEF1',
            },
            '&.Mui-disabled': {
              backgroundColor: '#202b42'
            }
          },
        }
      }
    },
    MuiPickersInputBase: {
      styleOverrides: {
        root: {
          backgroundColor: '#0D1C3D',
          color: '#F7F7F7',
          '& fieldset': {
            borderColor: '#878F9B',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#90CEF1',
          },
          '&.Mui-disabled': {
            backgroundColor: '#202b42'
          }
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          // Dark mode: both active and inactive tabs are white
          color: '#fff !important',
          '&.Mui-selected': {
            color: '#fff !important',
          },
          '&:not(.Mui-selected)': {
            color: '#fff !important',
          },
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          '&.MuiAlert-standardSuccess': {
            color: '#fff',
            border: '1px solid #33A437',
            '& .MuiAlert-icon': {
              color: '#33A437',
            },
            '& .MuiAlert-action > .MuiIconButton-root': {
              color: '#33A437',
            },
          },
          '&.MuiAlert-standardError': {
            color: '#fff',
            border: '1px solid #D00000',
            '& .MuiAlert-icon': {
              color: '#D00000',
            },
            '& .MuiAlert-action > .MuiIconButton-root': {
              color: '#D00000',
            },
          },
          '&.MuiAlert-standardWarning': {
            color: '#fff',
            border: '1px solid #FF9800',
            '& .MuiAlert-icon': {
              color: '#FF9800',
            },
            '& .MuiAlert-action > .MuiIconButton-root': {
              color: '#FF9800',
            },
          },
          '&.MuiAlert-standardInfo': {
            color: '#fff',
            border: '1px solid #90CEF1',
            '& .MuiAlert-icon': {
              color: '#90CEF1',
            },
            '& .MuiAlert-action > .MuiIconButton-root': {
              color: '#90CEF1',
            },
          },
        }
      }
    },
    // MuiTableRow: {
    //   styleOverrides: {
    //     root: {
    //       backgroundColor: '#0D1C3D',
    //       color: '#F7F7F7',
    //       borderBottom: '1px solid #677083'
    //     },
    //     head: {
    //       backgroundColor: '#0D1C3D',
    //       fontWeight: 'bold',
    //       color: '#F7F7F7',
    //     },
    //     body: {
    //       backgroundColor: '#0D1C3D',
    //       color: '#F7F7F7',
    //     }
    //   }
    // },
    // MuiTableHead: {
    //   styleOverrides: {
    //     root: {
    //       backgroundColor: '#0D1C3D',
    //       fontWeight: 'bold',
    //       color: '#F7F7F7',
    //     }
    //   }
    // },
  },
};

// Theme creation function that merges configurations
const createAppTheme = (mode) => {
  const modeTheme = mode === 'light' ? lightTheme : darkTheme;
  const componentTheme = mode === 'light' ? lightComponentTheme : darkComponentTheme;

  // Deep merge shared and mode-specific component themes
  const mergedComponents = {};

  // Start with shared component theme
  Object.keys(sharedComponentTheme.components).forEach(componentName => {
    mergedComponents[componentName] = {
      styleOverrides: {
        ...sharedComponentTheme.components[componentName].styleOverrides
      }
    };
  });

  // Merge mode-specific overrides
  Object.keys(componentTheme.components).forEach(componentName => {
    if (!mergedComponents[componentName]) {
      mergedComponents[componentName] = { styleOverrides: {} };
    }

    Object.keys(componentTheme.components[componentName].styleOverrides).forEach(key => {
      if (!mergedComponents[componentName].styleOverrides[key]) {
        mergedComponents[componentName].styleOverrides[key] = {};
      }

      // Deep merge the styles
      mergedComponents[componentName].styleOverrides[key] = {
        ...mergedComponents[componentName].styleOverrides[key],
        ...componentTheme.components[componentName].styleOverrides[key]
      };
    });
  });

  return createTheme({
    ...defaultTheme,
    ...modeTheme,
    components: mergedComponents
  });
};

// Export the theme creation function and a hook to get the current theme
export const useAppTheme = () => {
  const { mode } = useThemeMode();
  return createAppTheme(mode);
};

// For backward compatibility, export a default light theme
const theme = createAppTheme('light');
export default theme;
// Theme creation function that merges configurationsconst createAppTheme = (mode) => {