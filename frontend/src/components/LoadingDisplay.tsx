import { Box, CircularProgress } from '@mui/material'

function LoadingDisplay({
    text
} : {
    text?: string
}) {
  return (
    <Box sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '1.5rem',
        flexDirection: 'column',
        gap: '1rem'
    }}>
        <CircularProgress size={24} />
        {text}
    </Box>
  )
}

export default LoadingDisplay