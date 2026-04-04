export interface CharacterData {
  character_id?: number | string
  character_name: string
  character_description: string
  win_count: number
  lose_count: number
  draw_count: number
  battle_count: number
  rank_tier: string
  tp: number
  owner_wallet_address?: string // 캐릭터 소유자의 지갑 주소
  created_at?: string // 생성 시간 (타이브레이커용)
  last_battle_at?: string // 마지막 배틀 시간 (다이아몬드 TP 감소용)
  practice_win_count: number
  practice_lose_count: number
  practice_draw_count: number
  practice_battle_count: number
  [key: string]: any
}
