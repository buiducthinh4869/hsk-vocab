// speechSynthesis with a zh-CN voice.
let voice = null;
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

function pick() {
  if (!synth) return;
  const vs = synth.getVoices();
  voice = vs.find((v) => /^zh[-_]CN/i.test(v.lang)) || vs.find((v) => /^zh/i.test(v.lang) && !/HK|TW/i.test(v.lang)) || vs.find((v) => /^zh/i.test(v.lang)) || null;
}

export function initTts(onChange) {
  if (!synth) return;
  pick();
  synth.addEventListener?.('voiceschanged', () => { pick(); onChange?.(); });
}
export const hasVoice = () => !!voice;

export function speak(text, rate = 0.9) {
  if (!synth || !text) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(/\*/g, ''));
  u.lang = 'zh-CN';
  if (voice) u.voice = voice;
  u.rate = rate;
  synth.speak(u);
}
