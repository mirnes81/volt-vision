// Emergency sound generator using Web Audio API
// Creates a distinctive urgent alarm sound

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Check if current time is outside work hours
 * Work hours: Monday-Friday, 7:00 - 18:00
 */
export function isOutsideWorkHours(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = now.getHours();
  
  // Weekend
  if (day === 0 || day === 6) return true;
  
  // Before 7:00 or after 18:00
  if (hour < 7 || hour >= 18) return true;
  
  return false;
}

/**
 * Play a standard notification beep
 */
export function playNotificationBeep(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = 880; // A5
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn('[EmergencySound] Standard beep failed:', e);
  }
}

/**
 * Play an urgent alarm sound (multiple tones, louder, longer)
 * Used outside work hours
 */
export function playUrgentAlarm(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const playTone = (frequency: number, startTime: number, duration: number, volume: number = 0.5) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'square'; // More "alarm-like" sound
      
      gainNode.gain.setValueAtTime(volume, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    
    const now = ctx.currentTime;
    
    // Play alternating high-low alarm pattern (3 cycles)
    for (let i = 0; i < 3; i++) {
      const offset = i * 0.6;
      playTone(1000, now + offset, 0.25, 0.4);       // High tone
      playTone(600, now + offset + 0.3, 0.25, 0.4);  // Low tone
    }
    
  } catch (e) {
    console.warn('[EmergencySound] Urgent alarm failed:', e);
  }
}

/**
 * Play the appropriate emergency sound based on time of day
 */
export function playEmergencySound(): void {
  if (isOutsideWorkHours()) {
    console.log('[EmergencySound] Outside work hours - playing URGENT alarm');
    playUrgentAlarm();
  } else {
    console.log('[EmergencySound] During work hours - playing standard beep');
    playNotificationBeep();
  }
}

/**
 * Play a success sound when claiming an emergency
 */
export function playSuccessSound(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.25, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    
    const now = ctx.currentTime;
    // Ascending success jingle
    playTone(523, now, 0.15);        // C5
    playTone(659, now + 0.15, 0.15); // E5
    playTone(784, now + 0.3, 0.3);   // G5
    
  } catch (e) {
    console.warn('[EmergencySound] Success sound failed:', e);
  }
}
