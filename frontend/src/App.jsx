import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  askChat,
  createCaregiverTask,
  deleteCaregiverTask,
  fetchCaregiverTasks,
  fetchLocationContext,
  getBrowserCoordinates,
  markTaskComplete,
} from './api'
import './App.css'

const today = new Date().toISOString().slice(0, 10)

function App() {
  const [activeView, setActiveView] = useState('patient')
  const [isAsking, setIsAsking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [alwaysListeningEnabled, setAlwaysListeningEnabled] = useState(true)
  const [chatHistory, setChatHistory] = useState([])
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
  const transcriptBufferRef = useRef('')
  const flushTimerRef = useRef(null)
  const resetTimerRef = useRef(null)
  const shouldRestartRef = useRef(false)
  const pauseRestartRef = useRef(false)

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

    const shouldResumeListeningAfterAudio = shouldRestartRef.current
    if (shouldResumeListeningAfterAudio && recognitionRef.current) {
      pauseRestartRef.current = true
      try {
        recognitionRef.current.stop()
      } catch (error) {
        console.error(error)
      }
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
      pauseRestartRef.current = false
      if (shouldResumeListeningAfterAudio && shouldRestartRef.current && !isAsking && recognitionRef.current) {
        try {
          recognitionRef.current.start()
          setVoiceStatus('Listening...')
        } catch (error) {
          console.error(error)
        }
      }
    }
    audio.play().catch((error) => {
      console.error(error)
      pauseRestartRef.current = false
      setVoiceStatus('The response is ready, but this browser blocked autoplay.')
    })
  }, [isAsking])

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
      return true
    } catch (error) {
      console.error(error)
      setVoiceStatus('Assistant reply is visible, but audio could not be generated.')
      return false
    }
  }, [playAssistantAudio])

  const sendPatientMessage = useCallback(async (message) => {
    const trimmed = message.trim()
    if (!trimmed || isAsking) {
      return
    }

    const needsLocationContext = /(where am i|location|weather|temperature|rain|forecast|outside|jacket)/i.test(trimmed)
    let context = null

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
      if (needsLocationContext) {
        setVoiceStatus('Getting your location...')
        try {
          const coords = await getBrowserCoordinates()
          context = await fetchLocationContext(coords.latitude, coords.longitude)
          setVoiceStatus('Location captured. Preparing your answer...')
        } catch (geoError) {
          console.error(geoError)
          setVoiceStatus('Could not access browser location. Continuing with limited context.')
        }
      }

      const result = await askChat(trimmed, context)
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
  }, [isAsking, speakAssistantResponse])

  const clearListeningTimers = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    if (resetTimerRef.current) {
      clearInterval(resetTimerRef.current)
      resetTimerRef.current = null
    }
  }, [])

  const flushTranscriptBuffer = useCallback(() => {
    const buffered = transcriptBufferRef.current.trim()
    transcriptBufferRef.current = ''

    if (!buffered || isAsking) {
      return
    }

    setVoiceStatus('Sending your question...')
    void sendPatientMessage(buffered)
  }, [isAsking, sendPatientMessage])

  const scheduleFlushAfterSilence = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
    }
    flushTimerRef.current = setTimeout(() => {
      flushTranscriptBuffer()
    }, 1500)
  }, [flushTranscriptBuffer])

  const startListeningWindowReset = useCallback(() => {
    if (resetTimerRef.current) {
      clearInterval(resetTimerRef.current)
    }

    resetTimerRef.current = setInterval(() => {
      flushTranscriptBuffer()
      if (recognitionRef.current && shouldRestartRef.current && !pauseRestartRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (error) {
          console.error(error)
        }
      }
    }, 10000)
  }, [flushTranscriptBuffer])

  const startVoiceInput = useCallback(async () => {
    if (!voiceSupported || isAsking || isListening || !alwaysListeningEnabled) {
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
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onstart = () => {
        setIsListening(true)
        setVoiceStatus('Listening...')
      }

      recognition.onend = () => {
        setIsListening(false)
        if (shouldRestartRef.current && !isAsking && !pauseRestartRef.current) {
          setTimeout(() => {
            if (shouldRestartRef.current && !isAsking && !pauseRestartRef.current) {
              try {
                recognition.start()
              } catch (error) {
                console.error(error)
              }
            }
          }, 200)
        }
      }

      recognition.onerror = (event) => {
        setIsListening(false)
        setVoiceStatus(`Voice error: ${event.error}`)
      }

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i]
          if (result.isFinal) {
            transcriptBufferRef.current += ` ${result[0].transcript}`
            scheduleFlushAfterSilence()
          }
        }
      }

      recognitionRef.current = recognition
    }

    shouldRestartRef.current = true
    recognitionRef.current.start()
    startListeningWindowReset()
  }, [
    alwaysListeningEnabled,
    isAsking,
    isListening,
    voiceSupported,
    scheduleFlushAfterSilence,
    startListeningWindowReset,
  ])

  function stopVoiceInput() {
    shouldRestartRef.current = false
    flushTranscriptBuffer()
    clearListeningTimers()
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setVoiceStatus('Voice input stopped.')
    }
  }

  function toggleAlwaysListening() {
    setAlwaysListeningEnabled((prev) => {
      const next = !prev
      if (!next) {
        stopVoiceInput()
      }
      return next
    })
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
  }, [clearListeningTimers])

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false
      clearListeningTimers()
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (activeAudioRef.current) {
        activeAudioRef.current.pause()
      }
    }
  }, [clearListeningTimers])

  useEffect(() => {
    if (activeView === 'patient' && alwaysListeningEnabled && voiceSupported && !isAsking) {
      void startVoiceInput()
    }
    if (!alwaysListeningEnabled) {
      shouldRestartRef.current = false
      flushTranscriptBuffer()
      clearListeningTimers()
      recognitionRef.current?.stop()
      setVoiceStatus('Voice input stopped.')
    }
  }, [activeView, alwaysListeningEnabled, voiceSupported, isAsking, startVoiceInput, flushTranscriptBuffer, clearListeningTimers])

  function renderIntentData(message) {
    if (!message || !message.data) {
      return null
    }

    if (message.intent === 'memory_recall' && message.data.person) {
      const person = message.data.person
      return (
        <section className="detail-card intent-person">
          <p className="intent-kicker">Person Memory</p>
          <h3>{person.name || 'Person'}</h3>
          <div className="person-card">
            {person.image_url ? (
              <img className="person-photo" src={`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}${person.image_url}`} alt={person.name || 'Person'} />
            ) : null}
            <div>
              {person.relationship ? <p className="detail-subtitle">{person.relationship}</p> : null}
              {person.notes ? <p>{person.notes}</p> : null}
            </div>
          </div>
        </section>
      )
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
          {message.data.latitude && message.data.longitude ? (
            <p className="detail-subtitle">
              Lat {Number(message.data.latitude).toFixed(3)} • Lon {Number(message.data.longitude).toFixed(3)}
            </p>
          ) : null}
          <span className={`safe-badge ${message.data.safe ? 'safe' : 'alert'}`}>
            {message.data.safe ? 'Safe location' : 'Needs attention'}
          </span>
        </section>
      )
    }

    if (message.intent === 'weather') {
      return (
        <section className="detail-card intent-weather">
          <p className="intent-kicker">Weather Support</p>
          <h3>Current Weather</h3>
          <p className="detail-subtitle">{message.data.location || 'Your area'}</p>
          <p>
            {message.data.temperature_c !== null && message.data.temperature_c !== undefined
              ? `${message.data.temperature_c}°C • ${message.data.weather || 'current conditions'}`
              : message.data.weather || 'Weather unavailable'}
          </p>
          {message.data.dress_tip ? <p className="soft">{message.data.dress_tip}</p> : null}
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

        <div className="rail-status">
          <span className="live-dot">Live</span>
          <span>Backend connected on 8000</span>
        </div>
      </aside>

      {activeView === 'patient' ? (
        <main className="main patient-layout">
          <section className="panel chat-panel">
            <p className="panel-kicker">Caretaking</p>
            <h2>Assistant</h2>
            <div className="voice-toolbar">
              <button
                type="button"
                className={`voice-btn ${isListening ? 'listening' : ''}`}
                onClick={toggleAlwaysListening}
                disabled={!voiceSupported}
              >
                {alwaysListeningEnabled ? 'Always Listening: On' : 'Always Listening: Off'}
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
