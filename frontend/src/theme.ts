import { createTheme } from "@mui/material/styles"

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1565c0" },
    secondary: { main: "#6a1b9a" },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    fontSize: 13,
  },
  components: {
    MuiTab: {
      styleOverrides: {
        root: { minHeight: 48, textTransform: "none" },
      },
    },
  },
})

export default theme
