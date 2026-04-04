import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './CreateCharacterForm.css'

const MAX_SETTING_LENGTH = 100

interface TrialCreateCharacterFormProps {
  onBack: () => void
  onCreated: (characterData: any) => void
}

const TrialCreateCharacterForm: React.FC<TrialCreateCharacterFormProps> = ({ onBack, onCreated }) => {
  const [characterName, setCharacterName] = useState('')
  const [characterSetting, setCharacterSetting] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreate = async () => {
    if (!characterName.trim() || !characterSetting.trim()) {
      alert('캐릭터 이름과 설정을 모두 입력해주세요.')
      return
    }

    // 체험용 게스트 ID 확인 및 생성
    let walletAddress = localStorage.getItem('guest_wallet_id')
    if (!walletAddress) {
      walletAddress = 'guest-' + crypto.randomUUID()
      localStorage.setItem('guest_wallet_id', walletAddress)
    }

    setIsSubmitting(true)
    try {
      // 1. 유저 정보 선제 생성 (배틀 로그 저장 시 user_id 외래 키 참조를 위해 필수)
      const { error: userError } = await supabase
        .from('users')
        .upsert(
          { wallet_address: walletAddress, nickname: characterName },
          { onConflict: 'wallet_address' }
        )

      if (userError) {
        console.error('유저 정보 생성 에러:', userError)
        throw new Error('사용자 세션 생성에 실패했습니다.')
      }

      // 2. 캐릭터 정보 생성
      const { data, error } = await supabase
        .from('characters')
        .insert([
          {
            owner_wallet_address: walletAddress,
            character_name: characterName,
            character_description: characterSetting,
            win_count: 0,
            lose_count: 0,
            draw_count: 0,
            battle_count: 0,
            rank_tier: 'Silver',
            tp: 0,
            is_public: true
          }
        ])
        .select()
        .single()

      if (error) {
        alert('저장 중 데이터베이스 오류가 발생했습니다.')
      } else {
        alert('저장되었습니다!')
        onCreated(data)
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
          <h2 className="form-card__title">새 캐릭터 만들기 (체험)</h2>
        </div>

        <div className="form-group">
          <label className="form-group__label">캐릭터 이름</label>
          <input
            type="text"
            className="form-group__input"
            placeholder="예: Monad Warrior"
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
              placeholder="캐릭터를 묘사해주세요."
              value={characterSetting}
              onChange={(e) => setCharacterSetting(e.target.value)}
            />
            <span className="form-group__char-count">
              {characterSetting.length}/{MAX_SETTING_LENGTH}
            </span>
          </div>
        </div>

        <button className="create-btn" onClick={handleCreate} disabled={isSubmitting}>
          {isSubmitting ? '저장 중...' : '생성 및 배틀 시작'}
        </button>
      </div>
    </div>
  )
}

export default TrialCreateCharacterForm
