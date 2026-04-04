import React, { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { supabase } from '../lib/supabaseClient'
import './StartPage.css'

interface StartPageProps {
  onLoginSuccess: () => void
  onStartAnonymous: () => void
}

const StartPage: React.FC<StartPageProps> = ({ onLoginSuccess, onStartAnonymous }) => {
  // Privy 훅 기능 불러오기: 구글 및 메타마스크 로그인 모달 지원
  const { login, authenticated, ready } = usePrivy()
  const [characterCount, setCharacterCount] = useState<number>(0)

  // 인증이 완료되었을 시 자동으로 메인 화면으로 이동
  useEffect(() => {
    if (ready && authenticated) {
      onLoginSuccess()
    }
  }, [ready, authenticated, onLoginSuccess])

  useEffect(() => {
    const fetchCharacterCount = async () => {
      try {
        // characters 테이블의 전체 행 개수(count)만 가져옵니다.
        const { count, error } = await supabase
          .from('characters')
          .select('*', { count: 'exact', head: true })

        if (error) {
          console.error('캐릭터 수를 가져오는 중 오류 발생:', error)
        } else if (count !== null) {
          setCharacterCount(count)
        }
      } catch (err) {
        console.error('캐릭터 수를 가져오는 중 알 수 없는 오류 발생:', err)
      }
    }

    fetchCharacterCount()
  }, [])

  return (
    <div className="login-page">
      {/* 타이틀 및 설명 영역 */}
      <div className="login-header">
        <h1 className="login-header__title">텍스트 배틀</h1>
        <p className="login-header__desc">
          텍스트로 나만의 캐릭터를 만들어 다른 사용자들의 캐릭터와 대결<br />
          하고 승패에 따라 랭킹이 정해집니다.
        </p>
        <div className="login-header__status">
          <span className="status-dot"></span>
          현재 대전 중인 캐릭터: <span className="status-count">{characterCount.toLocaleString()}</span>
        </div>
      </div>

      {/* 로그인 폼 카드 영역 */}
      <div className="login-card">
        {/* Privy 기반 메타마스크 및 구글 통합 로그인 버튼 */}
        <button className="btn-white" onClick={() => login()}>
          로그인하기
        </button>

        <div className="login-divider">
          <span>또는</span>
        </div>

        {/* 익명으로 시작 (클릭 시 메인 화면 이동) */}
        <button className="btn-white" onClick={onStartAnonymous}>
          체험해보기
        </button>
      </div>

      {/* 최하단 푸터 정보 */}
      <div className="login-footer">
        <p>의견, 버그제보: debutler@kw.ac.kr</p>
      </div>
    </div>
  )
}

export default StartPage
