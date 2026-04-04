import React from 'react'
import './Header.css'

interface HeaderProps {
  onLogout?: () => void
}

// 상단 헤더를 구성하는 컴포넌트
const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  return (
    <header className="header">
      {/* 앱 타이틀 표시 */}
      <h1 className="header__title">MonArena - Text War</h1>

      {/* 테스트/임시 목적의 로그아웃 버튼 */}
      {onLogout && (
        <button
          onClick={onLogout}
          style={{
            fontSize: '14px',
            padding: '4px 12px',
            background: 'transparent',
            border: '1px solid #ff4d4d',
            color: '#ff4d4d',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          임시 로그아웃
        </button>
      )}
    </header>
  )
}

export default Header
