import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './BattlePage.css'
import type { CharacterData } from '../types/character'
import { adjudicateBattle } from '../lib/openai'

interface TrialBattlePageProps {
  character: CharacterData
  onBack: () => void // 체험하기에서는 '캐릭터 수정'으로 연결됨
  onRequireLogin: () => void
}

const TrialBattlePage: React.FC<TrialBattlePageProps> = ({ character, onBack, onRequireLogin }) => {
  const [rank, setRank] = useState<number>(1)

  // 배틀 상태 관리
  const [battleState, setBattleState] = useState<'idle' | 'battling' | 'cooldown'>('idle')
  const [cooldownTime, setCooldownTime] = useState<number>(0)
  const [showResult, setShowResult] = useState<boolean>(false)
  const [opponent, setOpponent] = useState<CharacterData | null>(null)
  const [battleResult, setBattleResult] = useState<'challenger_win' | 'defender_win' | 'draw' | null>(null)
  const [adjudication, setAdjudication] = useState<any>(null) // 아카샤의 상세 판정 데이터

  // 프론트 단 즉각 업데이트를 위한 로컬 전적 상태
  const [localStats, setLocalStats] = useState({
    battle_count: character.battle_count,
    win_count: character.win_count,
    lose_count: character.lose_count,
    draw_count: character.draw_count,
    tp: character.tp || 0,
    rank_tier: character.rank_tier || 'Silver',
  })

  // 쿨다운 타이머
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (battleState === 'cooldown' && cooldownTime > 0) {
      timer = setInterval(() => {
        setCooldownTime((prev) => {
          if (prev <= 1) {
            setBattleState('idle')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [battleState, cooldownTime])

  // 배틀 시작 이벤트
  const handleStartBattle = async (isFast = false) => {
    if (battleState !== 'idle' && !isFast) return
    if (battleState === 'battling') return

    // 체험하기 유저 5회 제한 확인
    if (localStats.battle_count >= 5) {
      alert("무료 체험 배틀은 5회까지만 가능합니다.\n계정을 연결하고 더 많은 캐릭터를 생성하고 더 많은 배틀을 즐겨보세요!")
      onRequireLogin()
      return
    }

    const battleStartTime = new Date().toISOString()
    setBattleState('battling')
    setShowResult(false)

    try {
      // 1. 랜덤 상대 캐릭터 조회 (본인 제외)
      const { count: totalCount, error: countError } = await supabase
        .from('characters')
        .select('*', { count: 'exact', head: true })
        .neq('owner_wallet_address', character.owner_wallet_address)

      if (countError || totalCount === null || totalCount === 0) {
        throw new Error("상대 캐릭터를 찾을 수 없습니다. (캐릭터가 부족합니다)")
      }

      const randomIndex = Math.floor(Math.random() * totalCount)
      const { data: opponentData, error: opponentError } = await supabase
        .from('characters')
        .select('*')
        .neq('owner_wallet_address', character.owner_wallet_address)
        .range(randomIndex, randomIndex)
        .single()

      if (opponentError || !opponentData) {
        throw new Error("상대 캐릭터를 매칭하는 중 오류가 발생했습니다.")
      }

      setOpponent(opponentData)

      // 3초 간 배틀 연출
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 2. 승패 결정 ('아카샤' AI 판정)
      const adj = await adjudicateBattle(character, opponentData);
      setBattleResult(adj.result)
      setAdjudication(adj)

      // 3. DB 업데이트
      const myId = character.character_id
      const opId = opponentData.character_id

      if (myId && opId) {
        const calculateTPUpdate = (
          myTier: string,
          myTP: number,
          _opTier: string, // 미사용 변수 처리
          res: 'win' | 'lose' | 'draw'
        ) => {
          if (res === 'draw') return { tpChange: 0, nextTP: myTP, nextTier: myTier };
          let tpBase = 0;
          if (res === 'win') {
            if (myTier === 'Silver') tpBase = 40;
            else if (myTier === 'Gold') tpBase = 30;
            else if (myTier === 'Diamond') tpBase = 15;
          } else {
            if (myTier === 'Silver') tpBase = -10;
            else if (myTier === 'Gold') tpBase = -20;
            else if (myTier === 'Diamond') tpBase = -30;
          }
          const nextTP = Math.max(0, myTP + tpBase);
          let nextTier = myTier;
          if (nextTP >= 700) nextTier = 'Diamond';
          else if (nextTP >= 300) nextTier = 'Gold';
          else nextTier = 'Silver';
          return { tpChange: tpBase, nextTP, nextTier };
        };

        const { nextTP, nextTier } = calculateTPUpdate(
          localStats.rank_tier,
          localStats.tp,
          opponentData.rank_tier,
          adj.result === 'challenger_win' ? 'win' : adj.result === 'defender_win' ? 'lose' : 'draw'
        );

        // 상대방(Defender)의 결과 계산
        const opponentResult: 'win' | 'lose' | 'draw' =
          adj.result === 'defender_win' ? 'win' : adj.result === 'challenger_win' ? 'lose' : 'draw';

        const { nextTP: opNextTP, nextTier: opNextTier } = calculateTPUpdate(
          opponentData.rank_tier,
          opponentData.tp,
          localStats.rank_tier,
          opponentResult
        );

        const myUpdate = {
          battle_count: localStats.battle_count + 1,
          win_count: localStats.win_count + (adj.result === 'challenger_win' ? 1 : 0),
          lose_count: localStats.lose_count + (adj.result === 'defender_win' ? 1 : 0),
          draw_count: localStats.draw_count + (adj.result === 'draw' ? 1 : 0),
          tp: nextTP,
          rank_tier: nextTier,
          last_battle_at: new Date().toISOString(),
        }

        const opUpdate = {
          battle_count: opponentData.battle_count + 1,
          win_count: opponentData.win_count + (opponentResult === 'win' ? 1 : 0),
          lose_count: opponentData.lose_count + (opponentResult === 'lose' ? 1 : 0),
          draw_count: opponentData.draw_count + (opponentResult === 'draw' ? 1 : 0),
          tp: opNextTP,
          rank_tier: opNextTier,
          last_battle_at: new Date().toISOString(), // 상대방도 배틀에 참여했으므로 갱신
        }

        const [myRes, opRes] = await Promise.all([
          supabase.from('characters').update(myUpdate).eq('character_id', myId),
          supabase.from('characters').update(opUpdate).eq('character_id', opId)
        ])

        if (myRes.error || opRes.error) {
          console.error("전적 반영 상세 오류(My):", myRes.error);
          console.error("전적 반영 상세 오류(Op):", opRes.error);
          throw new Error("체험 배틀 결과 저장 실패: SQL 컬럼 누락이 의심됩니다.");
        }

        // 4. battles 테이블에 상세 로그 기록 (Akasha Adjudication)
        try {
          const ensureUser = async (wallet: string) => {
            const { data, error } = await supabase
              .from('users')
              .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address' })
              .select('user_id')
              .single()
            if (error) throw error
            return data.user_id
          }

          const [challengerUserId, defenderUserId] = await Promise.all([
            ensureUser(character.owner_wallet_address || ''),
            ensureUser(opponentData.owner_wallet_address || '')
          ])

          const { data: battleData, error: battleError } = await supabase
            .from('battles')
            .insert({
              challenger_character_id: myId,
              defender_character_id: opId,
              challenger_user_id: challengerUserId,
              defender_user_id: defenderUserId,
              result: adj.result,
              battle_log: adj.battle_log,
              final_verdict: adj.final_verdict,
              created_at: battleStartTime,
              finished_at: new Date().toISOString()
            })
            .select()

          if (battleError) {
            console.error('체험 배틀 기록 저장 오류:', battleError)
          } else {
            console.log('체험 배틀 기록 저장 성공:', battleData)
          }
        } catch (dbErr) {
          console.error('체험 배틀 로그 저장 실패:', dbErr)
        }

        setLocalStats(myUpdate)
      }

      setShowResult(true)
      setBattleState('cooldown')
      setCooldownTime(60)
    } catch (err: any) {
      console.error(err)
      alert(err.message || '오류가 발생했습니다.')
      setBattleState('idle')
    }
  }

  // 순위 조회
  useEffect(() => {
    const fetchRank = async () => {
      try {
        const { count, error } = await supabase
          .from('characters')
          .select('*', { count: 'exact', head: true })
          .or(`tp.gt.${localStats.tp},and(tp.eq.${localStats.tp},created_at.lt.${character.created_at})`)

        if (!error && count !== null) {
          setRank(count + 1)
        }
      } catch (err) {
        console.error('순위 조회 오류:', err)
      }
    }
    fetchRank()
  }, [localStats.tp])

  const winRate = localStats.battle_count > 0
    ? Math.round((localStats.win_count / localStats.battle_count) * 100) + '%'
    : '-%'

  return (
    <div className="battle-page-wrapper">
      <div className="battle-card">
        <div className="battle-card__header">
          <button className="battle-card__back-btn" onClick={onBack} aria-label="뒤로가기">
            ← <span className="edit-guide-text">캐릭터 수정하기</span>
          </button>
        </div>

        <div className="battle-card__info">
          <h2 className="battle-card__name">{character.character_name}</h2>
          <p className="battle-card__desc">{character.character_description}</p>
        </div>

        <div className="battle-card__stats-grid">
          <div className="stat-box">
            <span className="stat-box__label">순위</span>
            <span className="stat-box__value">#{rank.toLocaleString()}</span>
          </div>
          <div className="stat-box">
            <span className="stat-box__label">승률</span>
            <span className="stat-box__value">{winRate}</span>
          </div>
          <div className="stat-box">
            <span className="stat-box__label">티어</span>
            <span className="stat-box__value">{localStats.rank_tier}</span>
          </div>
          <div className="stat-box">
            <span className="stat-box__label">TP</span>
            <span className="stat-box__value">
              {localStats.rank_tier === 'Silver' ? `${localStats.tp} / 300` :
                localStats.rank_tier === 'Gold' ? `${localStats.tp} / 700` :
                  localStats.tp}
            </span>
          </div>
        </div>

        <div className="battle-card__record">
          <h3 className="record-title">전적</h3>
          <div className="record-grid">
            <div className="record-item">
              <span className="record-item__label">총 배틀</span>
              <span className="record-item__value record-item__value--neutral">{localStats.battle_count}</span>
            </div>
            <div className="record-item">
              <span className="record-item__label">승리</span>
              <span className="record-item__value record-item__value--win">{localStats.win_count}</span>
            </div>
            <div className="record-item">
              <span className="record-item__label">패배</span>
              <span className="record-item__value record-item__value--lose">{localStats.lose_count}</span>
            </div>
            <div className="record-item">
              <span className="record-item__label">무승부</span>
              <span className="record-item__value record-item__value--neutral">{localStats.draw_count}</span>
            </div>
          </div>
        </div>

        {/* 아카샤의 판정 결과창 */}
        {showResult && opponent && adjudication && (
          <div className="battle-card__recent-result">
            <h3 className="record-title akasha-title">최근 배틀 결과</h3>
            <div className={`result-box ${battleResult}`}>
              <div className="result-box__header">
                <span className="result-box__name">{character.character_name}</span>
                <span className="result-box__vs">VS</span>
                <span className="result-box__name">{opponent.character_name}</span>
              </div>

              <div className="akasha-narrative">
                <p className="result-box__text">{adjudication.battle_log}</p>
              </div>

              <div className="akasha-verdict">
                <p className="verdict-text">"{adjudication.final_verdict}"</p>
              </div>

              <div className="result-box__icon-wrapper">
                <span className="result-icon">
                  {battleResult === 'challenger_win' ? '👑' : battleResult === 'defender_win' ? '💀' : '🤝'}
                </span>
                <span className={`result-icon-text ${battleResult === 'defender_win' ? 'result-icon-text--lose' : ''}`}>
                  {battleResult === 'challenger_win' ? '승리' : battleResult === 'defender_win' ? '패배' : '무승부'}
                </span>
              </div>
            </div>
          </div>
        )}

          <div className="battle-actions">
            {localStats.battle_count >= 5 ? (
              <button className="btn-battle btn-battle-expired" onClick={onRequireLogin}>
                체험이 종료되었습니다! 더 플레이 하시려면 계정을 연결해주세요
              </button>
            ) : (
              <button
                className="btn-battle"
                onClick={() => handleStartBattle()}
                disabled={battleState !== 'idle'}
              >
                {battleState === 'battling' ? '배틀 진행 중..' : battleState === 'cooldown' ? `휴식 시간 : ${cooldownTime}초` : '⚔ 배틀 시작'}
              </button>
            )}
          </div>
      </div>
    </div>
  )
}

export default TrialBattlePage
