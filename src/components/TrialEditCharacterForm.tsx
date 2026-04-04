import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './CreateCharacterForm.css' 
import type { CharacterData } from '../types/character'

const MAX_SETTING_LENGTH = 100

interface TrialEditCharacterFormProps {
  character: CharacterData
  onBack: () => void
  onUpdated: (updatedChar: CharacterData) => void
}

const TrialEditCharacterForm: React.FC<TrialEditCharacterFormProps> = ({ character, onBack, onUpdated }) => {
  const [characterName, setCharacterName] = useState(character.character_name)
  const [characterSetting, setCharacterSetting] = useState(character.character_description)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleUpdate = async () => {
    if (!characterName.trim() || !characterSetting.trim()) {
      alert('캐릭터 이름과 설정을 모두 입력해주세요.')
      return
    }

    const pkColumn = character.character_id ? 'character_id' : 'id'
    const cid = character.character_id || character.id
    if (!cid) {
      alert('캐릭터 식별자를 찾을 수 없습니다.')
      return
    }

    setIsSubmitting(true)
    try {
      console.log(`[TrialEdit] 업데이트 시작 - ID: ${cid}, 필드:`, { characterName, characterSetting })
      
      const { data, error } = await supabase
        .from('characters')
        .update({
          character_name: characterName,
          character_description: characterSetting,
        })
        .eq(pkColumn, cid)
        .select()
        .single()

      if (error) {
        console.error('캐릭터 수정 DB 에러:', error)
        alert('저장 중 오류가 발생했습니다.')
      } else {
        // 1-1. 유저 닉네임 동기화 (체험하기 유저는 캐릭터 명을 유저 명으로 사용)
        if (data.owner_wallet_address) {
          await supabase
            .from('users')
            .update({ nickname: characterName })
            .eq('wallet_address', data.owner_wallet_address)
        }

        console.log('[TrialEdit] 업데이트 성공 - 반환 데이터 전적 확인:', {
          win: data.win_count,
          lose: data.lose_count,
          tp: data.tp
        })
        alert('저장되었습니다!')
        onUpdated(data)
      }
    } catch (err) {
      alert('오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="form-wrapper">
      <div className="form-card">
        <div className="form-card__header">
          <button className="form-card__back-btn" onClick={onBack} aria-label="뒤로가기">
            ←
          </button>
          <h2 className="form-card__title">캐릭터 수정하기 (체험)</h2>
        </div>

        <div className="form-group">
          <label className="form-group__label">캐릭터 이름</label>
          <input
            type="text"
            className="form-group__input"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-group__label">캐릭터 설정</label>
          <div className="form-group__textarea-wrapper">
            <textarea
              className="form-group__textarea"
              maxLength={MAX_SETTING_LENGTH}
              value={characterSetting}
              onChange={(e) => setCharacterSetting(e.target.value)}
            />
            <span className="form-group__char-count">
              {characterSetting.length}/{MAX_SETTING_LENGTH}
            </span>
          </div>
        </div>

        <button className="create-btn" onClick={handleUpdate} disabled={isSubmitting}>
          {isSubmitting ? '저장 중...' : '수정 완료'}
        </button>
      </div>
    </div>
  )
}

export default TrialEditCharacterForm
