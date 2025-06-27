// server.js
const { createServer } = require('http');
const { Server } = require('socket.io');

const httpServer = createServer((req, res) => {
  // ヘルスチェック用のエンドポイント
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      message: 'Socket.IO server is running',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", // Next.jsの開発サーバーのURL
    "https://jkncgame.netlify.app" // 本番用
    ],
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 5e6 // 5MBまで許可
});

const rooms = {};

// 4桁のランダムなルームIDを生成
const generateRoomId = () => {
  let roomId;
  do {
    // 6桁の英数字（大文字）を生成
    roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (rooms[roomId]); // 念のため重複チェック
  return roomId;
};

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // ルーム作成（/onlineページ用）
  socket.on('create-room', () => {
    const roomId = generateRoomId();
    socket.join(roomId);
    // 新しいデータ構造でプレイヤー情報を初期化
    rooms[roomId] = { players: { [socket.id]: {} }, status: 'waiting' };
    socket.emit('room-created', roomId);
    console.log(`Room created: ${roomId} by ${socket.id}`);
  });

  // ルーム参加（/onlineページ用）
  socket.on('join-room', (roomId) => {
    const room = rooms[roomId];
    if (room && Object.keys(room.players).length < 2) {
      socket.join(roomId);
      room.players[socket.id] = {}; // 参加者の情報を追加
      // 参加者とルームの全員にマッチング完了を通知
      io.to(roomId).emit('game-start');
      console.log(`${socket.id} joined room: ${roomId}`);
    } else {
      socket.emit('room-error', 'ルームが存在しないか、満員です。');
    }
  });

  // バトルルームへの参加とデッキ情報の交換（/battleページ用）
  socket.on('join-battle-room', ({ roomId, deck }) => {
    const room = rooms[roomId];
    // ルームが存在する場合は必ず自分のエントリを作る
    if (room) {
      if (!room.players[socket.id]) {
        room.players[socket.id] = {};
      }
      room.players[socket.id].deck = deck;
      console.log(`Player ${socket.id} in room ${roomId} submitted their deck.`);

      const playerIds = Object.keys(room.players);
      // 2人揃っているか確認
      if (playerIds.length === 2) {
        const player1 = room.players[playerIds[0]];
        const player2 = room.players[playerIds[1]];

        // 2人ともデッキ情報を送信済みか確認
        if (player1.deck && player2.deck) {
          console.log(`Both players in room ${roomId} are ready. Starting battle.`);
          // 各プレイヤーに相手のデッキ情報を送信
          io.to(playerIds[0]).emit('battle-start', { opponentDeck: player2.deck });
          io.to(playerIds[1]).emit('battle-start', { opponentDeck: player1.deck });
        }
      }
    }
  });

  // カードプレイ受付・勝敗判定
  socket.on('play-card', ({ roomId, card }) => {
    console.log(`[play-card] from ${socket.id} in room ${roomId}:`, card);
    const room = rooms[roomId];
    if (!room) return;
    if (!room.round) room.round = {};
    room.round[socket.id] = card;

    //room.roundの中身を表示
    console.log('room.round:', room.round);

    // 2人揃ったら進行
    if (Object.keys(room.round).length === 2) {
      console.log('==> 2人分揃ったので勝敗判定に進みます');
      const ids = Object.keys(room.round); 
      const card1 = room.round[ids[0]];
      const card2 = room.round[ids[1]];
      // 勝敗判定ロジック
      const getResult = (a, b) => {
        if (a.hand === b.hand) return 'draw';
        if (
          (a.hand === 'fire' && b.hand === 'grass') ||
          (a.hand === 'water' && b.hand === 'fire') ||
          (a.hand === 'grass' && b.hand === 'water')
        ) return 'win';
        return 'lose';
      };
      const result1 = getResult(card1, card2);
      const result2 = getResult(card2, card1);
      console.log('battle-result送信:', ids[0], result1, ids[1], result2);
      // 結果を両者に送信
      io.to(ids[0]).emit('battle-result', { myCard: card1, opponentCard: card2, result: result1 });
      io.to(ids[1]).emit('battle-result', { myCard: card2, opponentCard: card1, result: result2 });
      // 次ラウンドのためにroom.roundをリセット
      room.round = {};
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    // すべてのルームを走査して該当プレイヤーを削除
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        // ルームが空になったら削除
        if (Object.keys(room.players).length === 0) {
          delete rooms[roomId];
        }
              // 追加: disconnect時にroom.roundからも削除
      if (room.round && room.round[socket.id]) {
        delete room.round[socket.id];
      }
      }
    }
  });
});

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});