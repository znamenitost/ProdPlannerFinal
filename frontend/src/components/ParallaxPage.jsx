import { useRef } from 'react';
import fon2Url from '../../../sprites/fon2.svg';
import fon3Url from '../../../sprites/fon3.svg';
import fon5Url from '../../../sprites/fon5.svg';
import sunUrl from '../../../sprites/sun.svg';
import './LoginForm.css';

const FON1_URL = '/sprites/fon1.svg';

export default function ParallaxPage({ children, className = '' }) {
  const pageRef = useRef(null);

  const handleParallaxMove = (event) => {
    const page = pageRef.current;
    if (!page) return;

    const rect = page.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    page.style.setProperty('--layer-1-x', `${x * -13}px`);
    page.style.setProperty('--layer-1-y', `${y * -5}px`);
    page.style.setProperty('--layer-2-x', `${x * -30}px`);
    page.style.setProperty('--layer-2-y', `${y * -10}px`);
    page.style.setProperty('--layer-3-x', `${x * -50}px`);
    page.style.setProperty('--layer-3-y', `${y * -16}px`);
    page.style.setProperty('--layer-5-x', `${x * -84}px`);
    page.style.setProperty('--layer-5-y', `${y * -24}px`);
  };

  const resetParallax = () => {
    const page = pageRef.current;
    if (!page) return;

    page.style.setProperty('--layer-1-x', '0px');
    page.style.setProperty('--layer-1-y', '0px');
    page.style.setProperty('--layer-2-x', '0px');
    page.style.setProperty('--layer-2-y', '0px');
    page.style.setProperty('--layer-3-x', '0px');
    page.style.setProperty('--layer-3-y', '0px');
    page.style.setProperty('--layer-5-x', '0px');
    page.style.setProperty('--layer-5-y', '0px');
  };

  return (
    <main
      ref={pageRef}
      className={`login-parallax-page${className ? ` ${className}` : ''}`}
      onMouseMove={handleParallaxMove}
      onMouseLeave={resetParallax}
      style={{
        '--fon1-image': `url(${FON1_URL})`,
        '--fon2-image': `url(${fon2Url})`,
        '--fon3-image': `url(${fon3Url})`,
        '--fon5-image': `url(${fon5Url})`,
        '--sun-image': `url(${sunUrl})`
      }}
    >
      <img
        className="login-parallax-layer login-layer-fon1"
        src={FON1_URL}
        alt=""
        aria-hidden="true"
        fetchpriority="high"
        decoding="sync"
      />
      <img className="login-sun-layer" src={sunUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" fetchpriority="low" />
      <img className="login-parallax-layer login-layer-fon2" src={fon2Url} alt="" aria-hidden="true" loading="lazy" decoding="async" fetchpriority="low" />
      <img className="login-parallax-layer login-layer-fon3" src={fon3Url} alt="" aria-hidden="true" loading="lazy" decoding="async" fetchpriority="low" />
      <img className="login-parallax-layer login-layer-fon5" src={fon5Url} alt="" aria-hidden="true" loading="lazy" decoding="async" fetchpriority="low" />
      {children}
    </main>
  );
}
