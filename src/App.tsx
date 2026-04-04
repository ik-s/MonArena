import { useState, useEffect } from 'react'
import Header from './components/Header'
import CreateCharacterForm from './components/CreateCharacterForm'
import TrialCreateCharacterForm from './components/TrialCreateCharacterForm'
import EditCharacterForm from './components/EditCharacterForm'
import TrialEditCharacterForm from './components/TrialEditCharacterForm'
import CharacterList from './components/CharacterList'
import BottomNav from './components/BottomNav'
import StartPage from './components/StartPage'
import BattlePage from './components/BattlePage'
import TrialBattlePage from './components/TrialBattlePage'
import RankingPage from './components/RankingPage'
import UserInfoForm from './components/UserInfoForm'
import type { CharacterData } from './types/character'
import { usePrivy } from '@privy-io/react-auth'
import { supabase } from './lib/supabaseClient'
import './App.css'

// 네비게이션 탭 타입 정의 (3개로 축소됨)
type NavTab = 'home' | 'ranking' | 'account'

// 전체 앱 동작 상태 (시작 화면 또는 메인 화면)
type AppState = 'start' | 'main'

// 메인 화면 내 뷰 상태
type MainView = 'list' | 'create' | 'battle' | 'edit' | 'account' | 'ranking'

function App() {
  // 테마 고정 및 기존 설정 정리
  useEffect(() => {
    localStorage.removeItem('app-theme')
    // 보라색 테마가 이제 기본이므로 body 클래스 조작이 불필요함
    document.body.classList.remove('theme-purple') 
  }, [])

  // 앱 화면 전환 상태 관리 (초기값은 start)
  const [appState, setAppState] = useState<AppState>('start')
  // 메인 콘텐츠 화면 상태 관리 (초기값은 list)
  const [mainView, setMainView] = useState<MainView>('list')
  // 배틀 페이지용 활성 캐릭터 데이터
  const [activeCharacter, setActiveCharacter] = useState<CharacterData | null>(null)
  // 수정 중인 캐릭터 데이터
  const [editingCharacter, setEditingCharacter] = useState<CharacterData | null>(null)
  // 현재 활성화된 탭 상태 관리
  const [activeTab, setActiveTab] = useState<NavTab>('home')

  // 체험하기(익명)로 진입했는지 여부 추적
  const [isFromGuestTrial, setIsFromGuestTrial] = useState(false)

  // Privy 훅 기능 불러오기: 권한 검사 및 로그아웃 지원
  const { logout, authenticated, user } = usePrivy()

  // 유저 정보 자동 생성 및 동기화 (로그인 시)
  const ensureUserExists = async () => {
    const walletAddress = user?.wallet?.address || user?.id
    if (!walletAddress || !authenticated) return

    try {
      // 해당 유저가 존재하는지 확인하고, 없을 경우 기본 닉네임으로 생성
      const { error: selectError } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('wallet_address', walletAddress)
        .single()

      if (selectError && selectError.code === 'PGRST116') {
        // 유저 정보가 없는 경우 (PostgREST 406 - No rows returned)
        console.log('새 레코드 생성 중:', walletAddress)
        await supabase
          .from('users')
          .insert({
            wallet_address: walletAddress,
            nickname: '이름 없음', // 기본 닉네임 설정
            updated_at: new Date().toISOString()
          })
      }
    } catch (err) {
      console.error('사용자 동기화 에러:', err)
    }
  }

  // 인증 상태가 변하거나 유저 정보가 로드되면 동기화 시도
  useEffect(() => {
    if (authenticated && user) {
      ensureUserExists()
    }
  }, [authenticated, user])

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab)
    if (tab === 'home') {
      setMainView('list') // 홈 탭 클릭 시 캐릭터 리스트로 이동
    } else if (tab === 'ranking') {
      setMainView('ranking') // 랭킹 탭 클릭 시 랭킹 페이지로 이동
    } else if (tab === 'account') {
      setMainView('account') // 유저 정보 탭 클릭 시 계정 화면으로 이동
    }
  }

  // 임시 로그아웃 핸들러 기능
  const handleLogout = async () => {
    if (authenticated) {
      await logout()
    }
    // 체험하기용 게스트 ID를 초기화하여 다음 체험 시 새로운 ID가 생성되도록 합니다.
    localStorage.removeItem('guest_wallet_id')
    
    setAppState('start')
    setMainView('list') // 로그아웃 시 메인 뷰 상태를 목록으로 초기화
    setActiveTab('home')
    setIsFromGuestTrial(false)
  }

  // 시작 화면일 경우에는 앱 전체 레이아웃 대신 StartPage만 표시
  if (appState === 'start') {
    return (
      <div className="page-wrapper">
        <StartPage
          onLoginSuccess={() => {
            setAppState('main')
            setMainView('list')
            setActiveTab('home') // 로그인 성공 시 홈 탭 활성화
            setIsFromGuestTrial(false)
          }}
          onStartAnonymous={() => {
            // 새로운 체험 세션을 위해 기존 게스트 ID를 삭제합니다.
            localStorage.removeItem('guest_wallet_id')
            
            setAppState('main')
            setMainView('create')
            setActiveTab('home')
            setIsFromGuestTrial(true) // 체험하기로 진입했음을 표시
          }}
        />
      </div>
    )
  }

  // 전체 앱 레이아웃 렌더링
  // BottomNav는 .app 외부에 위치하여 root 전체 너비를 차지하도록 구성
  return (
    <div className="page-wrapper">
      <div className="app">
        {/* 상단 헤더 표시 */}
        <Header onLogout={handleLogout} />

        {/* 메인 콘텐츠 영역 */}
        <main className="app__main">
          {mainView === 'list' && (
            <CharacterList
              onCreateClick={() => {
                setMainView('create')
                setIsFromGuestTrial(false) // 리스트에서 진입 시에는 체험하기 플래그 해제
              }}
              onCharacterSelect={(char: CharacterData) => {
                setActiveCharacter(char)
                setMainView('battle')
              }}
              onEditClick={(char: CharacterData) => {
                setEditingCharacter(char)
                setMainView('edit')
              }}
            />
          )}
          {mainView === 'create' && (
            authenticated ? (
              <CreateCharacterForm
                onBack={() => setMainView('list')}
                onCreated={(char: CharacterData) => {
                  setActiveCharacter(char)
                  setMainView('battle')
                }}
              />
            ) : (
              <TrialCreateCharacterForm
                onBack={() => {
                  setAppState('start')
                  setIsFromGuestTrial(false)
                }}
                onCreated={(char: CharacterData) => {
                  setActiveCharacter(char)
                  setMainView('battle')
                  setIsFromGuestTrial(true)
                }}
              />
            )
          )}
          {mainView === 'edit' && editingCharacter && (
            authenticated ? (
              <EditCharacterForm
                character={editingCharacter}
                onBack={() => setMainView('list')}
                onUpdated={() => setMainView('list')}
              />
            ) : (
              <TrialEditCharacterForm
                character={editingCharacter}
                onBack={() => setMainView('battle')}
                onUpdated={(updatedChar) => {
                  setActiveCharacter(updatedChar) // 수정된 정보를 현재 활성 캐릭터로 업데이트
                  setMainView('battle')
                }}
              />
            )
          )}

          {mainView === 'battle' && activeCharacter && (
            authenticated ? (
              <BattlePage
                character={activeCharacter}
                onBack={() => setMainView('list')}
              />
            ) : (
              <TrialBattlePage
                character={activeCharacter}
                onBack={() => {
                  setEditingCharacter(activeCharacter)
                  setMainView('edit')
                }}
                onRequireLogin={() => {
                  setAppState('start')
                  setMainView('list')
                }}
              />
            )
          )}
          {mainView === 'account' && (
            <UserInfoForm onLogout={handleLogout} />
          )}
          {mainView === 'ranking' && (
            <RankingPage />
          )}
        </main>
      </div>

      {/* 하단 네비게이션 바: root 전체 너비를 따라감 */}
      {/* 하단 네비게이션 바: 정식 로그인 상태에서 체험하기가 아닌 경우에만 노출 */}
      {authenticated && !isFromGuestTrial && <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />}
    </div>
  )
}

export default App
