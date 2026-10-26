'use client'

// READ.VIDE3 → 2 → 1 → O countdown, typed email subtitle, click-to-copy.
// Same identity as V1, rebuilt with React state instead of DOM-by-tag lookups.
import { useEffect, useRef, useState } from 'react'

const EMAIL = 'Mike@Read.video'

const MESSAGES = [
  "I can't wait to have a chat!",
  "Look'n forward to hearing from ya!",
  "Don't be a stranger :D",
  "I'd love to hear from you!",
  "Let's keep in touch!",
  "Can't wait to hear your thoughts!",
  "Chat with you soon!",
  "Let's chat soon!",
  "Keep me posted on your adventures!",
  "Take care and let's speak soon!",
  "You're awesome—thanks for reaching out!",
  "Ping me anytime, I'm around!",
  "So excited to connect with you!",
  "Appreciate you—talk soon!",
  "This is going to be fun—let's chat!",
  "Can't wait—this will be great!",
  "You're the best—talk soon!"
]

export default function Header() {
  const [count, setCount] = useState<'3' | '2' | '1' | 'O'>('3')
  const [subtitle, setSubtitle] = useState('')
  const [blinking, setBlinking] = useState(false)
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([])

  const later = (fn: () => void, ms: number) => {
    timeouts.current.push(setTimeout(fn, ms))
  }

  useEffect(() => {
    // Countdown: 3 → 2 → 1 → O, then blink the dot and type the email
    later(() => setCount('2'), 1000)
    later(() => setCount('1'), 2000)
    later(() => {
      setCount('O')
      setBlinking(true)
    }, 3000)

    // Humanly-typed subtitle (ported speeds: slower before '@', 'R', '.')
    const type = (i: number) => {
      if (i >= EMAIL.length) return
      setSubtitle(EMAIL.slice(0, i + 1))
      const nextChar = EMAIL.charAt(i + 1)
      let speed = Math.floor(Math.random() * 50) + 50
      if (nextChar === '@' || nextChar === 'R') speed = 300
      else if (nextChar === '.') speed = 200
      later(() => type(i + 1), speed)
    }
    later(() => type(0), 4000)

    const captured = timeouts.current
    return () => captured.forEach(clearTimeout)
  }, [])

  const handleEmailClick = () => {
    navigator.clipboard.writeText(EMAIL).catch(() => { /* clipboard unavailable */ })
    setSubtitle('EMAIL Copied to Clipboard!')
    later(() => {
      setSubtitle(MESSAGES[Math.floor(Math.random() * MESSAGES.length)])
      later(() => setSubtitle(EMAIL), 4000)
    }, 2000)
  }

  return (
    <div className="header">
      <h1>
        READ<span id="blink" className={blinking ? 'blink' : ''}>.</span>VIDE
        <span className={count === 'O' ? '' : 'countdown-padding'}>{count}</span>
      </h1>
      <h2 className="subHeader" onClick={handleEmailClick}>{subtitle}</h2>
    </div>
  )
}
