'use client';

import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '../_socket';
import { useRouter } from 'next/navigation';
import React from 'react';

export default function OnlinePage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState('接続中...');
  const [roomId, setRoomId] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const socket = getSocket();
    const handleReconnect = () => {
      if (roomId) {
        socket.emit('join-room', roomId);
        // 必要なら setStatus('再接続しました') など
      }
    };
    socket.on('reconnect', handleReconnect);
    return () => {
      socket.off('reconnect', handleReconnect);
    };
  }, [roomId]);

  // ルームIDをrefで管理することで、コールバック内でも最新の値を参照できるようにする
  const roomIdRef = React.useRef(roomId);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const handleGameStart = useCallback(() => {
    // refから最新のルームIDを取得
    const currentRoomId = roomIdRef.current;
    console.log(`Game starting in room: ${currentRoomId}`);
    if (currentRoomId) {
      router.push(`/battle?room=${currentRoomId}&online=true`);
    }
  }, [router]);

  useEffect(() => {
    const newSocket = getSocket();
    setSocket(newSocket);

    const onConnect = () => setStatus(`接続済み (ID: ${newSocket.id})`);
    const onDisconnect = () => setStatus('切断');
    const onRoomCreated = (newRoomId: string) => {
      setRoomId(newRoomId);
      setStatus(`ルーム作成完了！ ID: ${newRoomId} (相手の参加を待っています...)`);
    };
    const onRoomError = (errorMessage: string) => setError(errorMessage);

    newSocket.on('connect', onConnect);
    newSocket.on('disconnect', onDisconnect);
    newSocket.on('room-created', onRoomCreated);
    newSocket.on('room-error', onRoomError);
    newSocket.on('game-start', handleGameStart);

    return () => {
      newSocket.off('connect', onConnect);
      newSocket.off('disconnect', onDisconnect);
      newSocket.off('room-created', onRoomCreated);
      newSocket.off('room-error', onRoomError);
      newSocket.off('game-start', handleGameStart);
    };
  }, [handleGameStart]);

  const handleCreateRoom = () => {
    setError('');
    socket?.emit('create-room');
  };

  const handleJoinRoom = () => {
    setError('');
    if (inputRoomId.trim()) {
      const targetRoomId = inputRoomId.trim().toUpperCase();
      setRoomId(targetRoomId); // 参加者が自分のroomIdをセットするために必要
      socket?.emit('join-room', targetRoomId);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 pt-20 sm:p-24">
      <h1 className="text-2xl sm:text-4xl font-bold mb-6 sm:mb-8 text-center">オンライン対戦</h1>

      <div className="mb-6 sm:mb-8 p-2 sm:p-4 border rounded-lg text-center w-full max-w-xs sm:max-w-sm">
        <p>サーバーとの接続状態: <span className="font-bold">{status}</span></p>
        {roomId && <p className="mt-2">ルームID: <span className="font-bold text-blue-500 break-all">{roomId}</span></p>}
        {error && <p className="mt-2 text-red-500 font-bold">{error}</p>}
      </div>

      {/* ルーム待機中はボタンを非表示にする */}
      {!roomId && (
        <>
          <div className="w-full max-w-xs sm:max-w-sm p-4 sm:p-8 border rounded-lg shadow-lg mb-4">
            <h2 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-6 text-center">ルームを作成する</h2>
            <button onClick={handleCreateRoom} className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-base sm:text-lg">
              ルームを作成
            </button>
          </div>

          <div className="my-4 sm:my-8 text-center text-base sm:text-xl font-bold">OR</div>

          <div className="w-full max-w-xs sm:max-w-sm p-4 sm:p-8 border rounded-lg shadow-lg">
            <h2 className="text-lg sm:text-2xl font-bold mb-2 sm:mb-4 text-center">ルームに参加する</h2>
            <div className="flex flex-col gap-2 sm:gap-4">
              <input
                type="text"
                placeholder="ルームIDを入力"
                className="w-full border p-2 rounded text-center text-base sm:text-lg"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value)}
              />
              <button onClick={handleJoinRoom} className="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-base sm:text-lg">
                ルームに参加
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
} 