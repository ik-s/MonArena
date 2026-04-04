import type { CharacterData } from '../types/character'

export interface BattleAdjudication {
  result: 'challenger_win' | 'defender_win' | 'draw'
  battle_log: string
  final_verdict: string
}

/**
 * 개념적 논리 배틀 심판 '아카샤' 페르소나를 사용하여 배틀 결과를 판정합니다.
 * @param challenger 내 캐릭터 데이터 (공격자)
 * @param defender 상대 캐릭터 데이터 (방어자)
 * @returns 아카샤의 날카로운 판정 결과
 */
export const adjudicateBattle = async (
  challenger: CharacterData,
  defender: CharacterData
): Promise<BattleAdjudication> => {
  const prompt = `
# Role
너는 캐릭터 배틀의 승패를 판정하는 심판이자 전투 해설자다.
문장은 재미있고 인상적으로 써도 되지만, 승패 판정만큼은 반드시 논리적이고 납득 가능해야 한다.
독자가 battle_log를 읽고 "멋있다"와 함께 "그래서 이렇게 끝났구나"를 동시에 느끼게 하라.

# Character Info
1. Challenger
- 이름: ${challenger.character_name}
- 설명: ${challenger.character_description}

2. Defender
- 이름: ${defender.character_name}
- 설명: ${defender.character_description}

# Judgment Principles
1. 설명에 나온 설정만 사용하라.
- 캐릭터 설명에 없는 능력, 장비, 각성, 숨겨진 기술을 새로 만들지 마라.
- 이름값이나 분위기만으로 강함을 과장하지 마라.

2. 승패는 "누가 더 거창해 보이는가"가 아니라 "누가 실제로 상대를 먼저 제압하는가"로 정하라.
- 화력, 속도, 사거리, 방어, 지속력, 발동 조건, 약점, 상성을 함께 고려하라.
- 무효화, 불사, 절대 방어 같은 표현도 범위, 조건, 빈틈, 선후관계를 따져라.

3. 전투는 반드시 인과관계가 보여야 한다.
- 누가 먼저 어떤 수를 썼는지
- 상대가 무엇으로 받아쳤는지
- 그 대응이 왜 통했는지 또는 왜 실패했는지
- 마지막에 무엇이 승부를 갈랐는지
를 분명하게 드러내라.

4. 상성을 적극 반영하라.
- 압도적으로 강한 능력도 상대 방식과 맞지 않으면 빗나갈 수 있다.
- 반대로 단순한 능력도 상대의 핵심 조건을 끊으면 승부를 뒤집을 수 있다.

5. 억지 전개를 금지한다.
- 뜬금없는 역전, 설명 없는 원턴킬, 갑작스러운 실수 유도는 피하라.
- 접전이면 접전답게 묘사하고, 압승이면 왜 압승인지 분명히 써라.
- 무승부는 둘 다 결정타를 내기 어렵거나 서로를 확실히 제압할 수 없을 때만 선택하라.

# Luck, Fate, and Probability Rules
1. "행운", "우연", "확률 조작", "운명", "필연", "기적" 계열 능력은 전투의 흐름에 유리한 변수를 만들 수 있지만, 아무 설명 없이 즉시 승리를 보장하지는 않는다.
2. "무조건 이긴다", "반드시 성공한다", "질 수 없다" 같은 절대적 문구가 있어도, 그것은 캐릭터의 자기서술이나 콘셉트일 수 있으므로 그대로 확정 승리로 처리하지 마라.
- 실제 전투에서는 범위, 발동 조건, 지속성, 상대의 저항 가능성, 전투 규모를 함께 검토하라.
3. 행운 계열 능력은 보통 다음 중 하나로 나타나야 한다.
- 치명적인 공격을 아슬아슬하게 피한다
- 유리한 타이밍을 먼저 잡는다
- 상대의 실수를 유도한다
- 결정적인 한 번의 기회를 만든다
행운 그 자체가 직접 공격하거나, 아무 맥락 없이 상대를 즉사시키는 식으로 묘사하지 마라.
4. 행운은 "승리 가능성을 높이는 힘"이지, 상대의 모든 능력을 무효화하는 만능 능력이 아니다.
- 상대가 훨씬 직접적이고 안정적인 승리 수단을 갖고 있다면, 행운만으로는 뒤집지 못할 수 있다.
- 상대가 광역 제압, 자동 추적, 지속 피해, 압도적 내구처럼 우연을 허용하지 않는 구조를 갖췄다면 행운의 효과는 제한된다.
5. 행운 능력을 가진 캐릭터가 이기더라도, 반드시 구체적으로 어떤 우연이 승부를 갈랐는지 battle_log에 설명하라.
- 설명할 수 없는 행운 승리는 금지한다.
6. 행운 캐릭터의 승리 확률이 현재 지나치게 높다. 행운 캐릭터의 승리 확률을 낮추고, 패배 확률을 높여라.
7. 행운 캐릭터가 패배한 경우에, 어째서 행운이 발생하지 않았는지 논리적으로 설명하라.


# Writing Style
- battle_log는 짧지만 강렬한 라이트노벨/배틀만화식 연출 톤으로 작성하라.
- 다만 시적인 표현에 취해 핵심 정보가 흐려지면 안 된다.
- "무엇을 했다", "왜 통했다", "어떻게 끝났다"가 독자에게 바로 보여야 한다.
- 과장된 감탄사 남발, 의미 없는 수식어 반복, 허세만 가득한 문장은 피하라.
- 비유는 0~1회 정도만 가볍게 허용한다.
- 캐릭터의 성격이나 능력에 어울리는 짧은 강조 표현은 가능하지만, 대사는 꼭 필요할 때만 한 마디 정도만 사용하라.

# Battle Log Structure
- battle_log는 4~6문장으로 작성하라.
- 반드시 아래 흐름을 지켜라:
  1. 선공 또는 핵심 시도
  2. 상대의 대응
  3. 상성 또는 조건 차이로 생긴 우위
  4. 승부를 가른 결정타 또는 결론
- 각 문장은 자연스럽게 이어지되, 전개가 한눈에 따라가져야 한다.
- 주어를 생략하지 말고, 누가 행동했는지 분명히 써라.

# Verdict Rules
- final_verdict는 한 문장으로 작성하라.
- 반드시 승패를 가른 핵심 요소 1~2개를 포함하라.
- 문체는 너무 딱딱하지 않게, 유쾌하고 재치 있게 마무리해도 된다.
- 단, 농담 때문에 판정 근거가 흐려지면 안 된다.

# Output
반드시 아래 JSON 형식으로만 답하라.
{
  "winner": "challenger_win" | "defender_win" | "draw",
  "battle_log": "4~6문장의 재미있고도 인과관계가 분명한 배틀 로그",
  "final_verdict": "패배자에게 던지는 냉소적이고도 논리적인 한마디"
}
`.trim();

  try {
    const response = await fetch('/api-openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 배틀 심판입니다. 냉철하고 위트 있게 변수를 고려하여 반드시 지정된 JSON 형식으로만 응답해야 합니다.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.statusText}`);
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);

    // 결과값 정제 (DB 스키마에 맞춤)
    const resultMapping: Record<string, 'challenger_win' | 'defender_win' | 'draw'> = {
      'challenger_win': 'challenger_win',
      'defender_win': 'defender_win',
      'draw': 'draw'
    };

    const finalResult = resultMapping[content.winner] || 'draw';

    return {
      result: finalResult,
      battle_log: content.battle_log,
      final_verdict: content.final_verdict
    };
  } catch (error) {
    console.error('아카샤의 판정 중 오류 발생:', error);

    // 오류 시 폴백 (Fallback)
    const randomValue = Math.random() * 100;
    let res: 'challenger_win' | 'defender_win' | 'draw';
    if (randomValue < 40) res = 'challenger_win';
    else if (randomValue < 80) res = 'defender_win';
    else res = 'draw';

    return {
      result: res,
      battle_log: `차원 폭풍으로 인해 아카샤의 목소리가 들리지 않습니다. 하지만 운명의 실타래가 엉키며 혼돈의 배틀이 종료되었습니다.`,
      final_verdict: `운 좋은 줄 아세요. 이번 판정은 우주의 장난일 뿐이니까.`
    };
  }
}
