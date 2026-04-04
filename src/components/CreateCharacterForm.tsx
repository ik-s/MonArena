import React, { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { supabase } from '../lib/supabaseClient'
import './CreateCharacterForm.css'

const MAX_SETTING_LENGTH = 100

interface CreateCharacterFormProps {
  onBack: () => void
  onCreated: (characterData: any) => void
}

const CreateCharacterForm: React.FC<CreateCharacterFormProps> = ({ onBack, onCreated }) => {
  const [characterName, setCharacterName] = useState('')
  const [characterSetting, setCharacterSetting] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Privy 유저 정보 로드
  const { user } = usePrivy()

  // 생성하기 버튼 핸들러
  const handleCreate = async () => {
    if (!characterName.trim() || !characterSetting.trim()) {
      alert('캐릭터 이름과 설정을 모두 입력해주세요.')
      return
    }

    let walletAddress = user?.wallet?.address || user?.id
    if (!walletAddress) {
      alert('로그인이 필요합니다.')
      return
    }

    setIsSubmitting(true)

    try {
      // 1. 유저 정보 선제 생성 (배틀 로그 저장 시 user_id 외래 키 참조를 위해 필수)
      const { error: userError } = await supabase
        .from('users')
        .upsert({ wallet_address: walletAddress }, { onConflict: 'wallet_address' })

      if (userError) {
        console.error('유저 정보 생성 에러:', userError)
        throw new Error('사용자 계정 활성화에 실패했습니다.')
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
        console.error('캐릭터 생성 에러 상세:', error)
        alert('캐릭터 저장 중 데이터베이스 오류가 발생했습니다.')
      } else {
        alert('저장되었습니다!')
        // 성공 시 폼 초기화 및 이전 화면 (배틀 디테일 뷰)으로 이동
        setCharacterName('')
        setCharacterSetting('')
        onCreated(data)
      }
    } catch (err) {
      console.error(err)
      alert('알 수 없는 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="form-wrapper">
      <div className="form-card">
        {/* 폼 헤더 */}
        <div className="form-card__header">
          <button className="form-card__back-btn" id="back-btn" aria-label="뒤로가기" onClick={onBack}>
            ←
          </button>
          <h2 className="form-card__title">새 캐릭터 만들기</h2>
        </div>

        {/* 캐릭터 이름 */}
        <div className="form-group">
          <label className="form-group__label" htmlFor="character-name">
            캐릭터 이름
          </label>
          <input
            id="character-name"
            type="text"
            className="form-group__input"
            placeholder="캐릭터 이름을 적어주세요."
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
          />
        </div>

        {/* 캐릭터 설정 */}
        <div className="form-group">
          <label className="form-group__label" htmlFor="character-setting">
            캐릭터 설정
          </label>
          <div className="form-group__textarea-wrapper">
            <textarea
              id="character-setting"
              className="form-group__textarea"
              placeholder="캐릭터를 묘사해주세요."
              maxLength={MAX_SETTING_LENGTH}
              value={characterSetting}
              onChange={(e) => setCharacterSetting(e.target.value)}
            />
            <span className="form-group__char-count">
              {characterSetting.length}/{MAX_SETTING_LENGTH}
            </span>
          </div>
        </div>

        {/* 생성 버튼 */}
        <button
          id="create-character-btn"
          className="create-btn"
          onClick={handleCreate}
          disabled={isSubmitting}
        >
          {isSubmitting ? '저장 중...' : '생성 및 배틀 시작'}
        </button>
      </div>
    </div>
  )
}

export default CreateCharacterForm
