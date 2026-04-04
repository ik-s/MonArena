import React, { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { supabase } from '../lib/supabaseClient'
import './CharacterList.css'
import type { CharacterData } from '../types/character'

interface CharacterListProps {
  onCreateClick: () => void
  onCharacterSelect?: (char: CharacterData) => void
  onEditClick?: (char: CharacterData) => void // 수정 버튼 클릭 이벤트 추가
}

const CharacterList: React.FC<CharacterListProps> = ({ onCreateClick, onCharacterSelect, onEditClick }) => {
  const { user } = usePrivy()
  const [characters, setCharacters] = useState<CharacterData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCharacters = async () => {
      let walletAddress: string | null | undefined = user?.wallet?.address || user?.id
      if (!walletAddress) {
        walletAddress = localStorage.getItem('guest_wallet_id')
      }

      if (!walletAddress) {
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('characters')
          .select('*')
          .eq('owner_wallet_address', walletAddress)
          .order('created_at', { ascending: false }) // 최신순

        if (!error && data) {
          // 다이아몬드 티어 TP 차감(Decay) 로직 적용
          const now = new Date()
          const processedData = [...data]

          for (let i = 0; i < processedData.length; i++) {
            const char = processedData[i]
            // 다이아몬드 티어이고 마지막 활동 기록이 있는 경우
            if (char.rank_tier === 'Diamond' && char.last_battle_at) {
              const lastBattle = new Date(char.last_battle_at)
              const diffMs = now.getTime() - lastBattle.getTime()
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

              if (diffDays >= 1) {
                // 하루당 5점씩 차감
                const decayPoints = diffDays * 5
                const currentTP = char.tp || 0
                const newTP = Math.max(0, currentTP - decayPoints)

                // DB 업데이트 수행 (TP 차감 및 타이머 초기화)
                const pkColumn = char.character_id ? 'character_id' : 'id'
                const cid = char.character_id || char.id

                const { error: updateError } = await supabase
                  .from('characters')
                  .update({
                    tp: newTP,
                    last_battle_at: now.toISOString()
                  })
                  .eq(pkColumn, cid)

                if (!updateError) {
                  processedData[i] = { ...char, tp: newTP, last_battle_at: now.toISOString() }
                  console.log(`${char.character_name} 캐릭터 TP ${decayPoints}점 차감됨 (Diamond Decay)`)
                }
              }
            }
          }

          setCharacters(processedData)
        }
      } catch (err) {
        console.error("캐릭터 목록 불러오기 오류:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchCharacters()
  }, [user])

  const handleAddCharacter = () => {
    if (characters.length >= 5) {
      alert('캐릭터는 한 계정당 최대 5개까지만 생성할 수 있습니다.')
      return
    }
    onCreateClick()
  }

  const handleDelete = async (char: CharacterData) => {
    if (!window.confirm(`'${char.character_name}' 캐릭터를 삭제하시겠습니까?`)) return

    // 이전 로직과 통일성을 위해 pk 체크
    const pkColumn = char.character_id ? 'character_id' : 'id'
    const cid = char.character_id || char.id

    try {
      // 1. 배틀 기록 수반 삭제 (Manual Cascade: 외래 키 제약 조건 해결)
      // 도전자로서 참여한 기록 삭제
      await supabase.from('battles').delete().eq('challenger_character_id', cid)
      // 방어자로서 참여한 기록 삭제
      await supabase.from('battles').delete().eq('defender_character_id', cid)

      // 2. 최종 캐릭터 삭제
      const { error } = await supabase.from('characters').delete().eq(pkColumn, cid)

      if (error) {
        console.error('캐릭터 삭제 에러 상세:', error)
        alert('삭제 중 오류가 발생했습니다: ' + error.message)
      } else {
        // 목록 업데이트
        setCharacters(characters.filter((c) => (c.character_id || c.id) !== cid))
      }
    } catch (err) {
      console.error(err)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="character-list-wrapper">

      <div className="cross-promo-text">
        텍스트로 나만의 강력한 캐릭터를 만들어보세요!
      </div>

      {/* 내 캐릭터 카드 */}
      <div className="list-card">
        <h2 className="list-card__title">내 캐릭터</h2>

        {loading ? (
          <div className="list-card__empty">로딩 중...</div>
        ) : characters.length === 0 ? (
          <div className="list-card__empty">
            아직 생성된 캐릭터가 없습니다
          </div>
        ) : (
          <div className="character-items-container">
            {characters.map((char) => {
              // 승률과 티어 계산
              const totalBattles = char.battle_count || 0
              const winRate = totalBattles > 0 ? Math.round(((char.win_count || 0) / totalBattles) * 100) : 0
              const tier = char.rank_tier || '미정'
              const cid = char.character_id || char.id

              return (
                <div
                  key={cid}
                  className="character-item"
                  onClick={() => onCharacterSelect && onCharacterSelect(char)}
                >
                  <div className="character-item__info">
                    <h3 className="character-item__name">{char.character_name}</h3>
                    <p className="character-item__desc">{char.character_description}</p>
                    <div className="character-item__badges">
                      <span className="character-item__badge">승률 : {winRate}%</span>
                      <span className="character-item__badge">티어 : {tier} ({char.tp || 0} TP)</span>
                    </div>
                  </div>
                  <div className="character-item__actions">
                    <button
                      className="icon-btn"
                      aria-label="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditClick && onEditClick(char); // 기존 alert 대신 수정 이벤트 호출
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button
                      className="icon-btn icon-btn--danger"
                      aria-label="Delete"
                      onClick={(e) => { e.stopPropagation(); handleDelete(char); }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash2"><path d="M3 6h18" stroke="#F87171" fill="none" strokeWidth="2px"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" stroke="#F87171" fill="none" strokeWidth="2px"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" stroke="#F87171" fill="none" strokeWidth="2px"></path><line x1="10" x2="10" y1="11" y2="17" stroke="#F87171" fill="none" strokeWidth="2px"></line><line x1="14" x2="14" y1="11" y2="17" stroke="#F87171" fill="none" strokeWidth="2px"></line></svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 캐릭터 추가 버튼 */}
      <div className="add-action-area">
        <button className="add-character-btn" onClick={handleAddCharacter}>
          <span>+ 캐릭터 추가</span>
          <span className="add-character-btn__count">{characters.length}/5</span>
        </button>
      </div>

      {/* 푸터 */}
      <div className="list-footer">
        <p>의견, 버그제보: debutler@kw.ac.kr</p>
        <p>이용약관 <span className="dot">·</span> 개인정보 처리방침</p>
      </div>
    </div>
  )
}

export default CharacterList
