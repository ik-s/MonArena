---
description: Project Overview for the Monad Hackathon
---

##Project Description
A text-based battle game where you create your own character by describing it in 100 characters or less, and earn rewards by battling characters created by others.

##Feature Description
1. Upon accessing the page, users can either try the game without connecting a wallet by clicking the “Try It Out” button, or play the game by connecting a wallet.
1-1. When navigating to the play screen, users enter a character name and description in the prompt to generate their character; the generated character information is stored on the backend.
1-2. Upon creation, users can view their ranking, win rate, tier, and match history, and start battles against other characters by clicking the “Start Battle” button.
2. Using OpenAI’s API, the AI is provided with the user’s character information and the opponent’s character information stored on the backend; the AI compares the descriptions to determine the winner.
2-1. The battle result is sent to the frontend; the win/loss record is updated in the user’s history, and the stored user rank information is updated accordingly.
3. When the “Start Battle” button is pressed, steps 2 and 2-1 are repeated.

##Technical Overview
Frontend:    Vite + React + TypeScript
Web3 Library:    Wagmi / Viem (Full support for Monad EVM compatibility)
Auth:    Privy (Google Login + Embedded Wallet)
Smart Contract:    Solidity + Foundry
Backend/DB: Supabase (For rapid MVP development)
AI: OpenAI API (GPT-4o)
