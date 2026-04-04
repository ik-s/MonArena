import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './RankingPage.css'
import type { CharacterData } from '../types/character'

// 데이터베이스 쿼리 결과(조인 포함)를 위한 확장 타입 정의
interface RankingItem extends CharacterData {
  user_info?: {
    nickname: string;
  };
}

const RankingPage: React.FC = () => {
  const [activeTier, setActiveTier] = useState<'Silver' | 'Gold' | 'Diamond'>('Silver')
  const [rankers, setRankers] = useState<RankingItem[]>([]) // any[] 대신 정의한 타입을 사용
  const [isLoading, setIsLoading] = useState(true)

  // 랭킹 데이터 가져오기
  const fetchRankings = async () => {
    setIsLoading(true)
    try {
      // 1. 해당 티어의 캐릭터만 먼저 조회 (조인 없이)
      const { data: charData, error: charError } = await supabase
        .from('characters')
        .select('*')
        .eq('rank_tier', activeTier)
        .order('tp', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(10)

      if (charError) throw charError

      if (charData && charData.length > 0) {
        // 2. 캐릭터 소유자들의 고유 지갑 주소 추출 (게스트 제외)
        const walletAddresses = charData
          .map(c => c.owner_wallet_address)
          .filter((addr): addr is string => !!addr && !addr.startsWith('guest-'))
        const uniqueAddresses = Array.from(new Set(walletAddresses))

        let userMap: Record<string, string> = {}
        
        if (uniqueAddresses.length > 0) {
          // 3. 해당 지갑 주소들의 닉네임 정보 별도 조회
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('wallet_address, nickname')
            .in('wallet_address', uniqueAddresses)

          if (!userError && userData) {
            // 조회를 위해 맵으로 변환
            userData.forEach(u => {
              userMap[u.wallet_address] = u.nickname
            })
          }
        }

        // 4. 데이터 병합 (Manual Join)
        const mergedData: RankingItem[] = charData.map(char => ({
          ...char,
          user_info: userMap[char.owner_wallet_address] 
            ? { nickname: userMap[char.owner_wallet_address] } 
            : undefined
        }))

        setRankers(mergedData)
      } else {
        setRankers([])
      }
    } catch (err) {
      console.error('랭킹 데이터 로드 실패:', err)
      setRankers([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRankings()
  }, [activeTier])

  return (
    <div className="ranking-page-wrapper">
      {/* 티어 선택 탭 */}
      <div className="tier-tabs">
        {(['Silver', 'Gold', 'Diamond'] as const).map((tier) => (
          <button
            key={tier}
            className={`tier-tab ${activeTier === tier ? 'tier-tab--active' : ''}`}
            onClick={() => setActiveTier(tier)}
          >
            {tier}
          </button>
        ))}
      </div>

      {/* 랭킹 리스트 */}
      <div className="ranking-list">
        {isLoading ? (
          <div className="ranking-loading">랭킹 데이터를 불러오는 중...</div>
        ) : rankers.length > 0 ? (
          rankers.map((ranker, index) => {
            // 닉네임 결정 로직
            let ownerNickname = '이름 없음'
            if (ranker.owner_wallet_address?.startsWith('guest-')) {
              ownerNickname = '익명'
            } else if (ranker.user_info?.nickname) {
              ownerNickname = ranker.user_info.nickname
            }

            return (
              <div key={ranker.character_id} className={`ranking-item ranking-item--${index + 1}`}>
                <div className="ranking-item__rank">#{index + 1}</div>
                <div className="ranking-item__info">
                  <div className="ranking-item__name">{ranker.character_name}</div>
                  <div className="ranking-item__stats">
                    {/* 기존 전적 대신 보유자 닉네임을 표시 */}
                    보유자: {ownerNickname}
                  </div>
                </div>
                <div className="ranking-item__tp">
                  <span className="tp-label">TP</span>
                  <span className="tp-value">{ranker.tp?.toLocaleString() || 0}</span>
                </div>
              </div>
            )
          })
        ) : (
          <div className="ranking-empty">해당 티어에 아직 랭커가 없습니다.</div>
        )}
      </div>
    </div>
  )
}

export default RankingPage
