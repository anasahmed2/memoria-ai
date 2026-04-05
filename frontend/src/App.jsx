import { useEffect, useMemo, useState } from 'react'
import {
  askChat,
  createCaregiverTask,
  deleteCaregiverTask,
  fetchCaregiverTasks,
  markTaskComplete,
} from './api'
import './App.css'

const quickActions = [
  { key: 'routine', label: 'What should I do now?', prompt: 'What should I do now?' },
  { key: 'calendar', label: 'What do I have today?', prompt: 'What do I have today?' },
  { key: 'location', label: 'Where am I?', prompt: 'Where am I?' },
  { key: 'calming', label: 'Need help', prompt: "I'm scared and I need help." },
]

const today = new Date().toISOString().slice(0, 10)

function App() {
  const [activeView, setActiveView] = useState('patient')
  const [chatInput, setChatInput] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'assistant',
      text: "Hi, I'm here to help you through your day. Tap a card or ask me anything.",
      intent: 'general',
      data: {},
      timestamp: new Date().toISOString(),
    },
  ])
  const [caregiverTasks, setCaregiverTasks] = useState([])
  const [isCaregiverLoading, setIsCaregiverLoading] = useState(false)
  const [caregiverError, setCaregiverError] = useState('')
  const [taskForm, setTaskForm] = useState({
    title: '',
    time: '09:00',
    date: today,
    category: 'general',
    notes: '',
  })

  const latestAssistantMessage = useMemo(() => {
    for (let i = chatHistory.length - 1; i >= 0; i -= 1) {
      if (chatHistory[i].role === 'assistant') {
        return chatHistory[i]
      }
    }
    return null
  }, [chatHistory])

  async function sendPatientMessage(message) {
    const trimmed = message.trim()
    if (!trimmed || isAsking) {
      return
    }

    setIsAsking(true)
    setChatHistory((prev) => [
      ...prev,
      {
        role: 'user',
        text: trimmed,
        timestamp: new Date().toISOString(),
      },
    ])

    try {
      const result = await askChat(trimmed)
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: result.response,
          intent: result.intent,
          data: result.data || {},
          timestamp: new Date().toISOString(),
        },
      ])
    } catch (error) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'I could not reach the backend. Please check if the API server is running.',
          intent: 'general',
          data: {},
          timestamp: new Date().toISOString(),
        },
      ])
      console.error(error)
    } finally {
      setIsAsking(false)
    }
  }

  async function loadCaregiverTasks() {
    setIsCaregiverLoading(true)
    setCaregiverError('')
    try {
      const payload = await fetchCaregiverTasks()
      setCaregiverTasks(payload.tasks || [])
    } catch (error) {
      setCaregiverError('Could not load caregiver tasks from the backend.')
      console.error(error)
    } finally {
      setIsCaregiverLoading(false)
    }
  }

  async function onCreateTask(event) {
    event.preventDefault()
    if (!taskForm.title.trim()) {
      setCaregiverError('Task title is required.')
      return
    }

    setCaregiverError('')
    try {
      await createCaregiverTask(taskForm)
      setTaskForm((prev) => ({
        ...prev,
        title: '',
        notes: '',
      }))
      await loadCaregiverTasks()
    } catch (error) {
      setCaregiverError('Could not create task.')
      console.error(error)
    }
  }

  async function onCompleteTask(taskId) {
    setCaregiverError('')
    try {
      await markTaskComplete(taskId)
      await loadCaregiverTasks()
    } catch (error) {
      setCaregiverError('Could not mark task complete.')
      console.error(error)
    }
  }

  async function onDeleteTask(taskId) {
    setCaregiverError('')
    try {
      await deleteCaregiverTask(taskId)
      await loadCaregiverTasks()
    } catch (error) {
      setCaregiverError('Could not delete task.')
      console.error(error)
    }
  }

  useEffect(() => {
    if (activeView === 'caregiver') {
      loadCaregiverTasks()
    }
  }, [activeView])

  function renderIntentData(message) {
    if (!message || !message.data) {
      return null
    }

    if (message.intent === 'routine' && Array.isArray(message.data.steps) && message.data.steps.length > 0) {
      return (
        <section className="detail-card">
          <h3>Routine Right Now</h3>
          <p className="detail-subtitle">
            {message.data.current_time || 'Current time'} • {message.data.period || 'Current period'}
          </p>
          <ol className="step-list">
            {message.data.steps.map((step, index) => (
              <li key={`${step}-${index}`}>{step}</li>
            ))}
          </ol>
        </section>
      )
    }

    if (message.intent === 'calendar') {
      const current = message.data.current_tasks || []
      const upcoming = message.data.upcoming_tasks || []
      return (
        <section className="detail-card">
          <h3>Today&apos;s Tasks</h3>
          <p className="detail-subtitle">{message.data.current_time || ''}</p>
          <div className="calendar-grid">
            <div>
              <h4>Happening now</h4>
              {current.length === 0 ? <p className="empty">No current tasks</p> : null}
              {current.map((task) => (
                <article className="task-pill now" key={task.id}>
                  <span>{task.time}</span>
                  <strong>{task.title}</strong>
                </article>
              ))}
            </div>
            <div>
              <h4>Coming up</h4>
              {upcoming.length === 0 ? <p className="empty">No upcoming tasks</p> : null}
              {upcoming.map((task) => (
                <article className="task-pill" key={task.id}>
                  <span>{task.time}</span>
                  <strong>{task.title}</strong>
                </article>
              ))}
            </div>
          </div>
        </section>
      )
    }

    if (message.intent === 'location' && message.data.location) {
      return (
        <section className="detail-card">
          <h3>Location</h3>
          <p className="location-line">You are in {message.data.location}.</p>
          <span className={`safe-badge ${message.data.safe ? 'safe' : 'alert'}`}>
            {message.data.safe ? 'Safe location' : 'Needs attention'}
          </span>
        </section>
      )
    }

    return null
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Memoria AI</p>
          <h1>Morning Companion</h1>
        </div>
        <div className="view-toggle" role="tablist" aria-label="Choose workspace">
          <button
            className={activeView === 'patient' ? 'active' : ''}
            onClick={() => setActiveView('patient')}
            type="button"
          >
            Patient View
          </button>
          <button
            className={activeView === 'caregiver' ? 'active' : ''}
            onClick={() => setActiveView('caregiver')}
            type="button"
          >
            Caregiver Dashboard
          </button>
        </div>
      </header>

      {activeView === 'patient' ? (
        <main className="patient-grid">
          <section className="panel profile-panel">
            <h2>Bonsoy</h2>
            <p>You are at your home in Vancouver.</p>
            <p className="soft">Tap one option below or ask a question.</p>
          </section>

          <section className="panel quick-actions">
            <h2>Quick Actions</h2>
            <div className="action-grid">
              {quickActions.map((action) => (
                <button
                  key={action.key}
                  className="action-card"
                  onClick={() => sendPatientMessage(action.prompt)}
                  type="button"
                  disabled={isAsking}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </section>

          <section className="panel chat-panel">
            <h2>Assistant</h2>
            <div className="chat-stream" aria-live="polite">
              {chatHistory.map((entry, index) => (
                <article key={`${entry.timestamp}-${index}`} className={`bubble ${entry.role}`}>
                  <p>{entry.text}</p>
                </article>
              ))}
              {isAsking ? <p className="loading">Thinking...</p> : null}
            </div>
            <form
              className="chat-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (!chatInput.trim()) {
                  return
                }
                sendPatientMessage(chatInput)
                setChatInput('')
              }}
            >
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask me anything"
                aria-label="Chat message"
              />
              <button type="submit" disabled={isAsking}>Send</button>
            </form>
          </section>

          {renderIntentData(latestAssistantMessage)}
        </main>
      ) : (
        <main className="caregiver-grid">
          <section className="panel caregiver-form-panel">
            <h2>Add Task</h2>
            <form className="caregiver-form" onSubmit={onCreateTask}>
              <label>
                Title
                <input
                  value={taskForm.title}
                  onChange={(event) =>
                    setTaskForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Take morning medication"
                />
              </label>
              <div className="form-row">
                <label>
                  Time
                  <input
                    type="time"
                    value={taskForm.time}
                    onChange={(event) =>
                      setTaskForm((prev) => ({ ...prev, time: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    value={taskForm.date}
                    onChange={(event) =>
                      setTaskForm((prev) => ({ ...prev, date: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label>
                Category
                <select
                  value={taskForm.category}
                  onChange={(event) =>
                    setTaskForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                >
                  <option value="general">General</option>
                  <option value="medication">Medication</option>
                  <option value="social">Social</option>
                  <option value="appointment">Appointment</option>
                </select>
              </label>
              <label>
                Notes
                <textarea
                  value={taskForm.notes}
                  onChange={(event) =>
                    setTaskForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  placeholder="Blue pill on the kitchen counter"
                  rows={3}
                />
              </label>
              <button type="submit">Save Task</button>
            </form>
          </section>

          <section className="panel caregiver-list-panel">
            <div className="caregiver-list-header">
              <h2>All Tasks</h2>
              <button type="button" onClick={loadCaregiverTasks} disabled={isCaregiverLoading}>
                Refresh
              </button>
            </div>

            {caregiverError ? <p className="error-text">{caregiverError}</p> : null}
            {isCaregiverLoading ? <p className="loading">Loading tasks...</p> : null}

            <div className="caregiver-list">
              {caregiverTasks.map((task) => (
                <article className={`caregiver-task ${task.completed ? 'done' : ''}`} key={task.id}>
                  <div>
                    <p className="task-time">{task.date} • {task.time}</p>
                    <h3>{task.title}</h3>
                    {task.notes ? <p className="soft">{task.notes}</p> : null}
                  </div>
                  <div className="task-actions">
                    {!task.completed ? (
                      <button type="button" onClick={() => onCompleteTask(task.id)}>
                        Complete
                      </button>
                    ) : (
                      <span className="done-label">Completed</span>
                    )}
                    <button type="button" className="danger" onClick={() => onDeleteTask(task.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
              {!isCaregiverLoading && caregiverTasks.length === 0 ? (
                <p className="empty">No tasks yet. Add one from the form.</p>
              ) : null}
            </div>
          </section>
        </main>
      )}
    </div>
  )
}

export default App
