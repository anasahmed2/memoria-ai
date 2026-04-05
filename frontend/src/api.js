const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export function askChat(message) {
  return request('/chat/', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export async function sendVoiceChat(audioBlob) {
  const response = await fetch(`${API_BASE_URL}/voice/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': audioBlob.type || 'audio/webm',
    },
    body: audioBlob,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Voice request failed: ${response.status}`)
  }

  return response.json()
}

export function fetchCaregiverTasks() {
  return request('/caregiver/tasks')
}

export function createCaregiverTask(task) {
  return request('/caregiver/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  })
}

export function markTaskComplete(taskId) {
  return request(`/caregiver/tasks/${taskId}/complete`, {
    method: 'PATCH',
  })
}

export function deleteCaregiverTask(taskId) {
  return request(`/caregiver/tasks/${taskId}`, {
    method: 'DELETE',
  })
}
