const actionButtons = [
  { label: 'Where Am I?', color: '#10713F', textColor: '#fff' },
  { label: 'Calm Me', color: '#8FE2DF', textColor: '#0F4F3D' },
  { label: 'Need Help', color: '#D2A600', textColor: '#1F3F2E' },
  { label: 'My Checklist', color: '#E8E3D7', textColor: '#20382D' },
];

const routineItems = [
  { label: 'Wake Up & Morning Stretch', time: '7:00 AM', status: 'done' },
  { label: 'Take Morning Medication', time: '7:30 AM', status: 'done' },
  { label: 'Breakfast', time: '8:00 AM', status: 'current' },
  { label: 'Video Call with Son', time: '9:00 AM', status: 'upcoming' },
  { label: 'Garden Walk', time: '10:30 AM', status: 'upcoming' },
];

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="small-label">Good Afternoon</p>
          <h1>Margaret</h1>
        </div>

        <div className="top-actions">
          <button className="lang-button">English</button>
          <button className="icon-button" aria-label="Notifications">
            🔔
          </button>
          <button className="icon-button" aria-label="Settings">
            ⚙️
          </button>
        </div>
      </header>

      <section className="action-grid">
        {actionButtons.map((button) => (
          <button
            key={button.label}
            className="action-card"
            style={{ backgroundColor: button.color, color: button.textColor }}
          >
            {button.label}
          </button>
        ))}
      </section>

      <section className="routine-card">
        <div className="routine-header">
          <div>
            <p className="small-label">Today's Routine</p>
          </div>
          <button className="text-link">View All →</button>
        </div>

        <div className="routine-list">
          {routineItems.map((item) => (
            <div key={item.label} className={`routine-item ${item.status}`}>
              <div className="routine-item-left">
                <span className="status-icon" aria-hidden="true">
                  {item.status === 'done' ? '✔️' : item.status === 'current' ? '◉' : '○'}
                </span>

                <div>
                  <p className={`item-label ${item.status}`}>{item.label}</p>
                  <p className={`item-time ${item.status === 'done' ? 'completed' : ''}`}>
                    {item.time}
                  </p>
                </div>
              </div>

              {item.status === 'current' ? <span className="pill">Current</span> : null}
            </div>
          ))}
        </div>
      </section>

      <button className="mic-button" aria-label="Voice command">
        🎙️
      </button>
    </div>
  );
}
