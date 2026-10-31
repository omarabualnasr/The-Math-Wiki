import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { articleToText } from '../../engine/readerTools';
import type { MathArticle } from '../../types/article';

export default function ReadAloud({ article }: { article: MathArticle }) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [rate, setRate] = useState(1);
  const [state, setState] = useState<'idle' | 'speaking' | 'paused'>('idle');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechText = useMemo(() => articleToText(article)
    .replace(/\\sum/g, 'the sum of')
    .replace(/\\prod/g, 'the product of')
    .replace(/\\int/g, 'the integral of')
    .replace(/\\infty/g, 'infinity')
    .replace(/\\pi/g, 'pi')
    .replace(/\\theta/g, 'theta')
    .replace(/\\alpha/g, 'alpha')
    .replace(/\\beta/g, 'beta')
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, 'the square root of $1')
    .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1 divided by $2')
    .replace(/\\times|\\cdot/g, ' times ')
    .replace(/\\leq/g, ' less than or equal to ')
    .replace(/\\geq/g, ' greater than or equal to ')
    .replace(/\\neq/g, ' not equal to ')
    .replace(/\\approx/g, ' approximately equal to ')
    .replace(/\\rightarrow/g, ' approaches ')
    .replace(/\\left|\\right/g, '')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' '), [article]);

  useEffect(() => {
    if (!supported) return;
    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      if (!voiceURI) {
        const english = available.find((voice) => voice.lang.toLowerCase().startsWith('en'));
        if (english) setVoiceURI(english.voiceURI);
      }
    };
    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
  }, [supported, voiceURI]);

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [article.id, supported]);

  const stop = () => { if (supported) window.speechSynthesis.cancel(); utteranceRef.current = null; setState('idle'); };
  const play = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    const selectedVoice = voices.find((voice) => voice.voiceURI === voiceURI);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = rate;
    utterance.onstart = () => setState('speaking');
    utterance.onend = () => setState('idle');
    utterance.onerror = () => setState('idle');
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };
  const pause = () => {
    if (!supported) return;
    if (state === 'speaking') { window.speechSynthesis.pause(); setState('paused'); }
    else if (state === 'paused') { window.speechSynthesis.resume(); setState('speaking'); }
  };

  return <div className="read-aloud-controls read-aloud-soon" aria-label="Read aloud, coming soon" aria-disabled="true">
    <Volume2 size={14}/>
    <button className="article-action" type="button" disabled aria-disabled="true" onClick={state === 'idle' ? play : pause}>{state === 'speaking' ? <Pause size={13}/> : <Play size={13}/>}<span>Read aloud</span></button>
    <button className="article-action" type="button" disabled aria-label="Stop reading" onClick={stop}><Square size={12}/></button>
    <select aria-label="Reading speed" value={rate} disabled onChange={(event) => setRate(Number(event.target.value))}><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select>
    {voices.length > 0 && <select aria-label="Reading voice" value={voiceURI} disabled onChange={(event) => setVoiceURI(event.target.value)}><option value="">Default voice</option>{voices.filter((voice) => voice.lang.toLowerCase().startsWith('en')).map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}</option>)}</select>}
    <span className="soon-pill">Soon</span>
  </div>;
}
