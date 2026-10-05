import { useState } from 'react';
import { ArrowRight, CheckCircle, Sparkle } from '@phosphor-icons/react';
import '../styles/guided-redesign.css';
import '../styles/onboarding-redesign.css';

interface SystemIntroScreenProps {
  onDone: () => void;
}

const slides = [
  { tag: '다시 시작', title: '실행이 끊겨도\n이어갈 수 있어요.', body: '멈춘 이유를 기록하고, 지금 가능한 한 걸음을 찾아요.', cta: '어떻게요?' },
  { tag: '실행 기록', title: '한 일도, 막힌 이유도\n다음 계획의 힌트.', body: '완료·부분완료·미실행을 남겨요. 기록한 이유를 바탕으로 다음에 시도할 방법을 살펴봐요.', cta: '그래서?' },
  { tag: '직접 고르는 계획', title: '방법을 고르고,\n변경을 확인해요.', body: '크기를 줄이거나 시간을 옮길 수 있어요. 새 일정은 변경 내용을 확인하고 승인한 뒤 반영해요.', cta: '시작하기' },
];

function IntroExample({ step }: { step: number }) {
  return <section className="guided-intro-example" aria-label="사용 흐름 예시">
    <span className="guided-kicker">이해를 돕기 위한 예시</span>
    {step === 0 ? <>
      <div className="guided-example-row"><span className="guided-example-number">01</span><div><small>멈춘 지점</small><h3>자기소개서 도입부 작성</h3><p>막막해서 시작하지 못했어요.</p></div></div>
      <div className="guided-example-bridge"><Sparkle size={18} /> 지금 가능한 크기로</div>
      <div className="guided-example-row guided-example-row--accent"><span className="guided-example-number">02</span><div><small>다음에 시도할 방법</small><h3>딱 3문장만 써보기</h3><p>작게 시작할 방법을 골라요.</p></div></div>
    </> : step === 1 ? <>
      {[['영어 단어 20개 암기', '완료'], ['자기소개서 도입부 작성', '미실행 · 막막함'], ['책 20페이지 읽기', '부분완료']].map(([title, state]) =>
        <div className="guided-example-row" key={title}><CheckCircle size={22} color="#4F46E5" /><div><h3>{title}</h3><p>{state}</p></div></div>)}
      <p className="guided-example-note">어디서 멈췄는지 알면 다음 방법을 고르기 쉬워져요.</p>
    </> : <>
      {[['01', '가능한 방법 선택', '오늘은 도입부 한 단락만'], ['02', '변경 내용 확인', '기존 계획과 바뀔 계획을 비교해요.'], ['03', '내가 직접 승인', '확인한 뒤 일정에 반영해요.']].map(([number, title, body]) =>
        <div className="guided-example-row" key={number}><span className="guided-example-number">{number}</span><div><h3>{title}</h3><p>{body}</p></div></div>)}
    </>}
  </section>;
}

export function SystemIntroScreen({ onDone }: SystemIntroScreenProps) {
  const [step, setStep] = useState(0);
  const slide = slides[step];
  return <div className="guided-surface guided-intro">
    <div className="guided-intro-inner">
      <div className="guided-wordmark"><Sparkle size={26} weight="fill" /> Re:Action</div>
      <div className="guided-intro-layout">
        <header className="guided-intro-heading" aria-live="polite">
          <span className="guided-kicker">{String(step + 1).padStart(2, '0')} / 03 · {slide.tag}</span>
          <h1>{slide.title}</h1><p>{slide.body}</p>
          <ol className="guided-intro-progress" aria-label="사용법 안내 단계">
            {slides.map((item, index) => <li key={item.tag} aria-current={index === step ? 'step' : undefined}>{item.tag}</li>)}
          </ol>
        </header>
        <IntroExample step={step} />
      </div>
      <footer className="guided-intro-actions">
        <p>나의 속도로, 한 걸음씩.</p>
        <div>{step > 0 && <button className="guided-onboarding-secondary" onClick={() => setStep(step - 1)}>이전</button>}
          <button className="guided-onboarding-primary" onClick={() => step < slides.length - 1 ? setStep(step + 1) : onDone()}>{slide.cta}<ArrowRight size={18} /></button>
        </div>
      </footer>
    </div>
  </div>;
}
