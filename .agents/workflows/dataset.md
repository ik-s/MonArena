---
description: backend dataset
---

type Character = {
  character_id: number
  owner_wallet_address: string
  character_name: string
  character_description: string
  win_count: number
  lose_count: number
  draw_count: number
  battle_count: number
  rank_tier : string
  is_public: boolean
  created_at: string
  updated_at: string
}

type User = {
  user_id: number
  wallet_address: string
  nickname?: string | null
  created_at: string
  updated_at: string
  last_login_at?: string | null
}

type Battle = {
  battle_id: number
  challenger_character_id: number
  defender_character_id: number
  challenger_user_id: number
  defender_user_id: number
  result: 'challenger_win' | 'defender_win' | 'draw'
  battle_log: string
  ai_judgement_reason: string
  created_at: string
  finished_at?: string | null
  status: 'pending' | 'completed' | 'cancelled'
}