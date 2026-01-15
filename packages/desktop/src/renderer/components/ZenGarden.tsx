export function ZenGarden() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none zen-drift">
      <div className="absolute top-10 left-10 animate-float-slow opacity-30">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path
            d="M20 5 C 30 10, 35 20, 30 30 C 25 35, 15 35, 10 30 C 5 20, 10 10, 20 5 Z"
            fill="#A5B574"
            className="animate-pulse-gentle"
          />
        </svg>
      </div>

      <div className="absolute top-1/4 right-20 animate-float-medium opacity-25" style={{ animationDelay: '2s' }}>
        <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
          <path
            d="M25 8 C 38 13, 42 25, 37 37 C 30 43, 20 43, 13 37 C 8 25, 12 13, 25 8 Z"
            fill="#A5B574"
            className="animate-pulse-gentle"
          />
        </svg>
      </div>

      <div className="absolute bottom-1/3 left-1/4 animate-float-slow opacity-20" style={{ animationDelay: '4s' }}>
        <svg width="35" height="35" viewBox="0 0 35 35" fill="none">
          <path
            d="M17.5 5 C 26 9, 30 17.5, 26 26 C 21 30, 14 30, 9 26 C 5 17.5, 9 9, 17.5 5 Z"
            fill="#C87137"
            opacity="0.6"
          />
        </svg>
      </div>

      <div className="absolute top-1/2 right-1/3 animate-float-medium opacity-25" style={{ animationDelay: '1s' }}>
        <svg width="45" height="45" viewBox="0 0 45 45" fill="none">
          <path
            d="M22.5 6 C 33 11, 38 22.5, 33 33 C 27 38, 18 38, 12 33 C 7 22.5, 11 11, 22.5 6 Z"
            fill="#A5B574"
          />
        </svg>
      </div>

      <div className="absolute bottom-20 right-1/4 animate-float-slow opacity-30" style={{ animationDelay: '3s' }}>
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
          <path
            d="M19 5 C 28 9, 33 19, 28 28 C 23 33, 15 33, 10 28 C 5 19, 9 9, 19 5 Z"
            fill="#A5B574"
          />
        </svg>
      </div>

      <div className="absolute top-0 right-0 opacity-15">
        <svg width="300" height="300" viewBox="0 0 300 300" fill="none">
          <path
            d="M 300 0 Q 280 30, 260 60 Q 240 90, 220 120"
            stroke="#3E2F27"
            strokeWidth="3"
            fill="none"
            className="animate-sway-gentle"
          />
          <path
            d="M 260 60 Q 240 70, 220 80"
            stroke="#3E2F27"
            strokeWidth="2"
            fill="none"
            className="animate-sway-gentle"
            style={{ animationDelay: '0.5s' }}
          />
          <circle cx="220" cy="80" r="8" fill="#A5B574" opacity="0.6" className="animate-pulse-gentle" />
          <circle
            cx="230"
            cy="100"
            r="6"
            fill="#A5B574"
            opacity="0.5"
            className="animate-pulse-gentle"
            style={{ animationDelay: '0.3s' }}
          />
        </svg>
      </div>

      <div className="absolute bottom-0 left-0 opacity-15">
        <svg width="300" height="300" viewBox="0 0 300 300" fill="none">
          <path
            d="M 0 300 Q 30 270, 60 240 Q 90 210, 120 180"
            stroke="#3E2F27"
            strokeWidth="3"
            fill="none"
            className="animate-sway-gentle"
          />
          <path
            d="M 60 240 Q 80 220, 100 200"
            stroke="#3E2F27"
            strokeWidth="2"
            fill="none"
            className="animate-sway-gentle"
            style={{ animationDelay: '0.7s' }}
          />
          <circle cx="100" cy="200" r="7" fill="#A5B574" opacity="0.6" className="animate-pulse-gentle" />
          <circle
            cx="80"
            cy="220"
            r="5"
            fill="#A5B574"
            opacity="0.5"
            className="animate-pulse-gentle"
            style={{ animationDelay: '0.4s' }}
          />
        </svg>
      </div>

      <div className="absolute top-0 left-1/3 opacity-10">
        <svg width="60" height="400" viewBox="0 0 60 400" fill="none">
          <line x1="30" y1="0" x2="30" y2="400" stroke="#3E2F27" strokeWidth="4" className="animate-sway-gentle" />
          <line x1="30" y1="100" x2="50" y2="100" stroke="#3E2F27" strokeWidth="2" />
          <line x1="30" y1="200" x2="50" y2="200" stroke="#3E2F27" strokeWidth="2" />
          <line x1="30" y1="300" x2="50" y2="300" stroke="#3E2F27" strokeWidth="2" />
        </svg>
      </div>

      <div className="absolute top-0 right-1/4 opacity-10">
        <svg width="60" height="400" viewBox="0 0 60 400" fill="none">
          <line
            x1="30"
            y1="0"
            x2="30"
            y2="400"
            stroke="#3E2F27"
            strokeWidth="4"
            className="animate-sway-gentle"
            style={{ animationDelay: '1s' }}
          />
          <line x1="30" y1="120" x2="10" y2="120" stroke="#3E2F27" strokeWidth="2" />
          <line x1="30" y1="240" x2="10" y2="240" stroke="#3E2F27" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}
