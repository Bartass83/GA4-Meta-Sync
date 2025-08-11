
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Ga4MetaChart from './Ga4MetaChart'

const qc = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <Ga4MetaChart days={30} />
    </QueryClientProvider>
  )
}
