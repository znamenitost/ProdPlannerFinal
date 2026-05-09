// ./frontend/src/components/StatsCards.jsx
import { Grid, Card, CardContent, Typography, Box } from '@mui/material';
import { TaskAlt, AccessTime, HourglassEmpty, TrendingUp, TrendingDown } from '@mui/icons-material';

export default function StatsCards({ stats }) {
  const totalDifference = stats.totalEstimate - stats.totalActual;

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card sx={{ bgcolor: '#f0fdf4', border: '1px solid #dcfce7' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Всего задач</Typography>
              <TaskAlt sx={{ color: '#22c55e' }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
              {stats.totalTasks}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card sx={{ bgcolor: '#eff6ff', border: '1px solid #dbeafe' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Выделено часов</Typography>
              <AccessTime sx={{ color: '#3b82f6' }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
              {stats.totalEstimate.toFixed(1)} ч
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card sx={{ bgcolor: '#fef3c7', border: '1px solid #fde68a' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Реально часов</Typography>
              <HourglassEmpty sx={{ color: '#f59e0b' }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
              {stats.totalActual.toFixed(1)} ч
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card sx={{ 
          bgcolor: totalDifference >= 0 ? '#f0fdf4' : '#fef2f2', 
          border: '1px solid',
          borderColor: totalDifference >= 0 ? '#dcfce7' : '#fee2e2'
        }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Экономия</Typography>
              {totalDifference >= 0 ? <TrendingUp sx={{ color: '#22c55e' }} /> : <TrendingDown sx={{ color: '#ef4444' }} />}
            </Box>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 700, 
                mt: 1, 
                color: totalDifference >= 0 ? '#22c55e' : '#ef4444' 
              }}
            >
              {totalDifference >= 0 ? '+' : ''}{totalDifference.toFixed(1)} ч
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}