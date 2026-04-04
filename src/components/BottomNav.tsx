import React from 'react'
import './BottomNav.css'

import homeIcon from '../assets/home.svg'
import rankIcon from '../assets/rank.svg'
import userIcon from '../assets/user.svg'

// 네비게이션 탭 종류 정의
type NavTab = 'home' | 'ranking' | 'account'

// 탭 정보 목록 구성
const navItems: { id: NavTab; label: string; icon: string }[] = [
  { id: 'home', label: '홈', icon: homeIcon },
  { id: 'ranking', label: '랭킹', icon: rankIcon },
  { id: 'account', label: '유저 정보', icon: userIcon },
]

// 하단 네비게이션 컴포넌트의 속성 타입
interface BottomNavProps {
  activeTab: NavTab // 현재 활성화된 탭
  onTabChange: (tab: NavTab) => void // 탭 변경 이벤트 핸들러
}

// 하단 탭 네비게이션 바 컴포넌트
const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    // nav 자체는 화면 전체 너비(배경, 테두리)
    <nav className="bottom-nav">
      {/* 탭 요소들만 42rem 기준으로 중앙 배치되도록 inner wrapper 사용 */}
      <div className="bottom-nav__inner">
        {navItems.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={`bottom-nav__item ${activeTab === item.id ? 'bottom-nav__item--active' : ''}`}
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
          >
            {/* 아이콘 및 라벨 표시 */}
            <img src={item.icon} alt={item.label} className="bottom-nav__icon" />
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

export default BottomNav
