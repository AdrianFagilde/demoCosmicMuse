import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CFormInput,
  CFormSelect,
  CProgress,
  CSpinner,
  CBadge,
} from '@coreui/react'
import {
  cilMusicNote,
  cilMic,
  cilVideo,
  cilClock,
  cilSpeedometer,
  cilMediaPlay,
  cilMediaPause,
  cilMediaStop,
  cilMediaRecord,
  cilCheckCircle,
  cilX,
  cilArrowLeft,
  cilArrowRight,
  cilVolumeHigh,
  cilVolumeOff,
  cilFile,
  cilImage,
  cilExpandUp,
  cilCompress,
  cilPlus,
  cilMinus,
  cilPencil,
  cilTrash,
  cilEyedropper,
  cilCrop,
} from '@coreui/icons'
import { useAuth } from '../../context/AuthContext'
import useSupabasePractice from '../../hooks/useSupabasePractice'
import useSupabaseTasks from '../../hooks/useSupabaseTasks'

// Build version to force cache busting
const BUILD_VERSION = '2026.09.19.5'

const PracticeTools = () => {
  // Force build hash update - build version reference
  const buildHash = `v2026.09.19.5`

  const { user, profile } = useAuth()
  const { tasks } = useSupabaseTasks()
  const practice = useSupabasePractice(user?.id)

  const studentTasks = tasks.filter((t) => t.student_id === user?.id && t.status !== 'Completado')

  const [activeTool, setActiveTool] = useState('metronome')
  const [metronome, setMetronome] = useState({
    bpm: 120,
    beatsPerMeasure: 4,
    subdivision: 'quarter',
    isPlaying: false,
    volume: 0.5,
  })
  const [tuner, setTuner] = useState({
    isActive: false,
    pitch: null,
    note: null,
    cents: 0,
    targetNote: 'A4',
    instrument: 'chromatic',
    volume: 0,
  })
  const [timer, setTimer] = useState({
    mode: 'pomodoro',
    duration: 25 * 60,
    remaining: 25 * 60,
    isRunning: false,
    taskId: null,
    sessionsCompleted: 0,
  })
  const [recorder, setRecorder] = useState({
    isRecording: false,
    mediaRecorder: null,
    recordedChunks: [],
    recordingTime: 0,
    stream: null,
    type: 'audio',
    taskId: null,
  })

  // PDF Viewer state
  const [pdfViewer, setPdfViewer] = useState({
    pdf: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.5,
    rotation: 0,
    annotations: [],
    currentTool: 'pan',
    currentColor: '#ff0000',
    currentSize: 2,
    isFullscreen: false,
    fileName: null,
  })

  // Metronome Audio Context
  const audioContextRef = useRef(null)
  const metronomeIntervalRef = useRef(null)
  const metronomeGainRef = useRef(null)

  // Tuner Audio Context
  const tunerAudioContextRef = useRef(null)
  const tunerAnalyserRef = useRef(null)
  const tunerAnimationRef = useRef(null)
  const tunerStreamRef = useRef(null)

  // Timer Interval
  const timerIntervalRef = useRef(null)

  // Recorder timer
  const recorderIntervalRef = useRef(null)

  // Initialize audio context
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      metronomeGainRef.current = audioContextRef.current.createGain()
      metronomeGainRef.current.connect(audioContextRef.current.destination)
      metronomeGainRef.current.gain.value = metronome.volume
    }
    return audioContextRef.current
  }, [metronome.volume])

  // Metronome functions
  const playClick = useCallback(
    (frequency, duration) => {
      const ctx = getAudioContext()
      if (ctx.state === 'suspended') ctx.resume()

      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.value = metronome.volume

      oscillator.connect(gain)
      gain.connect(ctx.destination)

      oscillator.start()
      oscillator.stop(ctx.currentTime + duration)
    },
    [getAudioContext, metronome.volume],
  )

  const scheduleMetronome = useCallback(() => {
    const beatDuration = 60000 / metronome.bpm
    const subdivisionMultipliers = {
      quarter: 1,
      eighth: 0.5,
      triplet: 1 / 3,
      sixteenth: 0.25,
    }
    const interval = beatDuration * subdivisionMultipliers[metronome.subdivision]

    let beatCount = 0

    metronomeIntervalRef.current = setInterval(() => {
      const isDownbeat = beatCount % metronome.beatsPerMeasure === 0
      playClick(isDownbeat ? 880 : 440, 0.05)
      beatCount++
    }, interval)
  }, [metronome.bpm, metronome.beatsPerMeasure, metronome.subdivision, playClick])

  const toggleMetronome = useCallback(() => {
    if (metronome.isPlaying) {
      clearInterval(metronomeIntervalRef.current)
      setMetronome((prev) => ({ ...prev, isPlaying: false }))
    } else {
      setMetronome((prev) => ({ ...prev, isPlaying: true }))
      scheduleMetronome()
    }
  }, [metronome.isPlaying, scheduleMetronome])

  useEffect(() => {
    return () => {
      if (metronomeIntervalRef.current) clearInterval(metronomeIntervalRef.current)
    }
  }, [])

  // Tuner functions
  const startTuner = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      tunerStreamRef.current = stream

      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      tunerAudioContextRef.current = ctx

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
      tunerAnalyserRef.current = analyser

      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const detectPitch = () => {
        if (!tuner.isActive) return

        analyser.getByteTimeDomainData(dataArray)

        // Autocorrelation pitch detection
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          const val = (dataArray[i] - 128) / 128
          sum += val * val
        }
        const rms = Math.sqrt(sum / bufferLength)
        setTuner((prev) => ({ ...prev, volume: rms }))

        // Simple peak detection for pitch
        let maxVal = -1
        let maxIdx = -1
        for (let i = 1; i < bufferLength - 1; i++) {
          const val = dataArray[i]
          if (val > dataArray[i - 1] && val > dataArray[i + 1] && val > maxVal) {
            maxVal = val
            maxIdx = i
          }
        }

        if (maxIdx > 0 && maxIdx < bufferLength - 1) {
          const sampleRate = ctx.sampleRate
          const freq = sampleRate / maxIdx
          if (freq > 50 && freq < 2000) {
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            const noteNum = Math.round(12 * Math.log2(freq / 440) + 69)
            const noteName = noteNames[noteNum % 12]
            const octave = Math.floor(noteNum / 12) - 1
            const targetFreq = 440 * Math.pow(2, (noteNum - 69) / 12)
            const cents = Math.round(1200 * Math.log2(freq / targetFreq))

            setTuner((prev) => ({
              ...prev,
              pitch: freq,
              note: `${noteName}${octave}`,
              cents: cents,
            }))
          }
        }

        tunerAnimationRef.current = requestAnimationFrame(detectPitch)
      }

      detectPitch()
      setTuner((prev) => ({ ...prev, isActive: true }))
    } catch (err) {
      console.error('Tuner error:', err)
      alert('No se pudo acceder al micrófono')
    }
  }, [tuner.isActive])

  const stopTuner = useCallback(() => {
    if (tunerAnimationRef.current) cancelAnimationFrame(tunerAnimationRef.current)
    if (tunerStreamRef.current) {
      tunerStreamRef.current.getTracks().forEach((track) => track.stop())
    }
    if (tunerAudioContextRef.current) {
      tunerAudioContextRef.current.close()
    }
    setTuner((prev) => ({ ...prev, isActive: false, pitch: null, note: null, cents: 0, volume: 0 }))
  }, [])

  useEffect(() => {
    return () => stopTuner()
  }, [stopTuner])

  // Timer functions
  const startTimer = useCallback(() => {
    setTimer((prev) => ({ ...prev, isRunning: true }))
    timerIntervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev.remaining <= 1) {
          clearInterval(timerIntervalRef.current)
          // Auto-log practice session
          if (prev.taskId) {
            practice.startPractice({
              taskId: prev.taskId,
              notes: `Pomodoro session (${Math.floor(prev.duration / 60)} min)`,
            })
          }
          return {
            ...prev,
            remaining: 0,
            isRunning: false,
            sessionsCompleted: prev.sessionsCompleted + 1,
          }
        }
        return { ...prev, remaining: prev.remaining - 1 }
      })
    }, 1000)
  }, [practice])

  const pauseTimer = useCallback(() => {
    clearInterval(timerIntervalRef.current)
    setTimer((prev) => ({ ...prev, isRunning: false }))
  }, [])

  const resetTimer = useCallback(() => {
    clearInterval(timerIntervalRef.current)
    setTimer((prev) => ({ ...prev, remaining: prev.duration, isRunning: false }))
  }, [])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Recorder functions
  const startRecording = useCallback(async () => {
    try {
      const constraints =
        recorder.type === 'video' ? { audio: true, video: { facingMode: 'user' } } : { audio: true }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: recorder.type === 'video' ? 'video/webm' : 'audio/webm',
      })

      const chunks = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, {
          type: recorder.type === 'video' ? 'video/webm' : 'audio/webm',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${recorder.type}-${Date.now()}.${recorder.type === 'video' ? 'webm' : 'webm'}`
        a.click()
        URL.revokeObjectURL(url)

        // Upload to task if selected
        if (recorder.taskId) {
          // Here you would upload to Supabase Storage and attach to task
          // For now, we'll just log the practice session
          practice.startPractice({
            taskId: recorder.taskId,
            notes: `Grabación ${recorder.type} (${formatTime(recorder.recordingTime)})`,
          })
        }
      }

      mediaRecorder.start(100)
      setRecorder((prev) => ({
        ...prev,
        isRecording: true,
        mediaRecorder,
        recordedChunks: chunks,
        stream,
        recordingTime: 0,
      }))

      recorderIntervalRef.current = setInterval(() => {
        setRecorder((prev) => ({ ...prev, recordingTime: prev.recordingTime + 1 }))
      }, 1000)
    } catch (err) {
      console.error('Recorder error:', err)
      alert('No se pudo acceder al micrófono/cámara')
    }
  }, [recorder.type, recorder.taskId, practice, recorder.recordingTime])

  const stopRecording = useCallback(() => {
    if (recorder.mediaRecorder && recorder.mediaRecorder.state !== 'inactive') {
      recorder.mediaRecorder.stop()
    }
    if (recorder.stream) {
      recorder.stream.getTracks().forEach((track) => track.stop())
    }
    clearInterval(recorderIntervalRef.current)
    setRecorder((prev) => ({
      ...prev,
      isRecording: false,
      mediaRecorder: null,
      stream: null,
      recordingTime: 0,
    }))
  }, [recorder])

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (recorderIntervalRef.current) clearInterval(recorderIntervalRef.current)
    }
  }, [])

  // PDF Viewer Functions
  const pdfViewerRef = useRef(null)

  const loadPDF = useCallback(async (file) => {
    if (!file) return
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

      setPdfViewer((prev) => ({
        ...prev,
        pdf,
        currentPage: 1,
        totalPages: pdf.numPages,
        scale: 1.5,
        rotation: 0,
        annotations: [],
        fileName: file.name,
      }))
    } catch (err) {
      console.error('Error loading PDF:', err)
      alert('Error al cargar el PDF')
    }
  }, [])

  const loadPDFFromURL = useCallback(async (url) => {
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

      const pdf = await pdfjsLib.getDocument(url).promise

      setPdfViewer((prev) => ({
        ...prev,
        pdf,
        currentPage: 1,
        totalPages: pdf.numPages,
        scale: 1.5,
        rotation: 0,
        annotations: [],
        fileName: url.split('/').pop() || 'documento.pdf',
      }))
    } catch (err) {
      console.error('Error loading PDF from URL:', err)
      alert('Error al cargar el PDF desde URL')
    }
  }, [])

  const handleFileSelect = useCallback(
    (e) => {
      const file = e.target.files?.[0]
      if (file && file.type === 'application/pdf') {
        loadPDF(file)
      }
    },
    [loadPDF],
  )

  const handleURLLoad = useCallback(
    (url) => {
      if (url.trim()) {
        loadPDFFromURL(url.trim())
      }
    },
    [loadPDFFromURL],
  )

  const goToPage = useCallback(
    (page) => {
      if (page >= 1 && page <= pdfViewer.totalPages) {
        setPdfViewer((prev) => ({ ...prev, currentPage: page }))
      }
    },
    [pdfViewer.totalPages],
  )

  const nextPage = useCallback(() => {
    goToPage(pdfViewer.currentPage + 1)
  }, [pdfViewer.currentPage, goToPage])

  const prevPage = useCallback(() => {
    goToPage(pdfViewer.currentPage - 1)
  }, [pdfViewer.currentPage, goToPage])

  const zoomIn = useCallback(() => {
    setPdfViewer((prev) => ({ ...prev, scale: Math.min(3, prev.scale + 0.25) }))
  }, [])

  const zoomOut = useCallback(() => {
    setPdfViewer((prev) => ({ ...prev, scale: Math.max(0.5, prev.scale - 0.25) }))
  }, [])

  const rotate = useCallback(() => {
    setPdfViewer((prev) => ({ ...prev, rotation: (prev.rotation + 90) % 360 }))
  }, [])

  const toggleFullscreen = useCallback(() => {
    setPdfViewer((prev) => ({ ...prev, isFullscreen: !prev.isFullscreen }))
  }, [])

  const setTool = useCallback((tool) => {
    setPdfViewer((prev) => ({ ...prev, currentTool: tool }))
  }, [])

  const setColor = useCallback((color) => {
    setPdfViewer((prev) => ({ ...prev, currentColor: color }))
  }, [])

  const setSize = useCallback((size) => {
    setPdfViewer((prev) => ({ ...prev, currentSize: size }))
  }, [])

  const addAnnotation = useCallback((annotation) => {
    setPdfViewer((prev) => ({
      ...prev,
      annotations: [...prev.annotations, annotation],
    }))
  }, [])

  const clearAnnotations = useCallback(() => {
    setPdfViewer((prev) => ({ ...prev, annotations: [] }))
  }, [])

  const downloadPDF = useCallback(async () => {
    if (!pdfViewer.pdf) return
    try {
      const pdfjsLib = await import('pdfjs-dist')
      const pdf = pdfViewer.pdf
      const data = await pdf.getData()
      const blob = new Blob([data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = pdfViewer.fileName || 'partitura.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading PDF:', err)
    }
  }, [pdfViewer.pdf, pdfViewer.fileName])

  const renderPDFPage = useCallback(
    async (pageNum, canvasRef, scale, rotation) => {
      if (!pdfViewer.pdf || !canvasRef.current) return
      try {
        const page = await pdfViewer.pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale, rotation })
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: context, viewport }).promise
      } catch (err) {
        console.error('Error rendering PDF page:', err)
      }
    },
    [pdfViewer.pdf],
  )

  const renderPDFViewer = () => (
    <CCard className="h-100">
      <CCardHeader className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span className="fw-semibold d-flex align-items-center gap-2">
          <CIcon icon={cilFile} className="text-info" />
          Visor de Partituras (PDF)
        </span>
        <div className="d-flex flex-wrap gap-2">
          <CButton
            color="primary"
            variant="outline"
            size="sm"
            onClick={() => pdfViewerRef.current?.click()}
          >
            <CIcon icon={cilImage} className="me-1" /> Cargar PDF
          </CButton>
          <input
            ref={pdfViewerRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <input
            type="url"
            placeholder="URL del PDF..."
            className="form-control form-control-sm"
            style={{ width: '200px' }}
            onKeyDown={(e) => e.key === 'Enter' && handleURLLoad(e.target.value)}
            placeholder="O ingresa URL del PDF"
          />
        </div>
      </CCardHeader>
      <CCardBody
        className={
          pdfViewer.isFullscreen
            ? 'position-fixed top-0 start-0 w-100 h-100 bg-dark z-index-1050'
            : ''
        }
      >
        {pdfViewer.pdf ? (
          <div className="d-flex flex-column h-100">
            {/* Toolbar */}
            <div className="d-flex flex-wrap gap-2 mb-3 p-2 bg-light rounded">
              <div className="btn-group me-2" role="group">
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={pdfViewer.currentPage <= 1}
                >
                  <CIcon icon={cilArrowLeft} /> Anterior
                </CButton>
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={pdfViewer.currentPage >= pdfViewer.totalPages}
                >
                  Siguiente <CIcon icon={cilArrowRight} />
                </CButton>
              </div>
              <div className="d-flex align-items-center gap-2 mx-2">
                <span className="small">Página</span>
                <CFormInput
                  type="number"
                  min={1}
                  max={pdfViewer.totalPages}
                  value={pdfViewer.currentPage}
                  onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                  style={{ width: '70px' }}
                  className="form-control-sm"
                />
                <span className="small">de {pdfViewer.totalPages}</span>
              </div>
              <div className="btn-group mx-2" role="group">
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={zoomOut}
                  title="Alejar"
                >
                  <CIcon icon={cilMinus} />
                </CButton>
                <span className="d-flex align-items-center px-2 small">
                  {Math.round(pdfViewer.scale * 100)}%
                </span>
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={zoomIn}
                  title="Acercar"
                >
                  <CIcon icon={cilPlus} />
                </CButton>
              </div>
              <div className="btn-group mx-2" role="group">
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={rotate}
                  title="Rotar"
                >
                  <CIcon icon={cilCrop} />
                </CButton>
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={toggleFullscreen}
                  title="Pantalla completa"
                >
                  <CIcon icon={pdfViewer.isFullscreen ? cilCompress : cilExpandUp} />
                </CButton>
              </div>
              <div className="ms-auto d-flex align-items-center gap-2">
                <CButton color="primary" variant="outline" size="sm" onClick={downloadPDF}>
                  <CIcon icon={cilFile} className="me-1" /> Descargar
                </CButton>
              </div>
            </div>

            {/* Annotation Toolbar */}
            <div className="d-flex flex-wrap gap-2 mb-3 p-2 bg-light rounded border">
              <span className="small d-flex align-items-center me-2">Herramientas:</span>
              <div className="btn-group me-2" role="group">
                <CButton
                  color={pdfViewer.currentTool === 'pen' ? 'primary' : 'secondary'}
                  variant={pdfViewer.currentTool === 'pen' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => setTool('pen')}
                  title="Lápiz"
                >
                  <CIcon icon={cilPencil} />
                </CButton>
                <CButton
                  color={pdfViewer.currentTool === 'eraser' ? 'primary' : 'secondary'}
                  variant={pdfViewer.currentTool === 'eraser' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => setTool('eraser')}
                  title="Borrador"
                >
                  <CIcon icon={cilTrash} />
                </CButton>
                <CButton
                  color={pdfViewer.currentTool === 'highlight' ? 'primary' : 'secondary'}
                  variant={pdfViewer.currentTool === 'highlight' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => setTool('highlight')}
                  title="Resaltar"
                >
                  <CIcon icon={cilEyedropper} />
                </CButton>
              </div>
              <div className="d-flex align-items-center gap-2 mx-2">
                <span className="small">Color:</span>
                <input
                  type="color"
                  value={pdfViewer.currentColor}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ width: '30px', height: '30px', border: 'none', cursor: 'pointer' }}
                />
                <span className="small">Tamaño:</span>
                <CFormInput
                  type="number"
                  min={1}
                  max={10}
                  value={pdfViewer.currentSize}
                  onChange={(e) => setSize(parseInt(e.target.value) || 1)}
                  style={{ width: '60px' }}
                  className="form-control-sm"
                />
              </div>
              <div className="ms-auto">
                <CButton color="danger" variant="outline" size="sm" onClick={clearAnnotations}>
                  <CIcon icon={cilX} className="me-1" /> Limpiar anotaciones
                </CButton>
              </div>
            </div>

            {/* PDF Canvas */}
            <div
              className="flex-grow-1 d-flex justify-content-center align-items-center overflow-auto"
              style={{ background: '#e0e0e0' }}
            >
              <div
                className="position-relative"
                style={{ transform: `rotate(${pdfViewer.rotation}deg)` }}
              >
                <canvas
                  ref={pdfViewerRef}
                  className="shadow"
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    cursor: pdfViewer.currentTool !== 'pan' ? 'crosshair' : 'grab',
                  }}
                />
              </div>
            </div>

            {/* Annotations Overlay */}
            {pdfViewer.annotations.length > 0 && (
              <div
                className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none"
                style={{ transform: `rotate(${pdfViewer.rotation}deg)` }}
              >
                {pdfViewer.annotations.map((ann, i) => (
                  <div
                    key={i}
                    className="position-absolute"
                    style={{
                      left: ann.x,
                      top: ann.y,
                      width: ann.width,
                      height: ann.height,
                      border: `2px solid ${ann.color}`,
                      backgroundColor: ann.type === 'highlight' ? `${ann.color}40` : 'transparent',
                      pointerEvents: 'none',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-5">
            <CIcon icon={cilFile} size="xl" className="text-medium-emphasis mb-3" />
            <h5>Visor de Partituras</h5>
            <p className="text-medium-emphasis mb-4">
              Carga un archivo PDF o ingresa una URL para visualizar tus partituras
            </p>
            <div className="d-flex flex-wrap gap-2 justify-content-center">
              <CButton color="primary" onClick={() => pdfViewerRef.current?.click()}>
                <CIcon icon={cilImage} className="me-1" /> Seleccionar archivo PDF
              </CButton>
              <input
                ref={pdfViewerRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <CButton
                color="secondary"
                variant="outline"
                onClick={() => handleURLLoad(prompt('Ingresa la URL del PDF:'))}
              >
                <CIcon icon={cilPageview} className="me-1" /> Cargar desde URL
              </CButton>
            </div>
            <div className="mt-4 text-start small text-medium-emphasis">
              <h6>Funciones disponibles:</h6>
              <ul className="mb-0">
                <li>Zoom in/out y rotación de páginas</li>
                <li>Navegación por páginas (anterior/siguiente/ir a página)</li>
                <li>Modo pantalla completa</li>
                <li>Anotaciones: lápiz, borrador, resaltador</li>
                <li>Selector de color y grosor de trazo</li>
                <li>Descargar PDF con anotaciones</li>
              </ul>
            </div>
          </div>
        )}
      </CCardBody>
    </CCard>
  )

  const renderMetronome = () => (
    <CCard className="h-100">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <span className="fw-semibold d-flex align-items-center gap-2">
          <CIcon icon={cilSpeedometer} className="text-primary" />
          Metrónomo
        </span>
        <CBadge color={metronome.isPlaying ? 'success' : 'secondary'}>
          {metronome.isPlaying ? 'Activo' : 'Detenido'}
        </CBadge>
      </CCardHeader>
      <CCardBody className="text-center">
        <div className="mb-4">
          <div className="display-1 fw-bold text-primary mb-2">{metronome.bpm}</div>
          <div className="d-flex justify-content-center gap-3 mb-3">
            <CButton
              color="primary"
              variant="outline"
              size="lg"
              onClick={() => setMetronome((p) => ({ ...p, bpm: Math.max(40, p.bpm - 10) }))}
            >
              <CIcon icon={cilArrowLeft} />
            </CButton>
            <CButton
              color="primary"
              variant="outline"
              size="lg"
              onClick={() => setMetronome((p) => ({ ...p, bpm: Math.min(240, p.bpm + 10) }))}
            >
              <CIcon icon={cilArrowRight} />
            </CButton>
          </div>
          <div className="d-flex justify-content-center gap-2">
            <CButton
              color="primary"
              size="sm"
              onClick={() => setMetronome((p) => ({ ...p, bpm: Math.max(40, p.bpm - 1) }))}
            >
              −
            </CButton>
            <CButton
              color="primary"
              size="sm"
              onClick={() => setMetronome((p) => ({ ...p, bpm: Math.min(240, p.bpm + 1) }))}
            >
              +
            </CButton>
          </div>
        </div>

        <div className="mb-4">
          <label className="form-label">Compases por medida</label>
          <CFormSelect
            value={metronome.beatsPerMeasure}
            onChange={(e) =>
              setMetronome((p) => ({ ...p, beatsPerMeasure: parseInt(e.target.value) }))
            }
            className="w-auto d-inline-block"
          >
            {[2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}/{n === 3 ? 4 : n === 6 ? 8 : 4}
              </option>
            ))}
          </CFormSelect>
        </div>

        <div className="mb-4">
          <label className="form-label">Subdivisión</label>
          <CFormSelect
            value={metronome.subdivision}
            onChange={(e) => setMetronome((p) => ({ ...p, subdivision: e.target.value }))}
            className="w-auto d-inline-block"
          >
            <option value="quarter">Negra (♩)</option>
            <option value="eighth">Corchea (♪)</option>
            <option value="triplet">Tresillo (♩.)</option>
            <option value="sixteenth">Semicorchea</option>
          </CFormSelect>
        </div>

        <div className="mb-4">
          <label className="form-label">Volumen</label>
          <CFormInput
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={metronome.volume}
            onChange={(e) => {
              const vol = parseFloat(e.target.value)
              setMetronome((p) => ({ ...p, volume: vol }))
              if (metronomeGainRef.current) metronomeGainRef.current.gain.value = vol
            }}
          />
        </div>

        <CButton
          color={metronome.isPlaying ? 'danger' : 'success'}
          size="xl"
          className="px-5"
          onClick={toggleMetronome}
        >
          <CIcon icon={metronome.isPlaying ? cilMediaPause : cilMediaPlay} className="me-2" />
          {metronome.isPlaying ? 'Detener' : 'Iniciar'}
        </CButton>

        <div className="mt-3 text-medium-emphasis small">
          <kbd className="px-2 py-1 bg-secondary rounded">Espacio</kbd> para iniciar/detener
        </div>
      </CCardBody>
    </CCard>
  )

  const renderTuner = () => (
    <CCard className="h-100">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <span className="fw-semibold d-flex align-items-center gap-2">
          <CIcon icon={cilMusicNote} className="text-info" />
          Afinador
        </span>
        <CBadge color={tuner.isActive ? 'success' : 'secondary'}>
          {tuner.isActive ? 'Escuchando' : 'Detenido'}
        </CBadge>
      </CCardHeader>
      <CCardBody className="text-center">
        <div className="mb-4">
          <CFormSelect
            value={tuner.instrument}
            onChange={(e) => setTuner((p) => ({ ...p, instrument: e.target.value }))}
            className="w-auto d-inline-block mb-3"
          >
            <option value="chromatic">Cromático</option>
            <option value="guitar">Guitarra (EADGBE)</option>
            <option value="violin">Violín (GDAE)</option>
            <option value="ukulele">Ukulele (GCEA)</option>
            <option value="bass">Bajo (EADG)</option>
          </CFormSelect>
        </div>

        <div className="mb-4">
          <div className="display-1 fw-bold text-info mb-2">{tuner.note || '—'}</div>
          {tuner.pitch && (
            <div className="text-medium-emphasis mb-3">{tuner.pitch.toFixed(1)} Hz</div>
          )}

          <div className="position-relative mx-auto" style={{ width: '300px', height: '60px' }}>
            <div
              className="position-absolute top-50 start-50 translate-middle w-100 h-100 border border-secondary rounded"
              style={{ height: '4px' }}
            />
            <div
              className={`position-absolute top-50 h-100 transition-all duration-100 ${tuner.cents === 0 ? 'bg-success' : tuner.cents > 0 ? 'bg-warning' : 'bg-danger'}`}
              style={{
                left: '50%',
                transform: `translateX(${Math.max(-50, Math.min(50, tuner.cents / 2))}%)`,
                width: '3px',
                height: '100%',
              }}
            />
            <div className="position-absolute bottom-0 w-100 d-flex justify-content-between text-muted small">
              <span>-50¢</span>
              <span>0¢</span>
              <span>+50¢</span>
            </div>
          </div>

          <div className="mt-3">
            <span
              className={`badge bg-${tuner.cents === 0 ? 'success' : 'warning'} fs-6 px-3 py-2`}
            >
              {tuner.cents > 0
                ? `+${tuner.cents}¢`
                : tuner.cents < 0
                  ? `${tuner.cents}¢`
                  : '✓ Afinado'}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <label className="form-label">Volumen detectado</label>
          <CProgress
            value={Math.min(100, (tuner.volume || 0) * 100)}
            height={8}
            color="info"
            className="w-75 mx-auto"
          />
        </div>

        <CButton
          color={tuner.isActive ? 'danger' : 'success'}
          size="xl"
          className="px-5"
          onClick={tuner.isActive ? stopTuner : startTuner}
        >
          <CIcon icon={tuner.isActive ? cilMediaStop : cilMic} className="me-2" />
          {tuner.isActive ? 'Detener' : 'Iniciar afinador'}
        </CButton>
      </CCardBody>
    </CCard>
  )

  const renderTimer = () => (
    <CCard className="h-100">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <span className="fw-semibold d-flex align-items-center gap-2">
          <CIcon icon={cilClock} className="text-warning" />
          Temporizador Pomodoro
        </span>
        <CBadge color={timer.isRunning ? 'success' : 'secondary'}>
          {timer.isRunning ? 'Corriendo' : 'Pausado'}
        </CBadge>
      </CCardHeader>
      <CCardBody className="text-center">
        <div className="mb-4">
          <CFormSelect
            value={timer.mode}
            onChange={(e) => {
              const mode = e.target.value
              const durations = { pomodoro: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 }
              setTimer((p) => ({
                ...p,
                mode,
                duration: durations[mode],
                remaining: durations[mode],
              }))
            }}
            className="w-auto d-inline-block mb-3"
          >
            <option value="pomodoro">Pomodoro (25 min)</option>
            <option value="shortBreak">Descanso corto (5 min)</option>
            <option value="longBreak">Descanso largo (15 min)</option>
          </CFormSelect>
        </div>

        <div className="mb-4">
          <label className="form-label">Asociar a tarea (opcional)</label>
          <CFormSelect
            value={timer.taskId || ''}
            onChange={(e) => setTimer((p) => ({ ...p, taskId: e.target.value || null }))}
            className="w-75 mx-auto mb-3"
          >
            <option value="">Sin tarea asociada</option>
            {studentTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </CFormSelect>
        </div>

        <div className="display-1 fw-bold text-warning mb-4 font-monospace">
          {formatTime(timer.remaining)}
        </div>

        <div className="mb-4">
          <CProgress
            value={
              timer.duration > 0 ? ((timer.duration - timer.remaining) / timer.duration) * 100 : 0
            }
            height={12}
            color="warning"
            className="w-75 mx-auto"
          />
        </div>

        <div className="d-flex justify-content-center gap-2">
          {timer.isRunning ? (
            <CButton color="warning" size="xl" onClick={pauseTimer}>
              <CIcon icon={cilMediaPause} className="me-2" />
              Pausar
            </CButton>
          ) : timer.remaining < timer.duration ? (
            <>
              <CButton color="success" size="xl" onClick={startTimer}>
                <CIcon icon={cilMediaPlay} className="me-2" />
                Continuar
              </CButton>
              <CButton color="secondary" variant="outline" size="xl" onClick={resetTimer}>
                <CIcon icon={cilX} className="me-2" />
                Reiniciar
              </CButton>
            </>
          ) : (
            <CButton color="success" size="xl" onClick={startTimer}>
              <CIcon icon={cilMediaPlay} className="me-2" />
              Iniciar
            </CButton>
          )}
        </div>

        {timer.sessionsCompleted > 0 && (
          <div className="mt-3 text-medium-emphasis small">
            Sesiones completadas: <strong>{timer.sessionsCompleted}</strong>
          </div>
        )}
      </CCardBody>
    </CCard>
  )

  const renderRecorder = () => (
    <CCard className="h-100">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <span className="fw-semibold d-flex align-items-center gap-2">
          <CIcon icon={recorder.type === 'video' ? cilVideo : cilMic} className="text-danger" />
          Grabadora
        </span>
        <CBadge color={recorder.isRecording ? 'danger' : 'secondary'}>
          {recorder.isRecording ? 'Grabando' : 'Lista'}
        </CBadge>
      </CCardHeader>
      <CCardBody className="text-center">
        <div className="mb-4">
          <label className="form-label">Tipo de grabación</label>
          <div className="btn-group w-auto" role="group">
            <CButton
              color={recorder.type === 'audio' ? 'primary' : 'secondary'}
              variant={recorder.type === 'audio' ? 'solid' : 'outline'}
              onClick={() => setRecorder((p) => ({ ...p, type: 'audio' }))}
            >
              <CIcon icon={cilMic} className="me-1" /> Audio
            </CButton>
            <CButton
              color={recorder.type === 'video' ? 'primary' : 'secondary'}
              variant={recorder.type === 'video' ? 'solid' : 'outline'}
              onClick={() => setRecorder((p) => ({ ...p, type: 'video' }))}
            >
              <CIcon icon={cilVideo} className="me-1" /> Video
            </CButton>
          </div>
        </div>

        <div className="mb-4">
          <label className="form-label">Asociar a tarea (opcional)</label>
          <CFormSelect
            value={recorder.taskId || ''}
            onChange={(e) => setRecorder((p) => ({ ...p, taskId: e.target.value || null }))}
            className="w-75 mx-auto mb-3"
          >
            <option value="">Sin tarea asociada</option>
            {studentTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </CFormSelect>
        </div>

        <div className="display-1 fw-bold text-danger mb-4 font-monospace">
          {formatTime(recorder.recordingTime)}
        </div>

        <CProgress
          value={recorder.isRecording ? ((recorder.recordingTime % 60) / 60) * 100 : 0}
          height={12}
          color="danger"
          className="w-75 mx-auto mb-4"
        />

        <div className="d-flex justify-content-center gap-2">
          {recorder.isRecording ? (
            <CButton color="danger" size="xl" onClick={stopRecording}>
              <CIcon icon={cilMediaStop} className="me-2" />
              Detener y guardar
            </CButton>
          ) : (
            <CButton color="danger" size="xl" onClick={startRecording}>
              <CIcon icon={cilMediaRecord} className="me-2" />
              Iniciar grabación
            </CButton>
          )}
        </div>

        <div className="mt-3 text-medium-emphasis small">
          Se descargará automáticamente al detener. Si seleccionas una tarea, se registrará la
          sesión de práctica.
        </div>
      </CCardBody>
    </CCard>
  )

  return (
    <>
      {/* Build version marker - forces new build hash on deploy */}
      <div data-build-version={buildHash} style={{ display: 'none' }} />
      <CRow className="mb-4">
        <CCol>
          <CCard>
            <CCardHeader>Herramientas de práctica</CCardHeader>
            <CCardBody>
              <p>
                Metrónomo, afinador, temporizador Pomodoro y grabadora para tus sesiones de estudio.
              </p>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CRow className="mb-4">
        <CCol>
          <div className="nav nav-tabs" role="tablist">
            <button
              className={`nav-link ${activeTool === 'metronome' ? 'active' : ''}`}
              onClick={() => setActiveTool('metronome')}
              role="tab"
            >
              <CIcon icon={cilSpeedometer} className="me-1" /> Metrónomo
            </button>
            <button
              className={`nav-link ${activeTool === 'tuner' ? 'active' : ''}`}
              onClick={() => setActiveTool('tuner')}
              role="tab"
            >
              <CIcon icon={cilMusicNote} className="me-1" /> Afinador
            </button>
            <button
              className={`nav-link ${activeTool === 'timer' ? 'active' : ''}`}
              onClick={() => setActiveTool('timer')}
              role="tab"
            >
              <CIcon icon={cilClock} className="me-1" /> Pomodoro
            </button>
            <button
              className={`nav-link ${activeTool === 'recorder' ? 'active' : ''}`}
              onClick={() => setActiveTool('recorder')}
              role="tab"
            >
              <CIcon icon={cilMic} className="me-1" /> Grabadora
            </button>
            <button
              className={`nav-link ${activeTool === 'pdfviewer' ? 'active' : ''}`}
              onClick={() => setActiveTool('pdfviewer')}
              role="tab"
            >
              <CIcon icon={cilFile} className="me-1" /> Partituras
            </button>
          </div>
        </CCol>
      </CRow>

      <CRow className="mb-4">
        <CCol lg={12}>
          {activeTool === 'metronome' && renderMetronome()}
          {activeTool === 'tuner' && renderTuner()}
          {activeTool === 'timer' && renderTimer()}
          {activeTool === 'recorder' && renderRecorder()}
          {activeTool === 'pdfviewer' && renderPDFViewer()}
        </CCol>
      </CRow>

      <CRow className="mb-4">
        <CCol>
          <CCard>
            <CCardHeader>Sesiones de práctica recientes</CCardHeader>
            <CCardBody className="p-0">
              {(practice.sessions || []).length > 0 ? (
                <div className="list-group list-group-flush">
                  {(practice.sessions || []).slice(0, 10).map((session) => (
                    <div
                      key={session.id}
                      className="list-group-item px-3 py-2 d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <div className="fw-semibold small">{session.notes || 'Práctica libre'}</div>
                        <div className="text-medium-emphasis small">
                          {session.task_id ? 'Tarea asociada' : 'Práctica libre'}•{' '}
                          {session.started_at && !isNaN(new Date(session.started_at).getTime())
                            ? new Date(session.started_at).toLocaleString('es-ES')
                            : 'Fecha inválida'}
                          {session.duration_minutes && ` • ${session.duration_minutes} min`}
                          {session.metronome_used && ` • Metrónomo: ${session.metronome_bpm} BPM`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-medium-emphasis py-4">
                  <CIcon icon={cilMusicNote} size="lg" className="mb-2" />
                  <p>No hay sesiones registradas aún</p>
                  <CButton color="primary" size="sm" onClick={() => setActiveTool('timer')}>
                    <CIcon icon={cilMediaPlay} className="me-1" /> Empezar primera sesión
                  </CButton>
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default PracticeTools
