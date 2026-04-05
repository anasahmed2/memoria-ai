import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  askChat,
  createCaregiverTask,
  deleteCaregiverTask,
  fetchCaregiverTasks,
  markTaskComplete,
} from './api'
import './App.css'

const today = new Date().toISOString().slice(0, 10)
const INTRO_MESSAGE = 'Hello, I am your personal caregiving AI assistant.'
const INTRO_SESSION_KEY = 'memoria_intro_played'

function App() {
  const [activeView, setActiveView] = useState('patient')
  const [isAsking, setIsAsking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'assistant',
      text: INTRO_MESSAGE,
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
  const recognitionRef = useRef(null)
  const activeAudioRef = useRef(null)

  const latestAssistantMessage = useMemo(() => {
    for (let i = chatHistory.length - 1; i >= 0; i -= 1) {
      if (chatHistory[i].role === 'assistant') {
        return chatHistory[i]
      }
    }
    return null
  }, [chatHistory])

  const pendingTasks = useMemo(
    () => caregiverTasks.filter((task) => !task.completed).length,
    [caregiverTasks],
  )

  const completedTasks = useMemo(
    () => caregiverTasks.filter((task) => task.completed).length,
    [caregiverTasks],
  )

  const playAssistantAudio = useCallback((audioBase64, audioMime = 'audio/mpeg') => {
    if (!audioBase64) {
      return
    }

    if (activeAudioRef.current) {
      activeAudioRef.current.pause()
      activeAudioRef.current = null
    }

    const audio = new Audio(`data:${audioMime};base64,${audioBase64}`)
    activeAudioRef.current = audio
    audio.onended = () => {
      if (activeAudioRef.current === audio) {
        activeAudioRef.current = null
      }
    }
    audio.play().catch((error) => {
      console.error(error)
      setVoiceStatus('The response is ready, but this browser blocked autoplay.')
    })
  }, [])

  const speakAssistantResponse = useCallback(async (responseText) => {
    try {
      const result = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/voice/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: responseText }),
      })

      if (!result.ok) {
        const text = await result.text()
        throw new Error(text || `Voice playback request failed: ${result.status}`)
      }

      const payload = await result.json()
      playAssistantAudio(payload.audio_base64, payload.audio_mime)
    } catch (error) {
      console.error(error)
      setVoiceStatus('Assistant reply is visible, but audio could not be generated.')
    }
  }, [playAssistantAudio])

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
      void speakAssistantResponse(result.response)
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
      void speakAssistantResponse('I could not reach the backend. Please check if the API server is running.')
      console.error(error)
    } finally {
      setIsAsking(false)
    }
  }

  async function startVoiceInput() {
    if (!voiceSupported || isAsking || isListening) {
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceStatus('Voice input is not available in this browser.')
      return
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition()
      recognition.lang = 'en-US'
      recognition.continuous = false
      recognition.interimResults = true

      recognition.onstart = () => {
        setIsListening(true)
        setVoiceStatus('Listening...')
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.onerror = (event) => {
        setIsListening(false)
        setVoiceStatus(`Voice error: ${event.error}`)
      }

      recognition.onresult = (event) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          transcript += event.results[i][0].transcript
        }

        const cleaned = transcript.trim()
        if (!cleaned) {
          return
        }

        const latest = event.results[event.results.length - 1]
        if (latest.isFinal) {
          setVoiceStatus('Sending your question...')
          sendPatientMessage(cleaned)
        }
      }

      recognitionRef.current = recognition
    }

    recognitionRef.current.start()
  }

  function stopVoiceInput() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setVoiceStatus('Voice input stopped.')
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const hasVoiceInput = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
    setVoiceSupported(hasVoiceInput)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const alreadyPlayed = window.sessionStorage.getItem(INTRO_SESSION_KEY) === '1'
    if (alreadyPlayed) {
      return
    }

    window.sessionStorage.setItem(INTRO_SESSION_KEY, '1')
    void speakAssistantResponse(INTRO_MESSAGE)
  }, [speakAssistantResponse])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (activeAudioRef.current) {
        activeAudioRef.current.pause()
      }
    }
  }, [])

  function renderIntentData(message) {
    if (!message || !message.data) {
      return null
    }

    if (message.intent === 'routine' && Array.isArray(message.data.steps) && message.data.steps.length > 0) {
      return (
        <section className="detail-card intent-routine">
          <p className="intent-kicker">Routine Assistant</p>
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
        <section className="detail-card intent-calendar">
          <p className="intent-kicker">Task Assistant</p>
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
        <section className="detail-card intent-location">
          <p className="intent-kicker">Location Support</p>
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

  const intentCard = renderIntentData(latestAssistantMessage)

  return (
    <div className="app-shell">
      <div className="mesh" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <aside className="rail">
        <div className="brand">
          <p className="brand-kicker">Memoria AI</p>
          <h1>Harmony Desk</h1>
          <p>Comfort-first interface for daily support.</p>
        </div>

        <section className="rail-card resident-rail-card">
          <p className="panel-kicker">Resident Snapshot</p>
          <h2>Bonsoy</h2>
          <p>You are at home in Vancouver. Everything is okay.</p>
        </section>

        <div className="view-toggle" role="tablist" aria-label="Choose workspace">
          <button
            className={activeView === 'patient' ? 'active' : ''}
            onClick={() => setActiveView('patient')}
            type="button"
          >
            Patient Studio
          </button>
          <button
            className={activeView === 'caregiver' ? 'active' : ''}
            onClick={() => setActiveView('caregiver')}
            type="button"
          >
            Caregiver Command
          </button>
        </div>

        <div className="rail-card">
          <p className="rail-title">Quick Guidance</p>
          <ul>
            <li>Use one-tap cards for faster support.</li>
            <li>Keep messages short and clear.</li>
            <li>Use caregiver mode to manage tasks.</li>
          </ul>
        </div>

        <div className="rail-status">
          <span className="live-dot">Live</span>
          <span>Backend connected on 8000</span>
        </div>
      </aside>

      {activeView === 'patient' ? (
        <main className="main patient-layout">
          <section className="panel chat-panel">
            <p className="panel-kicker">Conversation</p>
            <h2>Assistant</h2>
            <div className="voice-toolbar">
              <button
                type="button"
                className={`voice-btn ${isListening ? 'listening' : ''}`}
                onClick={isListening ? stopVoiceInput : startVoiceInput}
                disabled={!voiceSupported || isAsking}
              >
                {isListening ? 'Stop Mic' : 'Voice In'}
              </button>
            </div>
            {!voiceSupported ? <p className="soft voice-note">Voice input is not available in this browser.</p> : null}
            {voiceStatus ? <p className="soft voice-note">{voiceStatus}</p> : null}
            <div className="chat-stream" aria-live="polite">
              {chatHistory.map((entry, index) => (
                <article key={`${entry.timestamp}-${index}`} className={`bubble ${entry.role}`}>
                  <p>{entry.text}</p>
                </article>
              ))}
              {isAsking ? <p className="loading">Thinking...</p> : null}
            </div>
            <div className="voice-only-note">
              Speak your question out loud. We use browser voice input and ElevenLabs voice output.
            </div>
          </section>

          {intentCard ? <section className="panel intent-panel">{intentCard}</section> : null}
        </main>
      ) : (
        <main className="main caregiver-layout">
          <section className="panel stats-panel">
            <div>
              <p className="panel-kicker">Task Metrics</p>
              <h2>Caregiver Overview</h2>
            </div>
            <div className="stats-grid">
              <article>
                <span>Pending</span>
                <strong>{pendingTasks}</strong>
              </article>
              <article>
                <span>Completed</span>
                <strong>{completedTasks}</strong>
              </article>
              <article>
                <span>Total</span>
                <strong>{caregiverTasks.length}</strong>
              </article>
            </div>
          </section>

          <section className="panel planner-panel">
            <p className="panel-kicker">Planner</p>
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

          <section className="panel board-panel">
            <div className="caregiver-list-header">
              <div>
                <p className="panel-kicker">Task Board</p>
                <h2>All Tasks</h2>
              </div>
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
