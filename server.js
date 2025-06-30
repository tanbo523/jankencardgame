// server.js
const { createServer } = require('http');
const { Server } = require('socket.io');
const sharp = require('sharp');
const sanitizeHtml = require('sanitize-html');

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

// セキュリティ設定
const MAX_DECK_SIZE = 7;
const MAX_NAME_LENGTH = 30;
const MAX_MOVE_NAME_LENGTH = 30;
const MAX_IMAGE_URL_LENGTH = 500 * 1024; // 500KB

// デッキデータのバリデーション関数
const validateDeck = (deck) => {
  if (!Array.isArray(deck) || deck.length > MAX_DECK_SIZE) { // デッキの最大枚数チェック
    console.warn('Validation failed: Deck is not a valid array or exceeds max size.');
    return false;
  }
  for (const card of deck) {
    if (typeof card !== 'object' || card === null) {
      console.warn('Validation failed: Card is not a valid object.');
      return false;
    }

    const { id, name, imageUrl, hand, moveName } = card;

    if (typeof id !== 'string' || 
        typeof name !== 'string' || name.length > MAX_NAME_LENGTH ||
        typeof moveName !== 'string' || moveName.length > MAX_MOVE_NAME_LENGTH) {
      console.warn('Validation failed: Invalid card properties type or length.');
      return false;
    }
    
    if (!['fire', 'water', 'grass'].includes(hand)) {
      console.warn('Validation failed: Invalid hand type.');
      return false;
    }

    if (typeof imageUrl !== 'string' || !imageUrl.startsWith('data:image/') || imageUrl.length > MAX_IMAGE_URL_LENGTH) {
      console.warn('Validation failed: Invalid imageUrl format or size.');
      return false;
    }
  }
  return true;
};

// デッキデータのサニタイズと画像処理を行う関数
const sanitizeAndProcessDeck = async (deck) => {
  const sanitizedDeck = [];
  for (const card of deck) {
    const sanitizedCard = { ...card };

    // XSS対策: テキスト入力からHTMLタグを除去
    const sanitizeOptions = { allowedTags: [], allowedAttributes: {} };
    sanitizedCard.name = sanitizeHtml(card.name, sanitizeOptions);
    sanitizedCard.moveName = sanitizeHtml(card.moveName, sanitizeOptions);

    // XSS/DoS対策: 画像を再処理して安全な形式に変換
    try {
      const base64Data = card.imageUrl.split(';base64,').pop();
      if (!base64Data) throw new Error('Invalid base64 string');
      
      const imageBuffer = Buffer.from(base64Data, 'base64');

      const processedImageBuffer = await sharp(imageBuffer)
        .resize(200, 280, { fit: 'inside', withoutEnlargement: true }) // 過度に大きい画像をリサイズ
        .webp({ quality: 80 }) // WebP形式に変換して軽量化
        .toBuffer();

      sanitizedCard.imageUrl = `data:image/webp;base64,${processedImageBuffer.toString('base64')}`;
    } catch (error) {
      console.error('Image processing failed for a card:', error);
      // エラーが発生した場合、このカードの処理を中断し、デッキ全体を無効とする
      throw new Error(`Failed to process image for card: ${card.name}`);
    }

    sanitizedDeck.push(sanitizedCard);
  }
  return sanitizedDeck;
};

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
  socket.on('join-battle-room', async ({ roomId, deck }) => {
    // === 1. バリデーション処理 ===
    if (!validateDeck(deck)) {
      console.error(`Invalid deck data received from socket ${socket.id}. Disconnecting.`);
      // 不正なデータを送ってきたクライアントは切断するなどの対応
      socket.disconnect();
      return;
    }
    
    const room = rooms[roomId];
    // ルームが存在し、かつ、このソケットがそのルームのプレイヤーであることを確認
    if (!room || !room.players[socket.id]) {
      console.warn(`[join-battle-room] Unauthorized attempt by ${socket.id} for room ${roomId}`);
      socket.emit('room-error', '不正な操作、またはルームの有効期限が切れました。');
      socket.disconnect();
      return;
    }

    try {
      // === 2. サニタイズと画像処理 ===
      const sanitizedDeck = await sanitizeAndProcessDeck(deck);

      // ルームが存在する場合は必ず自分のエントリを作る
      if (room) {
        if (!room.players[socket.id]) {
          room.players[socket.id] = {};
        }
        room.players[socket.id].deck = sanitizedDeck; // サニタイズ済みのデッキを保存
        console.log(`Player ${socket.id} in room ${roomId} submitted their sanitized deck.`);

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
    } catch (error) {
      console.error(`Deck processing failed for socket ${socket.id}:`, error.message);
      socket.emit('room-error', 'デッキの処理中にエラーが発生しました。カード画像が破損しているか、不正なデータである可能性があります。');
      socket.disconnect();
      return;
    }
  });

  // カードプレイ受付・勝敗判定
  socket.on('play-card', ({ roomId, card }) => {
    console.log(`[play-card] from ${socket.id} in room ${roomId}:`, card);
    const room = rooms[roomId];
    if (!room) {
      console.log(`[play-card] room ${roomId} not found`);
      return;
    }
    
    if (!room.round) room.round = {};
    room.round[socket.id] = card;

    //room.roundの中身を表示
    console.log(`[play-card] room.round: ${JSON.stringify(room.round)}`);
    console.log(`[play-card] room.players: ${JSON.stringify(Object.keys(room.players))}`);
    console.log(`[play-card] Object.keys(room.round).length: ${Object.keys(room.round).length}`);

    // 2人揃ったら進行
    if (Object.keys(room.round).length === 2) {
      console.log('==> 2人分揃ったので勝敗判定に進みます');
      const ids = Object.keys(room.round); 
      const card1 = room.round[ids[0]];
      const card2 = room.round[ids[1]];
      // 勝敗判定ロジック (from src/utils/game.ts)
      const getResult = (playerHand, opponentHand) => {
        // 同じタイプの場合：45%勝利, 10%引き分け, 45%敗北
        if (playerHand === opponentHand) {
          const rand = Math.random();
          if (rand < 0.45) return 'win';
          if (rand < 0.9) return 'lose';
          return 'draw';
        }

        const rand = Math.random();

        // プレイヤーが有利な場合：65%勝利, 5%引き分け, 30%敗北
        if (
          (playerHand === 'water' && opponentHand === 'fire') ||
          (playerHand === 'fire' && opponentHand === 'grass') ||
          (playerHand === 'grass' && opponentHand === 'water')
        ) {
          if (rand < 0.65) return 'win';
          if (rand < 0.7) return 'draw';
          return 'lose';
        }
        // プレイヤーが不利な場合：30%勝利, 5%引き分け, 65%敗北
        else {
          if (rand < 0.3) return 'win';
          if (rand < 0.35) return 'draw';
          return 'lose';
        }
      };
      
      const result1 = getResult(card1.hand, card2.hand);
      let result2;
      if (result1 === 'win') {
        result2 = 'lose';
      } else if (result1 === 'lose') {
        result2 = 'win';
      } else {
        result2 = 'draw';
      }

      console.log('battle-result送信:', ids[0], result1, ids[1], result2);
      // 結果を両者に送信
      io.to(ids[0]).emit('battle-result', { myCard: card1, opponentCard: card2, result: result1 });
      io.to(ids[1]).emit('battle-result', { myCard: card2, opponentCard: card1, result: result2 });
      // 次ラウンドのためにroom.roundをリセット
      room.round = {};
      console.log('==> room.round reset for next round');
    } else {
      console.log(`==> まだ${Object.keys(room.round).length}人分しか揃っていません`);
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    // すべてのルームを走査して該当プレイヤーを削除
    for (const roomId in rooms) {
      const room = rooms[roomId];
      
      // room.playersから削除
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        console.log(`disconnect: removed ${socket.id} from room.players`);
        
        // ルームが空になったら削除
        if (Object.keys(room.players).length === 0) {
          delete rooms[roomId];
          console.log(`disconnect: room ${roomId} deleted (empty)`);
        }
      }
      
      // room.roundからも必ず削除（playersに存在しなくても）
      if (room.round && room.round[socket.id]) {
        delete room.round[socket.id];
        console.log(`disconnect: removed ${socket.id} from room.round`);
        console.log(`disconnect: room.round after: ${JSON.stringify(room.round)}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});