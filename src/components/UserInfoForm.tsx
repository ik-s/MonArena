import React, { useState, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { createPublicClient, http, formatEther } from 'viem'
import { useSendTransaction } from 'wagmi'
import { parseEther } from 'viem'
import { supabase } from '../lib/supabaseClient'
import logoutIcon from '../assets/logout.svg'
import binIcon from '../assets/bin.svg'
import './UserInfoForm.css' // 전용 스타일 시트 임포트

// 관리자 지갑 주소
const ADMIN_WALLET = '0x5Fb66a14a77517519a8b0cb40B333F42e4718A65'

// Monad 테스트넷 설정 (Viem 체인 정의)
const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
    public: { http: ['https://testnet-rpc.monad.xyz'] },
  },
}

interface UserInfoFormProps {
  onLogout: () => void
}

const UserInfoForm: React.FC<UserInfoFormProps> = ({ onLogout }) => {
  const [nickname, setNickname] = useState('')
  const [balance, setBalance] = useState<string>('---') // 초기값은 대기 상태
  const [ticket, setTicket] = useState<number>(0) // 티켓 보유 수 상태 추가
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isBuying, setIsBuying] = useState(false) // 티켓 구매 중 상태
  const [isLoading, setIsLoading] = useState(true)

  const { sendTransactionAsync } = useSendTransaction()

  // Privy 유저 정보 로드
  const { user } = usePrivy()
  // 지갑 주소 또는 Privy ID를 가져오되, 없을 경우 게스트 ID를 확인합니다.
  const walletAddress = user?.wallet?.address || user?.id || localStorage.getItem('guest_wallet_id') || ''

  // Viem 클라이언트 생성
  const publicClient = createPublicClient({
    chain: monadTestnet as any,
    transport: http()
  })

  // 잔액 조회 함수
  const fetchBalance = async () => {
    if (!walletAddress || !walletAddress.startsWith('0x')) {
      // 실제 지갑이 아니면(guest 등) 테스트용 가짜 데이터 사용
      setBalance('200.00')
      return
    }

    try {
      const balanceAmount = await publicClient.getBalance({
        address: walletAddress as `0x${string}`
      })
      const formatted = formatEther(balanceAmount)
      // 실제 잔액을 정확하게 표시합니다.
      setBalance(Number(formatted).toFixed(4))
    } catch (err) {
      console.error('잔액 조회 에러:', err)
      setBalance('조회 실패')
    }
  }

  // 초기 유저 정보 로드 및 잔액 조회
  useEffect(() => {
    const init = async () => {
      if (!walletAddress) return

      // 닉네임 및 티켓 로드
      try {
        const { data, error } = await supabase
          .from('users')
          .select('nickname, ticket')
          .eq('wallet_address', walletAddress)
          .single()

        if (error && error.code !== 'PGRST116') {
          console.error('유저 정보 로드 에러:', error)
        } else if (data) {
          setNickname(data.nickname || '')
          setTicket(data.ticket || 0)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }

      // 잔액 로드
      fetchBalance()
    }

    init()
  }, [walletAddress])

  // 저장 버튼 핸들러
  const handleSave = async () => {
    if (!nickname.trim()) {
      alert('닉네임을 입력해주세요.')
      return
    }

    if (!walletAddress) {
      alert('로그인이 필요합니다.')
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          wallet_address: walletAddress,
          nickname: nickname,
          updated_at: new Date().toISOString()
        }, { onConflict: 'wallet_address' })

      if (error) {
        console.error('유저 정보 저장 에러:', error)
        alert('정보 저장 중 오류가 발생했습니다.')
      } else {
        alert('성공적으로 저장되었습니다!')
      }
    } catch (err) {
      console.error(err)
      alert('알 수 없는 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 티켓 구매 핸들러
  const handleBuyTicket = async () => {
    if (!walletAddress || !walletAddress.startsWith('0x')) {
      alert('지갑 연결이 필요합니다.')
      return
    }

    setIsBuying(true)
    try {
      // 1. 0.1 MON 전송 트랜잭션
      const tx = await sendTransactionAsync({
        to: ADMIN_WALLET as `0x${string}`,
        value: parseEther('0.1'),
      })

      console.log('티켓 구매 트랜잭션 성공:', tx)

      // 2. Supabase DB 업데이트
      const newTicketCount = ticket + 1
      const { error: updateError } = await supabase
        .from('users')
        .update({ ticket: newTicketCount })
        .eq('wallet_address', walletAddress)

      if (updateError) {
        console.error('티켓 정보 업데이트 에러:', updateError)
        alert('결제는 성공했으나 티켓 정보 업데이트에 실패했습니다. 관리자에게 문의하세요.')
      } else {
        setTicket(newTicketCount)
        alert('티켓 1장을 성공적으로 구매했습니다!')
        fetchBalance() // 잔액 갱신
      }
    } catch (err) {
      console.error('티켓 구매 중 에러:', err)
      alert('티켓 구매 중 오류가 발생했거나 결제가 취소되었습니다.')
    } finally {
      setIsBuying(false)
    }
  }

  // 계정 삭제 핸들러
  const handleDeleteAccount = async () => {
    // 1. 사용자 확인
    const confirmed = window.confirm('정말로 계정을 삭제하시겠습니까?\n생성된 모든 캐릭터 정보도 함께 삭제되며, 이 작업은 되돌릴 수 없습니다.')
    if (!confirmed) return

    if (!walletAddress) {
      alert('로그인 정보가 없습니다.')
      return
    }

    setIsSubmitting(true)

    try {
      console.log('계정 삭제 시도 - 식별자:', walletAddress)

      // 2. 캐릭터 데이터 삭제 (최신 스키마의 owner_wallet_address 기준)
      const { error: charError, count: charCount } = await supabase
        .from('characters')
        .delete({ count: 'exact' })
        .eq('owner_wallet_address', walletAddress)

      if (charError) {
        console.error('캐릭터 삭제 에러:', charError)
        throw charError
      }
      console.log('캐릭터 삭제 완료, 삭제된 개수:', charCount)

      // 3. 유저 정보 삭제 (테이블: users, 컬럼: wallet_address 기준)
      const { error: userError, count: userCount } = await supabase
        .from('users')
        .delete({ count: 'exact' })
        .eq('wallet_address', walletAddress)

      if (userError) {
        console.error('유저 정보 삭제 에러:', userError)
        throw userError
      }
      console.log('유저 정보 삭제 완료, 삭제된 개수:', userCount)

      // 4. 삭제 성공 알림 및 로그아웃 처리
      alert('계정이 성공적으로 삭제되었습니다.')
      onLogout()
    } catch (err: any) {
      console.error('계정 삭제 최종 처리 실패:', err)
      alert('계정 삭제 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="user-info-wrapper">
      <div className="user-info-card">
        {/* 폼 헤더 */}
        <div className="user-info-header">
          <h2 className="user-info-title">유저 정보</h2>
        </div>

        {/* 닉네임 설정 및 저장 */}
        <div className="user-info-group">
          <label className="user-info-label" htmlFor="user-nickname">
            닉네임 설정
          </label>
          <div className="nickname-input-group">
            <input
              id="user-nickname"
              type="text"
              className="user-info-input"
              placeholder={isLoading ? '로딩 중...' : '닉네임을 입력하세요'}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={isLoading}
            />
            {/* 닉네임 바로 아래 가득 찬 버튼으로 배치 */}
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </div>

        {/* 하단 지갑 주소 및 잔액 표시 영역 */}
        <div className="user-info-group" style={{ marginTop: 'auto' }}>
          <label className="user-info-label">내 지갑 주소</label>
          <div className="wallet-box">
            {walletAddress}
          </div>

          <div className="balance-section" style={{ marginTop: '20px' }}>
            <label className="user-info-label">현재 잔액</label>
            <div className="balance-display">
              <span className="balance-amount">{balance}</span>
              <span className="balance-symbol">MON</span>
              <button
                className="refresh-balance-btn"
                onClick={fetchBalance}
                title="잔액 새로고침"
              >
                🔄
              </button>
            </div>
          </div>

          <div className="ticket-section" style={{ marginTop: '20px' }}>
            <label className="user-info-label">보유한 티켓</label>
            <div className="ticket-action-group">
              <div className="ticket-display">
                <span className="ticket-count">{ticket}</span>
                <span className="ticket-label">Rank Tickets</span>
              </div>
              <button
                className="buy-ticket-btn"
                onClick={handleBuyTicket}
                disabled={isBuying || isLoading}
              >
                {isBuying ? '구매 중..' : '티켓 구매 (0.1 MON)'}
              </button>
            </div>
          </div>

          {/* 로그아웃 버튼 */}
          <button className="logout-btn" onClick={onLogout}>
            <img src={logoutIcon} alt="" className="logout-btn__icon" />
            <span>로그아웃</span>
          </button>

          {/* 계정 삭제 옵션 (작은 크기, 빨간색) */}
          <button
            className="delete-account-btn"
            onClick={handleDeleteAccount}
            disabled={isSubmitting || isLoading}
          >
            <img src={binIcon} alt="" className="delete-account-btn__icon" />
            <span>계정 삭제</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default UserInfoForm
