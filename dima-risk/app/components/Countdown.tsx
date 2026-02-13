'use client';

import { useEffect, useState } from 'react';

export default function Countdown() {
  const launchDate = new Date('2026-12-31').getTime();

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = launchDate - now;

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor(
        (distance % (1000 * 60 * 60)) / (1000 * 60)
      );
      const seconds = Math.floor(
        (distance % (1000 * 60)) / 1000
      );

      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <ul id="timer">
      <li>
        <span>{timeLeft.days}</span>
        <p>Days</p>
      </li>
      <li className="seperator">:</li>
      <li>
        <span>{timeLeft.hours}</span>
        <p>Hours</p>
      </li>
      <li className="seperator">:</li>
      <li>
        <span>{timeLeft.minutes}</span>
        <p>Minutes</p>
      </li>
      <li className="seperator">:</li>
      <li>
        <span>{timeLeft.seconds}</span>
        <p>Seconds</p>
      </li>
    </ul>
  );
}
