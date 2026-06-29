const fs = require('fs');
const path = require('path');

const duration = 2; // seconds
const sampleRate = 44100;
const numChannels = 1;
const bitsPerSample = 16;
const numSamples = duration * sampleRate;
const dataSize = numSamples * numChannels * (bitsPerSample / 8);
const buffer = Buffer.alloc(44 + dataSize);

// RIFF chunk descriptor
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);

// fmt sub-chunk
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // Subchunk1Size
buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
buffer.writeUInt16LE(numChannels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // ByteRate
buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // BlockAlign
buffer.writeUInt16LE(bitsPerSample, 34);

// data sub-chunk
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

// Generate audio data (beep sequence: beep-pause-beep-pause)
let offset = 44;
const freq = 880; // A5
for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  
  // Create a pattern: 0.2s beep, 0.2s pause
  const cycle = t % 0.4;
  const isActive = cycle < 0.2;
  
  let val = 0;
  if (isActive) {
    // Sine wave
    val = Math.sin(2 * Math.PI * freq * t) * 32767 * 0.8; 
  }
  
  buffer.writeInt16LE(val, offset);
  offset += 2;
}

const dir = path.join(__dirname, 'android/app/src/main/res/raw');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'pomoduo_alarm.wav'), buffer);
console.log('Successfully wrote pomoduo_alarm.wav to ' + dir);
