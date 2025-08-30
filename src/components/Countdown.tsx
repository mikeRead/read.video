'use client'

import { useEffect, useState } from 'react'

interface CountdownProps {
    onComplete: () => void
}

export function Countdown({ onComplete }: CountdownProps) {
    const [time, setTime] = useState(3)
    const [showPeriod, setShowPeriod] = useState(false)

    useEffect(() => {
        const interval = setInterval(() => {
            setTime(prev => {
                if (prev <= 1) {
                    clearInterval(interval)
                    setShowPeriod(true)
                    setTimeout(onComplete, 1000)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [onComplete])

    return (
        <div className="text-center text-white">
            <h1 className="text-6xl md:text-8xl font-bold mb-4">
                READ<span className="text-red-500 animate-pulse">.</span>VIDE
                <span className="ml-2 text-4xl md:text-6xl">
                    {time === 0 ? 'O' : time}
                </span>
            </h1>
            {showPeriod && (
                <div className="text-2xl text-red-500 animate-pulse">
                    Ready for takeoff...
                </div>
            )}
        </div>
    )
}
