import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Privy 인증 프로바이더 추가
import { PrivyProvider } from '@privy-io/react-auth'
import { defineChain } from 'viem'

// Wagmi 및 TanStack Query 관련 추가
import { http, createConfig, WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// 모나드 테스트넷 체인 정의 (Chain ID: 10143)
const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://testnet.monadexplorer.com' },
  },
  testnet: true,
})

// Wagmi 설정 생성
const config = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(),
  },
})

// React Query 클라이언트 생성
const queryClient = new QueryClient()

// Privy App ID 가져오기 (환경변수 또는 임시값)
const privyAppId = import.meta.env.VITE_PRIVY_APP_ID || 'insert-your-privy-app-id-here';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <PrivyProvider
          appId={privyAppId}
          config={{
            loginMethods: ['google', 'wallet'],
            // 모나드 테스트넷을 지원 체인으로 추가하고 기본 체인으로 설정
            supportedChains: [monadTestnet],
            defaultChain: monadTestnet,
            appearance: {
              theme: 'dark',
              accentColor: '#676FFF',
            },
          }}
        >
          <App />
        </PrivyProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
