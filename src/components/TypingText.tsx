'use client'

import { useEffect, useState } from 'react'

const RANDOM_MESSAGES = [
    "Can't wait to have a chat!",
    "Look'n forward to hearing from ya!",
    "Don't be a stranger :D",
    "I'd love to hear from you!",
    "Let's keep in touch!",
    "Can't wait to hear your thoughts!",
    "Chat with you soon!",
    "Let's chat soon!",
    "Keep me posted on your adventures!",
    "Take care and let's speak soon!",
]

export function TypingText() {
    const [displayText, setDisplayText] = useState('')
    const [isTyping, setIsTyping] = useState(true)
    const [clicked, setClicked] = useState(false)

    const email = 'mike@read.video'

    useEffect(() => {
        if (!isTyping) return

        let index = 0
        const typeInterval = setInterval(() => {
            if (index < email.length) {
                setDisplayText(prev => prev + email[index])
                index++
            } else {
                setIsTyping(false)
                clearInterval(typeInterval)
            }
        }, 100)

        return () => clearInterval(typeInterval)
    }, [isTyping])

    const handleClick = async () => {
        if (clicked) return

        try {
            await navigator.clipboard.writeText(email)
            setClicked(true)
            setDisplayText("Email copied to clipboard!")

            setTimeout(() => {
                const randomMessage = RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)]
                setDisplayText(randomMessage)

                setTimeout(() => {
                    setDisplayText(email)
                    setClicked(false)
                }, 4000)
            }, 2000)
        } catch {
            console.error('Failed to copy email')
        }
    }

    return (
        <div className="text-center text-white pointer-events-auto">
            <h2
                className="text-2xl md:text-3xl cursor-pointer hover:text-blue-300 transition-colors duration-300 font-mono"
                onClick={handleClick}
            >
                {displayText}
            </h2>
        </div>
    )
}
