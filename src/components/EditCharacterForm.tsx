import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './CreateCharacterForm.css' // 동일한 디자인 사용
import type { CharacterData } from '../types/character'


const MAX_SETTING_LENGTH = 100

interface EditCharacterFormProps {
  character: CharacterData
  onBack: () => void
  onUpdated: () => void
}

const EditCharacterForm: React.FC<EditCharacterFormProps> = ({ character, onBack, onUpdated }) => {
  const [characterName, setCharacterName] = useState(character.character_name)
  const [characterSetting, setCharacterSetting] = useState(character.character_description)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 수정하기 버튼 핸들러
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
      console.log(`[Edit] 업데이트 시작 - ID: ${cid}, 필드:`, { characterName, characterSetting })

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
        console.error('캐릭터 수정 에러 상세:', error)
        alert('캐릭터 저장 중 오류가 발생했습니다.')
      } else {
        console.log('[Edit] 업데이트 성공 - 데이터 무결성 확인:', data)
        alert('저장되었습니다!')
        onUpdated() // 목록 새로고침 유도
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
          <h2 className="form-card__title">캐릭터 수정하기</h2>
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
            placeholder=""
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
              placeholder=""
              maxLength={MAX_SETTING_LENGTH}
              value={characterSetting}
              onChange={(e) => setCharacterSetting(e.target.value)}
            />
            <span className="form-group__char-count">
              {characterSetting.length}/{MAX_SETTING_LENGTH}
            </span>
          </div>
        </div>

        {/* 수정 버튼 */}
        <button
          id="update-character-btn"
          className="create-btn"
          onClick={handleUpdate}
          disabled={isSubmitting}
        >
          {isSubmitting ? '저장 중...' : '수정하기'}
        </button>
      </div>
    </div>
  )
}

export default EditCharacterForm
