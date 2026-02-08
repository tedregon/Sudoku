# Multiplayer Sudoku Game

A web-first multiplayer Sudoku game with room-based gameplay, real-time synchronization, and multiple difficulty levels.

## Features

- 🎮 **Room-based Multiplayer**: Join games with room codes
- 🎯 **5 Difficulty Levels**: From Very Easy to Very Hard
- ⏱️ **Timer**: Track time per player (starts on first move)
- 📊 **Progress Tracking**: See your progress and other players' progress
- 🎨 **Number Highlighting**: Visual feedback for number placement
- 🔢 **Candidates Toggle**: Show/hide possible numbers
- 🖱️ **Mouse-Only Interaction**: No keyboard required

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + Socket.io
- **Real-time**: WebSocket communication via Socket.io

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

Run both frontend and backend:

```bash
npm run dev
```

Or run separately:

```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

### Building

```bash
npm run build
```

## Project Structure

```
Sudoku/
├── frontend/     # React frontend application
├── backend/      # Node.js backend server
└── package.json # Root workspace configuration
```
