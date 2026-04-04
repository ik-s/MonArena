import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePrivy } from '@privy-io/react-auth'
import { useSendTransaction } from 'wagmi'
import { parseEther } from 'viem'
import './BattlePage.css'
import type { CharacterData } from '../types/character'
import { adjudicateBattle } from '../lib/openai'

// 관리자 지갑 주소
const ADMIN_WALLET = '0x5Fb66a14a77517519a8b0cb40B333F42e4718A65'

interface BattlePageProps {
  character: CharacterData
  onBack: () => void
  onRequireLogin?: () => void
}

const BattlePage: React.FC<BattlePageProps> = ({ character, onBack }) => {
  const { authenticated } = usePrivy()
  const { sendTransactionAsync } = useSendTransaction()
  const [isTransacting, setIsTransacting] = useState(false)
  const [rank, setRank] = useState<number>(1)

  // 배틀 상태 관리
  const [battleState, setBattleState] = useState<'idle' | 'battling' | 'cooldown'>('idle')
  const [cooldownTime, setCooldownTime] = useState<number>(0)
  const [showResult, setShowResult] = useState<boolean>(false)
  const [opponent, setOpponent] = useState<CharacterData | null>(null) // 매칭된 상대 캐릭터
  const [battleResult, setBattleResult] = useState<'challenger_win' | 'defender_win' | 'draw' | null>(null)
  const [adjudication, setAdjudication] = useState<any>(null) // 아카샤의 상세 판정 데이터
  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(false) // 연습 모드 여부

  // 토스트 메시지 상태
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // 프론트 단 즉각 업데이트를 위한 로컬 전적 상태 추가
  const [localStats, setLocalStats] = useState({
    battle_count: character.battle_count,
    win_count: character.win_count,
    lose_count: character.lose_count,
    draw_count: character.draw_count,
    tp: character.tp || 0,
    rank_tier: character.rank_tier || 'Silver',
    practice_battle_count: character.practice_battle_count || 0,
    practice_win_count: character.practice_win_count || 0,
    practice_lose_count: character.practice_lose_count || 0,
    practice_draw_count: character.practice_draw_count || 0,
    rank_ticket: character.rank_ticket || false, // 티켓 보유 여부 추가
  })

  // 토스트 메시지 자동 소멸 로직
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [showToast])

  // 쿨다운 타이머 처리
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
    if (battleState === 'battling') return // 배틀 중에는 중복 불가

    // --- [랭크 티켓 체크 로직 수정: 결제 연동] ---
    if (!isPracticeMode && !localStats.rank_ticket) {
      const confirmPurchase = window.confirm(
        "랭크 게임을 플레이 하기 위해선 '영구 입장권'이 필요합니다!\n최초 1회 구매(0.1 MON) 시 이 캐릭터는 계속해서 랭크 게임 플레이가 가능합니다.\n구매하시겠습니까?"
      );

      if (confirmPurchase) {
        try {
          setIsTransacting(true)
          setToastMessage("입장권 결제를 위한 지갑 승인을 대기 중입니다...")
          setShowToast(true)

          const tx = await sendTransactionAsync({
            to: ADMIN_WALLET as `0x${string}`,
            value: parseEther('0.1'),
          })

          console.log('입장권 결제 성공:', tx)

          // 2. DB 업데이트 (영구 입장권 활성화)
          const { error } = await supabase
            .from('characters')
            .update({ rank_ticket: true })
            .eq('character_id', character.character_id);

          if (error) throw error;

          // 티켓 구매 성공 처리
          setLocalStats(prev => ({ ...prev, rank_ticket: true }));
          setToastMessage("영구 입장권 구매에 성공했습니다! 랭크 배틀을 시작합니다.");
          setShowToast(true);
          setIsTransacting(false)
          // 구매 직후 바로 배틀 매칭 로직으로 넘어감
        } catch (err: any) {
          console.error("티켓 구매 에러:", err);
          alert("결제가 취소되었거나 오류가 발생했습니다.");
          setIsTransacting(false)
          return;
        }
      } else {
        return; // 구매 거부 시 중단
      }
    }

    const battleStartTime = new Date().toISOString()

    // 배틀 시작 시 이전 결과 숨기기
    setShowResult(false)

    try {
      // 1. 토큰 결제 로직 추가 (연습 모드가 아닐 때만)
      if (!isPracticeMode) {
        setIsTransacting(true)
        setToastMessage("지갑에서 트랜잭션을 승인해주세요...")
        setShowToast(true)

        try {
          // 금액 설정: 빠른 배틀 0.05 MON, 일반 랭크 0.1 MON
          const amount = isFast ? '0.05' : '0.1'

          const tx = await sendTransactionAsync({
            to: ADMIN_WALLET as `0x${string}`,
            value: parseEther(amount),
          })

          console.log('트랜잭션 성공:', tx)
          setToastMessage(`결제 성공! ${amount} MON이 전송되었습니다.`)
          setShowToast(true)
        } catch (txErr) {
          console.error('트랜잭션 거부 또는 실패:', txErr)
          setToastMessage("결제가 취소되었거나 실패했습니다.")
          setShowToast(true)
          setBattleState('idle')
          setIsTransacting(false)
          return
        }
        setIsTransacting(false)
      }

      setBattleState('battling')

      // (중략 - 기존 매칭 로직)
      // 1. 랜덤 상대 캐릭터 조회 (본인이 아니며 랭크 티켓을 보유한 캐릭터)
      const { count: totalCount, error: countError } = await supabase
        .from('characters')
        .select('*', { count: 'exact', head: true })
        .neq('owner_wallet_address', character.owner_wallet_address) // 현재 사용자의 모든 캐릭터 제외
        .eq('rank_ticket', true) // 랭크 티켓 보유 여부 확인

      if (countError || totalCount === null || totalCount === 0) {
        throw new Error("랭크 게임 입장권을 보유한 상대 캐릭터를 찾을 수 없습니다.")
      }

      const randomIndex = Math.floor(Math.random() * totalCount)
      const { data: opponentData, error: opponentError } = await supabase
        .from('characters')
        .select('*')
        .neq('owner_wallet_address', character.owner_wallet_address) // 현재 사용자의 모든 캐릭터 제외
        .eq('rank_ticket', true) // 랭크 티켓 보유 여부 확인
        .range(randomIndex, randomIndex)
        .single()

      if (opponentError || !opponentData) {
        throw new Error("상대 캐릭터를 매칭하는 중 오류가 발생했습니다.")
      }

      setOpponent(opponentData)

      // 1.5초 간 배틀 진행 연출 (사용자 요청으로 3초에서 단축)
      await new Promise(resolve => setTimeout(resolve, 1500))

      // 2. 승패 결정 ('아카샤' AI 판정)
      const adj = await adjudicateBattle(character, opponentData);
      setBattleResult(adj.result)
      setAdjudication(adj)

      // 3. Supabase 전적 즉시 업데이트 (양쪽 모두 반영)
      const myId = character.character_id
      const opId = opponentData.character_id

      if (myId && opId) {
        if (isPracticeMode) {
          // --- [연습 모드 로직] ---
          const practiceUpdate = {
            battle_count: localStats.battle_count,
            win_count: localStats.win_count,
            lose_count: localStats.lose_count,
            draw_count: localStats.draw_count,
            tp: localStats.tp,
            rank_tier: localStats.rank_tier,
            rank_ticket: localStats.rank_ticket,
            practice_battle_count: localStats.practice_battle_count + 1,
            practice_win_count: localStats.practice_win_count + (adj.result === 'challenger_win' ? 1 : 0),
            practice_lose_count: localStats.practice_lose_count + (adj.result === 'defender_win' ? 1 : 0),
            practice_draw_count: localStats.practice_draw_count + (adj.result === 'draw' ? 1 : 0),
          };

          // Supabase 업데이트 (연습 전적 컬럼만 업데이트)
          const { error: updateError } = await supabase
            .from('characters')
            .update({
              practice_battle_count: practiceUpdate.practice_battle_count,
              practice_win_count: practiceUpdate.practice_win_count,
              practice_lose_count: practiceUpdate.practice_lose_count,
              practice_draw_count: practiceUpdate.practice_draw_count,
            })
            .eq('character_id', myId);

          if (updateError) throw updateError;

          // (중략 - 배틀 로그 저장 로직)
          const ensureUser = async (wallet: string) => {
            const { data, error } = await supabase
              .from('users')
              .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address' })
              .select('user_id')
              .single();
            if (error) throw error;
            return data.user_id;
          };

          const [challengerUserId, defenderUserId] = await Promise.all([
            ensureUser(character.owner_wallet_address || ''),
            ensureUser(opponentData.owner_wallet_address || '')
          ]);

          await supabase.from('battles').insert({
            challenger_character_id: myId,
            defender_character_id: opId,
            challenger_user_id: challengerUserId,
            defender_user_id: defenderUserId,
            result: adj.result,
            battle_log: adj.battle_log,
            final_verdict: adj.final_verdict,
            is_practice: true, // 연습 모드 표시
            created_at: battleStartTime,
            finished_at: new Date().toISOString()
          });

          setLocalStats(practiceUpdate);
        } else {
          // --- [랭크 모드 로직 (기존 유지)] ---
          // TP 및 티어 계산
          const calculateTPUpdate = (
            myTier: string,
            myTP: number,
            _opTier: string, // 미사용 변수 처리
            res: 'win' | 'lose' | 'draw'
          ) => {
            if (res === 'draw') return { tpChange: 0, nextTP: myTP, nextTier: myTier };

            let tpBase = 0;
            if (res === 'win') {
              if (myTier === 'Silver') {
                tpBase = 40;
                if (_opTier === 'Gold') tpBase += 3;
                else if (_opTier === 'Diamond') tpBase += 5;
              } else if (myTier === 'Gold') {
                tpBase = 30;
                if (_opTier === 'Diamond') tpBase += 3;
              } else if (myTier === 'Diamond') {
                tpBase = 20;
              }
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
            rank_tier: nextTier,
            last_battle_at: new Date().toISOString(),
            tp: nextTP, // 필수 속성 추가
            practice_battle_count: localStats.practice_battle_count,
            practice_win_count: localStats.practice_win_count,
            practice_lose_count: localStats.practice_lose_count,
            practice_draw_count: localStats.practice_draw_count,
            rank_ticket: localStats.rank_ticket, // 티켓 필드 유지
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
            throw new Error("데이터베이스 업데이트에 실패했습니다. (SQL 컬럼 누락 여부를 확인해주세요)");
          }

          // (중략 - 배틀 로그 저장 로직)
          try {
            // 유저가 프로필을 저장하지 않았을 수도 있으므로, 배틀 참여자들의 upsert를 통해 user_id 확보 (wallet_address 기준)
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
                is_practice: false,
                created_at: battleStartTime,
                finished_at: new Date().toISOString()
              })
              .select()

            if (battleError) {
              console.error('배틀 기록 저장 중 상세 DB 오류:', battleError)
            } else {
              console.log('배틀 기록 저장 성공:', battleData)
            }
          } catch (dbErr) {
            console.error('배틀 로그 저장 전체 프로세스 실패:', dbErr)
          }

          setLocalStats(myUpdate)
          if (nextTier !== localStats.rank_tier) {
            if (nextTP > localStats.tp) {
              // 승급
              alert(`축하합니다! ${nextTier}로 승급하셨습니다!`);
            } else {
              // 강등
              alert(`${nextTier}로 강등당하셨습니다. 행운을 빕니다!`);
            }
          }

          setLocalStats(myUpdate)
        } // isPracticeMode else 블록 끝
      }

      setShowResult(true)
      setBattleState('cooldown')
      setCooldownTime(60)
    } catch (err: any) {
      console.error(err)
      alert(err.message || '알 수 없는 오류가 발생했습니다.')
      setBattleState('idle')
    }
  }

  // 순위 조회 (TP 기반)
  useEffect(() => {
    const fetchRank = async () => {
      try {
        // 순위 산출: (TP가 나보다 높은 캐릭터 수) + (TP는 같고 나보다 먼저 생성된 캐릭터 수) + 1
        // 랭크 티켓(rank_ticket)을 보유한 캐릭터들 중에서만 집계
        const { count, error } = await supabase
          .from('characters')
          .select('*', { count: 'exact', head: true })
          .eq('rank_ticket', true) // 랭크 티켓 보유자 한정
          .or(`tp.gt.${localStats.tp},and(tp.eq.${localStats.tp},created_at.lt.${character.created_at})`)

        if (!error && count !== null) {
          setRank(count + 1)
        }
      } catch (err) {
        console.error('순위 조회 오류:', err)
      }
    }

    fetchRank()
  }, [localStats.tp, localStats.practice_battle_count]) // 연습 모드 직후 수동 갱신 유도

  // 실제 승률 계산 (로컬 상태 기준)
  let winRate = '0%'
  if (isPracticeMode) {
    if (localStats.practice_battle_count > 0) {
      winRate = Math.round((localStats.practice_win_count / localStats.practice_battle_count) * 100) + '%'
    } else {
      winRate = '-%'
    }
  } else {
    if (localStats.battle_count > 0) {
      winRate = Math.round((localStats.win_count / localStats.battle_count) * 100) + '%'
    } else {
      winRate = '-%'
    }
  }

  return (
    <div className="battle-page-wrapper">
      {/* 토스트 알림 메시지 */}
      {showToast && (
        <div className="battle-toast">
          {toastMessage}
        </div>
      )}

      <div className="battle-card">
        {/* 헤더 */}
        <div className="battle-card__header">
          <button className="battle-card__back-btn" onClick={onBack} aria-label="뒤로가기">
            ←
          </button>
          {isPracticeMode ? (
            <span className="practice-mode-badge">🍃 연습 모드</span>
          ) : (
            <span className="rank-mode-badge">🏆 랭크 모드</span>
          )}
        </div>

        {/* 캐릭터 정보 */}
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

        {/* 연습 모드 전적 표시 전환 */}
        <div className="battle-card__record">
          <h3 className="record-title">{isPracticeMode ? '연습 전적' : '랭크 전적'}</h3>
          <div className="record-grid">
            <div className="record-item">
              <span className="record-item__label">총 배틀</span>
              <span className="record-item__value record-item__value--neutral">
                {isPracticeMode ? localStats.practice_battle_count : localStats.battle_count}
              </span>
            </div>
            <div className="record-item">
              <span className="record-item__label">승리</span>
              <span className="record-item__value record-item__value--win">
                {isPracticeMode ? localStats.practice_win_count : localStats.win_count}
              </span>
            </div>
            <div className="record-item">
              <span className="record-item__label">패배</span>
              <span className="record-item__value record-item__value--lose">
                {isPracticeMode ? localStats.practice_lose_count : localStats.lose_count}
              </span>
            </div>
            <div className="record-item">
              <span className="record-item__label">무승부</span>
              <span className="record-item__value record-item__value--neutral">
                {isPracticeMode ? localStats.practice_draw_count : localStats.draw_count}
              </span>
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
                  {!isPracticeMode ? (
                    battleResult === 'challenger_win' ? '총 0.2 MON 획득 (베팅금 0.1 복구 + 보상 0.1)' :
                    battleResult === 'defender_win' ? '0.1 MON 상실 (베팅금 차감)' :
                    '0.1 MON 반환'
                  ) : (
                    battleResult === 'challenger_win' ? '승리!' :
                    battleResult === 'defender_win' ? '패배' :
                    '무승부'
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="battle-actions">
          <button
            className="btn-battle"
            onClick={() => handleStartBattle()}
            disabled={battleState !== 'idle' || isTransacting}
          >
            {isTransacting ? (
              <span className="battle-loading">
                <span className="loader-spinner"></span>
                지갑 승인 중..
              </span>
            ) : battleState === 'battling' ? (
              <span className="battle-loading">
                <span className="loader-spinner"></span>
                배틀 진행 중..
              </span>
            ) : battleState === 'cooldown' ? (
              `휴식 시간 : ${cooldownTime}초`
            ) : isPracticeMode ? (
              '🍃 연습 시작'
            ) : (
              '⚔ 배틀 시작'
            )}
          </button>

          {authenticated && (
            <>
              <button
                className="btn-battle-fast"
                onClick={() => handleStartBattle(true)}
                disabled={battleState === 'battling' || isTransacting}
              >
                휴식 없는 배틀 시작
                <img src="/MON_Token.png" className="token-icon" alt="MON Token" />
                0.05 MON
              </button>

              <button
                className="btn-battle-practice"
                onClick={() => setIsPracticeMode(!isPracticeMode)}
                disabled={battleState === 'battling'}
              >
                {isPracticeMode ? '🏆 랭크 게임하기' : '🍃 배틀 연습해보기 (랭크 영향 없음)'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default BattlePage
