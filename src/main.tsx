import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Privy 인증 프로바이더 추가
import { PrivyProvider } from '@privy-io/react-auth'

// Privy App ID 가져오기 (환경변수 또는 임시값)
const privyAppId = import.meta.env.VITE_PRIVY_APP_ID || 'insert-your-privy-app-id-here';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['google', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#676FFF',
        },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>
)
