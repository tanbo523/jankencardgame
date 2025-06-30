import { useState, useRef } from 'react';

export const useSound = () => {
  const [isMuted, setIsMuted] = useState(false);
  const [sfxVolume, setSfxVolume] = useState(0.5);
  
  const playSFX = (src: string) => {
    if (isMuted) return;
    
    const audio = new Audio(src);
    audio.volume = sfxVolume;
    audio.play().catch(error => {
      console.log('音声再生エラー:', error);
    });
  };
  
  const playCardSelect = () => {
    playSFX('/sounds/card-select.mp3');
  };
  
  const playButtonClick = () => {
    playSFX('/sounds/button-click.mp3');
  };
  
  // 戦闘音（バトル演出用）
  const playBattleFight = () => {
    playSFX('/sounds/battle-fight.mp3');
  };
  
  // バトル結果音（ラウンド結果表示時）
  const playBattleWin = () => {
    playSFX('/sounds/battle-win.mp3');
  };
  
  const playBattleLose = () => {
    playSFX('/sounds/battle-lose.mp3');
  };
  
  const playBattleDraw = () => {
    playSFX('/sounds/battle-draw.mp3');
  };
  
  // 最終結果音（ゲーム終了時）
  const playFinalWin = () => {
    playSFX('/sounds/final-win.mp3');
  };
  
  const playFinalLose = () => {
    playSFX('/sounds/final-lose.mp3');
  };
  
  const playFinalDraw = () => {
    playSFX('/sounds/final-draw.mp3');
  };
  
  return { 
    playCardSelect, 
    playButtonClick, 
    playBattleFight,
    playBattleWin,
    playBattleLose,
    playBattleDraw,
    playFinalWin,
    playFinalLose,
    playFinalDraw,
    isMuted, 
    setIsMuted, 
    sfxVolume, 
    setSfxVolume 
  };
}; 