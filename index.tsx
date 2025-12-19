/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';

const MODEL_NAME = 'gemini-2.5-flash';

interface Note {
  id: string;
  rawTranscription: string;
  polishedNote: string;
  timestamp: number;
}

class VoiceNotesApp {
  private genAI: any;
  private mediaRecorder: MediaRecorder | null = null;
  private recordButton: HTMLButtonElement;
  private recordingStatus: HTMLDivElement;
  private rawTranscription: HTMLDivElement;
  private polishedNote: HTMLDivElement;
  private newButton: HTMLButtonElement;
  private exportButton: HTMLButtonElement;
  private audioChunks: Blob[] = [];
  private isRecording = false; // Synced with recordingState, useful for callbacks
  private currentNote: Note | null = null;
  private stream: MediaStream | null = null;
  private editorTitle: HTMLDivElement;

  // New UI elements
  private heroScreen: HTMLDivElement;
  private startAppButton: HTMLButtonElement;
  private appContainer: HTMLDivElement;
  private transcribeButton: HTMLButtonElement;
  private newButtonIcon: HTMLElement;
  private creditsDisplay: HTMLDivElement;

  // Recording flow state
  private recordingState: 'idle' | 'recording' | 'recorded' = 'idle';
  private audioBlob: Blob | null = null;

  // Live recording display
  private recordingInterface: HTMLDivElement;
  private liveRecordingTitle: HTMLDivElement;
  private liveWaveformCanvas: HTMLCanvasElement | null;
  private liveWaveformCtx: CanvasRenderingContext2D | null = null;
  private liveRecordingTimerDisplay: HTMLDivElement;
  private statusIndicatorDiv: HTMLDivElement | null;

  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private waveformDataArray: Uint8Array | null = null;
  private waveformDrawingId: number | null = null;
  private timerIntervalId: number | null = null;
  private recordingStartTime: number = 0;

  // Daily credits logic
  private credits = 5;
  private readonly DAILY_LIMIT = 5;
  private readonly STORAGE_KEY = 'rambly_credits_v1';
  private readonly NOTES_STORAGE_KEY = 'rambly_notes_v1';

  constructor() {
    this.genAI = new GoogleGenAI({
      apiKey: process.env.API_KEY,
    });

    // App entry elements
    this.heroScreen = document.querySelector('.hero-screen') as HTMLDivElement;
    this.startAppButton = document.getElementById(
      'startAppButton',
    ) as HTMLButtonElement;
    this.appContainer = document.querySelector(
      '.dashboard',
    ) as HTMLDivElement;

    // Main app elements
    this.recordButton = document.getElementById(
      'recordButton',
    ) as HTMLButtonElement;
    this.recordingStatus = document.getElementById(
      'recordingStatus',
    ) as HTMLDivElement;
    this.rawTranscription = document.getElementById(
      'rawTranscription',
    ) as HTMLDivElement;
    this.polishedNote = document.getElementById(
      'polishedNote',
    ) as HTMLDivElement;
    this.newButton = document.getElementById('newButton') as HTMLButtonElement;
    this.newButtonIcon = this.newButton.querySelector('i') as HTMLElement;
    this.exportButton = document.getElementById(
      'exportButton',
    ) as HTMLButtonElement;
    this.transcribeButton = document.getElementById(
      'transcribeButton',
    ) as HTMLButtonElement;
    this.editorTitle = document.querySelector(
      '.editor-title',
    ) as HTMLDivElement;

    this.recordingInterface = document.querySelector(
      '.recording-interface',
    ) as HTMLDivElement;
    this.liveRecordingTitle = document.getElementById(
      'liveRecordingTitle',
    ) as HTMLDivElement;
    this.liveWaveformCanvas = document.getElementById(
      'liveWaveformCanvas',
    ) as HTMLCanvasElement;
    this.liveRecordingTimerDisplay = document.getElementById(
      'liveRecordingTimerDisplay',
    ) as HTMLDivElement;
    this.creditsDisplay = document.getElementById(
      'creditsDisplay',
    ) as HTMLDivElement;

    if (this.liveWaveformCanvas) {
      this.liveWaveformCtx = this.liveWaveformCanvas.getContext('2d');
    }

    if (this.recordingInterface) {
      this.statusIndicatorDiv = this.recordingInterface.querySelector(
        '.status-indicator',
      ) as HTMLDivElement;
    }

    this.bindEventListeners();
    this.initCredits();
    this.createNewNote(); // Sets initial state
    this.updateUIForState();
  }

  private initCredits(): void {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(this.STORAGE_KEY);

    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.date === today) {
          this.credits = data.credits;
        } else {
          // New day, reset credits
          this.credits = this.DAILY_LIMIT;
          this.saveCredits();
        }
      } catch (e) {
        console.error('Error parsing credits:', e);
        this.credits = this.DAILY_LIMIT;
        this.saveCredits();
      }
    } else {
      // First time use
      this.credits = this.DAILY_LIMIT;
      this.saveCredits();
    }
    this.updateCreditsUI();
  }

  private saveCredits(): void {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
      date: today,
      credits: this.credits
    }));
    this.updateCreditsUI();
  }

  private decrementCredits(): void {
    if (this.credits > 0) {
      this.credits--;
      this.saveCredits();
    }
  }

  private updateCreditsUI(): void {
    if (this.creditsDisplay) {
      // New UI structure: creditsDisplay only shows the number
      this.creditsDisplay.textContent = `${this.credits}`;

      // Update color based on credits remaining
      const creditsValue = this.creditsDisplay.closest('.credits-value') || this.creditsDisplay;
      if (this.credits === 0) {
        creditsValue.classList.add('depleted');
      } else {
        creditsValue.classList.remove('depleted');
      }
    }
  }

  // Save note to history for the My Ramblings view
  private saveNoteToHistory(): void {
    if (!this.currentNote || !this.currentNote.polishedNote) return;

    try {
      const stored = localStorage.getItem(this.NOTES_STORAGE_KEY);
      const notes: Note[] = stored ? JSON.parse(stored) : [];

      // Update the current note with the latest content
      this.currentNote.rawTranscription = this.rawTranscription.textContent || '';
      this.currentNote.polishedNote = this.polishedNote.innerText || '';
      this.currentNote.timestamp = Date.now();

      // Check if note already exists (update) or is new (add)
      const existingIndex = notes.findIndex(n => n.id === this.currentNote!.id);
      if (existingIndex >= 0) {
        notes[existingIndex] = this.currentNote;
      } else {
        notes.unshift(this.currentNote); // Add to beginning
      }

      // Keep only the last 50 notes
      const trimmedNotes = notes.slice(0, 50);
      localStorage.setItem(this.NOTES_STORAGE_KEY, JSON.stringify(trimmedNotes));

      console.log('Note saved to history:', this.currentNote.id);
    } catch (error) {
      console.error('Error saving note to history:', error);
    }
  }

  private bindEventListeners(): void {
    this.startAppButton.addEventListener('click', () => this.startApp());
    this.recordButton.addEventListener('click', () =>
      this.handleRecordButtonClick(),
    );
    this.newButton.addEventListener('click', () => this.createNewNote());
    this.exportButton.addEventListener('click', () => this.exportNote());
    this.transcribeButton.addEventListener('click', () =>
      this.transcribeRecording(),
    );
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private startApp(): void {
    this.heroScreen.classList.add('hidden');
    this.heroScreen.addEventListener(
      'transitionend',
      () => {
        this.heroScreen.style.display = 'none';
      },
      { once: true },
    );
    this.appContainer.style.display = 'flex';
  }

  private handleRecordButtonClick(): void {
    if (this.recordingState === 'recording') {
      this.stopRecording();
    } else {
      // 'idle' or 'recorded' state -> start a new recording
      this.startRecording();
    }
  }

  private async transcribeRecording(): Promise<void> {
    if (this.recordingState !== 'recorded' || !this.audioBlob) return;

    this.transcribeButton.disabled = true;
    this.recordButton.disabled = true;
    this.recordingStatus.textContent = 'Preparing to transcribe...';

    // Deduct credit here as transcription is the expensive operation
    this.decrementCredits();
    this.updateCreditsUI();

    try {
      await this.processAudio(this.audioBlob);
    } catch (e) {
      console.error('Transcription process failed', e);
      // Status is set inside processAudio/getTranscription on error
    } finally {
      this.audioBlob = null;
      this.recordingState = 'idle';
      this.updateUIForState();
    }
  }

  private handleResize(): void {
    if (
      this.isRecording &&
      this.liveWaveformCanvas &&
      this.liveWaveformCanvas.style.display === 'block'
    ) {
      requestAnimationFrame(() => {
        this.setupCanvasDimensions();
      });
    }
  }

  private setupCanvasDimensions(): void {
    if (!this.liveWaveformCanvas || !this.liveWaveformCtx) return;

    const canvas = this.liveWaveformCanvas;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    this.liveWaveformCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private setupAudioVisualizer(): void {
    if (!this.stream || this.audioContext) return;

    this.audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.75;
    const bufferLength = this.analyserNode.frequencyBinCount;
    this.waveformDataArray = new Uint8Array(bufferLength);
    source.connect(this.analyserNode);
  }

  private drawLiveWaveform(): void {
    if (
      !this.analyserNode ||
      !this.waveformDataArray ||
      !this.liveWaveformCtx ||
      !this.liveWaveformCanvas ||
      !this.isRecording
    ) {
      if (this.waveformDrawingId) cancelAnimationFrame(this.waveformDrawingId);
      this.waveformDrawingId = null;
      return;
    }

    this.waveformDrawingId = requestAnimationFrame(() =>
      this.drawLiveWaveform(),
    );
    this.analyserNode.getByteFrequencyData(this.waveformDataArray);
    const ctx = this.liveWaveformCtx;
    const canvas = this.liveWaveformCanvas;
    const logicalWidth = canvas.clientWidth;
    const logicalHeight = canvas.clientHeight;
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    const bufferLength = this.analyserNode.frequencyBinCount;
    const numBars = Math.floor(bufferLength * 0.5);
    if (numBars === 0) return;
    const totalBarPlusSpacingWidth = logicalWidth / numBars;
    const barWidth = Math.max(1, Math.floor(totalBarPlusSpacingWidth * 0.7));
    const barSpacing = Math.max(0, Math.floor(totalBarPlusSpacingWidth * 0.3));
    let x = 0;
    const recordingColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-recording')
        .trim() || '#ff3b30';
    ctx.fillStyle = recordingColor;
    for (let i = 0; i < numBars; i++) {
      if (x >= logicalWidth) break;
      const dataIndex = Math.floor(i * (bufferLength / numBars));
      const barHeightNormalized = this.waveformDataArray[dataIndex] / 255.0;
      let barHeight = barHeightNormalized * logicalHeight;
      if (barHeight < 1 && barHeight > 0) barHeight = 1;
      barHeight = Math.round(barHeight);
      const y = Math.round((logicalHeight - barHeight) / 2);
      ctx.fillRect(Math.floor(x), y, barWidth, barHeight);
      x += barWidth + barSpacing;
    }
  }

  private updateLiveTimer(): void {
    if (!this.isRecording || !this.liveRecordingTimerDisplay) return;
    const now = Date.now();
    const elapsedMs = now - this.recordingStartTime;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hundredths = Math.floor((elapsedMs % 1000) / 10);
    this.liveRecordingTimerDisplay.textContent = `${String(minutes).padStart(
      2,
      '0',
    )}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(
      2,
      '0',
    )}`;
  }

  private startLiveDisplay(): void {
    this.recordingInterface.classList.add('is-live');
    this.liveRecordingTitle.style.display = 'block';
    this.liveWaveformCanvas.style.display = 'block';
    this.liveRecordingTimerDisplay.style.display = 'block';
    this.setupCanvasDimensions();
    if (this.statusIndicatorDiv) this.statusIndicatorDiv.style.display = 'none';
    const currentTitle = this.editorTitle.textContent?.trim();
    const placeholder =
      this.editorTitle.getAttribute('placeholder') || 'Untitled Note';
    this.liveRecordingTitle.textContent =
      currentTitle && currentTitle !== placeholder
        ? currentTitle
        : 'New Recording';
    this.setupAudioVisualizer();
    this.drawLiveWaveform();
    this.recordingStartTime = Date.now();
    this.updateLiveTimer();
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    this.timerIntervalId = window.setInterval(() => this.updateLiveTimer(), 50);
  }

  private stopLiveDisplay(): void {
    this.recordingInterface.classList.remove('is-live');
    this.liveRecordingTitle.style.display = 'none';
    this.liveWaveformCanvas.style.display = 'none';
    this.liveRecordingTimerDisplay.style.display = 'none';
    if (this.statusIndicatorDiv)
      this.statusIndicatorDiv.style.display = 'block';
    if (this.waveformDrawingId) {
      cancelAnimationFrame(this.waveformDrawingId);
      this.waveformDrawingId = null;
    }
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
    if (this.liveWaveformCtx && this.liveWaveformCanvas) {
      this.liveWaveformCtx.clearRect(
        0,
        0,
        this.liveWaveformCanvas.width,
        this.liveWaveformCanvas.height,
      );
    }
    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }
      this.audioContext = null;
    }
    this.analyserNode = null;
    this.waveformDataArray = null;
  }

  private async startRecording(): Promise<void> {
    // Check credits before starting
    if (this.credits <= 0) {
      this.updateUIForState();
      alert('You have reached your daily limit of 5 recordings. Please come back tomorrow!');
      return;
    }

    this.audioBlob = null;
    this.audioChunks = [];
    this.recordingState = 'idle'; // Reset state before attempting
    this.updateUIForState();

    try {
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
      }

      this.recordingStatus.textContent = 'Requesting microphone access...';

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      try {
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType: 'audio/webm',
        });
      } catch (e) {
        this.mediaRecorder = new MediaRecorder(this.stream);
      }

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0)
          this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        this.stopLiveDisplay();
        if (this.audioChunks.length > 0) {
          this.audioBlob = new Blob(this.audioChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm',
          });
          this.recordingState = 'recorded';
          this.updateUIForState();
        } else {
          this.recordingStatus.textContent =
            'No audio data captured. Please try again.';
          this.recordingState = 'idle';
          this.updateUIForState();
        }
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
          this.stream = null;
        }
      };

      this.mediaRecorder.start();
      this.recordingState = 'recording';
      this.updateUIForState();
      this.startLiveDisplay();
    } catch (error) {
      console.error('Error starting recording:', error);
      // Handle various permission/device errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';
      if (
        errorName === 'NotAllowedError' ||
        errorName === 'PermissionDeniedError'
      ) {
        this.recordingStatus.textContent =
          'Microphone permission denied. Please check browser settings.';
      } else if (errorName === 'NotFoundError') {
        this.recordingStatus.textContent =
          'No microphone found. Please connect a microphone.';
      } else {
        this.recordingStatus.textContent = `Error: ${errorMessage}`;
      }

      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      this.recordingState = 'idle';
      this.updateUIForState();
      this.stopLiveDisplay();
    }
  }

  private async stopRecording(): Promise<void> {
    if (this.mediaRecorder && this.recordingState === 'recording') {
      try {
        this.mediaRecorder.stop(); // onstop handler will manage state change
      } catch (e) {
        console.error('Error stopping MediaRecorder:', e);
        this.stopLiveDisplay();
        this.recordingState = 'idle';
        this.updateUIForState();
      }
    }
  }

  private async processAudio(audioBlob: Blob): Promise<void> {
    if (audioBlob.size === 0) {
      this.recordingStatus.textContent =
        'No audio data captured. Please try again.';
      return;
    }
    try {
      this.recordingStatus.textContent = 'Converting audio...';
      const reader = new FileReader();
      const readResult = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve(base64data.split(',')[1]);
        };
        reader.onerror = () => reject(reader.error);
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await readResult;
      const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
      await this.getTranscription(base64Audio, mimeType);
    } catch (error) {
      console.error('Error in processAudio:', error);
      this.recordingStatus.textContent = 'Error processing recording.';
    }
  }

  private async getTranscription(
    base64Audio: string,
    mimeType: string,
  ): Promise<void> {
    try {
      this.recordingStatus.textContent = 'Getting transcription...';
      const contents = [
        { text: 'Generate a complete, detailed transcript of this audio.' },
        { inlineData: { mimeType: mimeType, data: base64Audio } },
      ];
      const response = await this.genAI.models.generateContent({
        model: MODEL_NAME,
        contents: [{ parts: contents }],
      });
      const transcriptionText = response.text;
      if (transcriptionText) {
        this.rawTranscription.textContent = transcriptionText;
        this.rawTranscription.classList.remove('placeholder-active');
        if (this.currentNote)
          this.currentNote.rawTranscription = transcriptionText;

        this.recordingStatus.textContent =
          'Transcription complete. Polishing note...';
        await this.getPolishedNote();
      } else {
        this.recordingStatus.textContent =
          'Transcription failed or returned empty.';
      }
    } catch (error) {
      console.error('Error getting transcription:', error);
      this.recordingStatus.textContent = 'Error getting transcription.';
    }
  }

  private async getPolishedNote(): Promise<void> {
    try {
      if (
        !this.rawTranscription.textContent ||
        this.rawTranscription.classList.contains('placeholder-active')
      ) {
        this.recordingStatus.textContent = 'No transcription to polish';
        return;
      }
      this.recordingStatus.textContent = 'Polishing note...';
      const prompt = `Take this raw transcription and create a polished, well-formatted note.
                    Remove filler words (um, uh, like), repetitions, and false starts.
                    Format any lists or bullet points properly. Use markdown formatting for headings, lists, etc.
                    Maintain all the original content and meaning.

                    Raw transcription:
                    ${this.rawTranscription.textContent}`;
      const response = await this.genAI.models.generateContent({
        model: MODEL_NAME,
        contents: [{ parts: [{ text: prompt }] }],
      });
      const polishedText = response.text;
      if (polishedText) {
        this.polishedNote.innerHTML = marked.parse(polishedText);
        this.polishedNote.classList.remove('placeholder-active');
        // Logic to set note title from content
        let noteTitleSet = false;
        const lines = polishedText.split('\n').map((l) => l.trim());
        for (const line of lines) {
          if (line.startsWith('#')) {
            const title = line.replace(/^#+\s+/, '').trim();
            if (this.editorTitle && title) {
              this.editorTitle.textContent = title;
              this.editorTitle.classList.remove('placeholder-active');
              noteTitleSet = true;
              break;
            }
          }
        }
        if (!noteTitleSet && this.editorTitle) {
          for (const line of lines) {
            if (line.length > 0) {
              let potentialTitle = line.replace(
                /^[\*_\`#\->\s\[\]\(.\d)]+/,
                '',
              );
              potentialTitle = potentialTitle.trim();
              if (potentialTitle.length > 3) {
                this.editorTitle.textContent =
                  potentialTitle.substring(0, 60) +
                  (potentialTitle.length > 60 ? '...' : '');
                this.editorTitle.classList.remove('placeholder-active');
                break;
              }
            }
          }
        }

        if (this.currentNote) this.currentNote.polishedNote = polishedText;

        // Save to history
        this.saveNoteToHistory();
        this.recordingStatus.textContent = 'Done! Your thoughts are now polished.';
      } else {
        this.recordingStatus.textContent =
          'Polishing failed or returned empty.';
      }
    } catch (error) {
      console.error('Error polishing note:', error);
      this.recordingStatus.textContent = 'Error polishing note.';
    }
  }

  private createNewNote(): void {
    this.currentNote = {
      id: `note_${Date.now()}`,
      rawTranscription: '',
      polishedNote: '',
      timestamp: Date.now(),
    };
    const rawPlaceholder =
      this.rawTranscription.getAttribute('placeholder') || '';
    this.rawTranscription.textContent = rawPlaceholder;
    this.rawTranscription.classList.add('placeholder-active');
    const polishedPlaceholder =
      this.polishedNote.getAttribute('placeholder') || '';
    this.polishedNote.innerHTML = polishedPlaceholder;
    this.polishedNote.classList.add('placeholder-active');
    if (this.editorTitle) {
      const placeholder =
        this.editorTitle.getAttribute('placeholder') || 'Untitled Note';
      this.editorTitle.textContent = placeholder;
      this.editorTitle.classList.add('placeholder-active');
    }

    if (this.recordingState === 'recording') {
      this.mediaRecorder?.stop();
    }
    this.stopLiveDisplay();

    this.audioBlob = null;
    this.recordingState = 'idle';
    this.updateUIForState();
  }

  private updateUIForState(): void {
    this.isRecording = this.recordingState === 'recording';
    const recordButtonIcon = this.recordButton.querySelector(
      'i',
    ) as HTMLElement;

    switch (this.recordingState) {
      case 'idle':
        this.recordButton.disabled = false;
        this.recordButton.classList.remove('recording');
        recordButtonIcon.className = 'fas fa-microphone';
        this.recordButton.setAttribute('title', 'Start Recording');
        this.transcribeButton.style.visibility = 'hidden';
        this.transcribeButton.disabled = true;
        this.newButtonIcon.className = 'fas fa-file';
        this.newButton.setAttribute('title', 'New Note');

        if (this.credits <= 0) {
          this.recordingStatus.textContent = `Daily limit reached.`;
          this.recordButton.disabled = true;
          this.recordButton.setAttribute('title', 'Daily limit reached');
        } else {
          this.recordingStatus.textContent = 'Have something on your mind? Rambly it.';
        }
        break;

      case 'recording':
        this.recordButton.disabled = false;
        this.recordButton.classList.add('recording');
        recordButtonIcon.className = 'fas fa-stop';
        this.recordButton.setAttribute('title', 'Stop Recording');
        this.transcribeButton.style.visibility = 'hidden';
        this.transcribeButton.disabled = true;
        // New button is not a discard button during recording
        this.newButtonIcon.className = 'fas fa-file';
        this.newButton.setAttribute('title', 'New Note');
        break;

      case 'recorded':
        this.recordButton.disabled = false;
        this.recordButton.classList.remove('recording');
        recordButtonIcon.className = 'fas fa-redo';
        this.recordButton.setAttribute('title', 'Record Again');
        this.transcribeButton.style.visibility = 'visible';
        this.transcribeButton.disabled = false;
        this.newButtonIcon.className = 'fas fa-trash-alt';
        this.newButton.setAttribute('title', 'Discard Recording');
        this.recordingStatus.textContent = 'Done! Tap the wand to transform your thoughts.';
        break;
    }
  }

  private exportNote(): void {
    if (!this.currentNote || !this.currentNote.polishedNote.trim()) {
      alert('There is no polished note to export.');
      return;
    }
    const noteContent = this.currentNote.polishedNote;
    const placeholder =
      this.editorTitle.getAttribute('placeholder') || 'Untitled Note';
    let noteTitle = this.editorTitle.textContent?.trim() || 'Rambly Note';
    if (noteTitle === placeholder || noteTitle === '') {
      noteTitle = 'Rambly Note';
    }
    const blob = new Blob([noteContent], {
      type: 'text/markdown;charset=utf-8',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${noteTitle.replace(/[\/\\?%*:|"<>]/g, '-')}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new VoiceNotesApp();

  // Screen references
  const authScreen = document.querySelector('.auth-screen') as HTMLDivElement;
  const heroScreen = document.querySelector('.hero-screen') as HTMLDivElement;
  const dashboard = document.querySelector('.dashboard') as HTMLDivElement;
  const sidebar = document.querySelector('.sidebar') as HTMLElement;
  const sidebarOverlay = document.querySelector('.sidebar-overlay') as HTMLDivElement;
  const mobileMenuBtn = document.getElementById('mobileMenuBtn') as HTMLButtonElement;
  const mockLoginForm = document.getElementById('mockLoginForm') as HTMLFormElement;
  const authTabs = document.querySelectorAll('.auth-tab');

  // View references
  const viewEditor = document.getElementById('viewEditor') as HTMLDivElement;
  const viewHistory = document.getElementById('viewHistory') as HTMLDivElement;
  const navItems = document.querySelectorAll('.nav-item');
  const notesGrid = document.getElementById('notesGrid') as HTMLDivElement;

  // Handle auth tab switching
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // Mobile menu toggle
  function toggleMobileMenu() {
    sidebar.classList.toggle('mobile-open');
    sidebarOverlay.classList.toggle('active');
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', toggleMobileMenu);
  }

  // Function to go to dashboard
  function goToDashboard() {
    authScreen?.classList.add('hidden');
    heroScreen?.classList.add('hidden');
    setTimeout(() => {
      if (authScreen) authScreen.style.display = 'none';
      if (heroScreen) heroScreen.style.display = 'none';
      if (dashboard) dashboard.style.display = 'flex';
      populateMockNotes();
    }, 500);
  }

  // Check if we are already in dashboard (for dev refresh)
  if (dashboard && dashboard.style.display !== 'none') {
    populateMockNotes();
  } else if (!authScreen && !heroScreen) {
    // If auth/hero are missing (or just during dev), show dashboard
    if (dashboard) dashboard.style.display = 'flex';
    populateMockNotes();
  }

  // Handle mock login
  if (mockLoginForm) {
    mockLoginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      goToDashboard();
    });
  }

  // Handle social button clicks (mock login)
  document.querySelectorAll('.auth-screen .social-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      goToDashboard();
    });
  });

  // Handle hero screen "Get Started" button
  const startAppButton = document.getElementById('startAppButton');
  if (startAppButton) {
    startAppButton.addEventListener('click', () => {
      heroScreen?.classList.add('hidden');
      setTimeout(() => {
        if (heroScreen) heroScreen.style.display = 'none';
        if (dashboard) dashboard.style.display = 'flex';
        populateMockNotes();
      }, 500);
    });
  }

  // View switching
  function switchView(viewName: string | null) {
    // Close mobile menu if open
    sidebar.classList.remove('mobile-open');
    sidebarOverlay.classList.remove('active');

    // Update nav items
    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else if (!viewName && !item.hasAttribute('data-view')) {
        // handle items without data-view (like Shared/Trash in this mock)
        if (item.textContent?.trim() === viewName) item.classList.add('active');
      }
    });

    // Switch views
    if (viewName === 'history' || !viewName) {
      // Treat unknown views as history for now (Favorites, Shared, Trash)
      viewEditor?.classList.remove('active');
      viewHistory?.classList.add('active');

      const breadcrumbCurrent = document.getElementById('currentViewTitle');
      if (breadcrumbCurrent) {
        if (viewName === 'history') breadcrumbCurrent.textContent = 'Favorites';
        else breadcrumbCurrent.textContent = 'My Ramblings';
      }
      populateMockNotes(); // Refresh to potentially filter
    } else {
      viewHistory?.classList.remove('active');
      viewEditor?.classList.add('active');
      const breadcrumbCurrent = document.getElementById('currentViewTitle');
      if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Untitled Note';
    }
  }

  // Handle nav item clicks
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.getAttribute('data-view');
      switchView(viewName);

      // Handle items without data-view manually
      if (!viewName) {
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        // For now, show history for all other links
        viewEditor?.classList.remove('active');
        viewHistory?.classList.add('active');
        const text = item.querySelector('span')?.textContent;
        const breadcrumbCurrent = document.getElementById('currentViewTitle');
        if (breadcrumbCurrent && text) breadcrumbCurrent.textContent = text;
      }
    });
  });

  // Populate notes for history (real notes + demo data)
  function populateMockNotes() {
    if (!notesGrid) return;

    const NOTES_STORAGE_KEY = 'rambly_notes_v1';

    // Format date for display
    function formatDate(timestamp: number): string {
      const date = new Date(timestamp);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - timestamp) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return `Today • ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
      } else if (diffDays === 1) {
        return `Yesterday • ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }

    // Get title from note content
    function getTitle(note: any): string {
      const text = note.polishedNote || note.rawTranscription || '';
      const firstLine = text.split('\n')[0].replace(/[#*_]/g, '').trim();
      return firstLine.substring(0, 50) || 'Untitled Rambling';
    }

    // Load real notes from localStorage
    let realNotes: any[] = [];
    try {
      const stored = localStorage.getItem(NOTES_STORAGE_KEY);
      if (stored) {
        realNotes = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading notes:', e);
    }

    // Format real notes for display
    const formattedRealNotes = realNotes.map(note => ({
      title: getTitle(note),
      date: formatDate(note.timestamp),
      preview: (note.polishedNote || note.rawTranscription || '').substring(0, 150) + '...',
      tag: 'Rambling',
      tagClass: '',
      duration: '--:--',
      isReal: true
    }));

    // Demo notes (shown if no real notes)
    const demoNotes = [
      { title: 'Product Strategy Q4', date: 'Yesterday • 10:42 AM', preview: 'So basically we need to focus on the retention metrics for the next quarter...', tag: 'Work', tagClass: 'work', duration: '45:00', isReal: false },
      { title: 'Shower Thoughts on AI', date: 'Oct 12, 2023 • 8:15 PM', preview: "It's interesting how context windows are expanding...", tag: 'Personal', tagClass: 'personal', duration: '03:12', isReal: false },
    ];

    // Combine: real notes first, then demo if few real notes
    const allNotes = formattedRealNotes.length >= 2
      ? formattedRealNotes
      : [...formattedRealNotes, ...demoNotes];

    // Update stats
    const totalNotesEl = document.getElementById('totalNotes');
    const totalDurationEl = document.getElementById('totalDuration');
    if (totalNotesEl) totalNotesEl.textContent = `${realNotes.length} Notes`;
    if (totalDurationEl) totalDurationEl.textContent = realNotes.length > 0 ? `${realNotes.length} ramblings` : '0 mins';

    notesGrid.innerHTML = allNotes.map(note => `
      <div class="note-card${note.isReal ? ' real-note' : ''}">
        <div class="note-card-header">
          <div>
            <div class="note-card-title">${note.title}</div>
            <div class="note-card-date">${note.date}</div>
          </div>
          <button class="note-card-menu"><i class="fas fa-ellipsis-h"></i></button>
        </div>
        <div class="note-card-preview">${note.preview}</div>
        <div class="note-card-footer">
          <span class="note-card-tag ${note.tagClass}">#${note.tag}</span>
          <div class="note-card-meta">
            <span class="note-card-duration">${note.duration}</span>
            <button class="note-card-play"><i class="fas fa-play"></i></button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Placeholder handling for contenteditable elements
  document
    .querySelectorAll<HTMLElement>('[contenteditable][placeholder]')
    .forEach((el) => {
      const placeholder = el.getAttribute('placeholder')!;
      function updatePlaceholderState() {
        const currentText = (
          el.id === 'polishedNote' ? el.innerText : el.textContent
        )?.trim();
        if (currentText === '' || currentText === placeholder) {
          if (el.id === 'polishedNote' && currentText === '') {
            el.innerHTML = placeholder;
          } else if (currentText === '') {
            el.textContent = placeholder;
          }
          el.classList.add('placeholder-active');
        } else {
          el.classList.remove('placeholder-active');
        }
      }
      updatePlaceholderState();
      el.addEventListener('focus', function () {
        const currentText = (
          this.id === 'polishedNote' ? this.innerText : this.textContent
        )?.trim();
        if (currentText === placeholder) {
          if (this.id === 'polishedNote') this.innerHTML = '';
          else this.textContent = '';
          this.classList.remove('placeholder-active');
        }
      });
      el.addEventListener('blur', function () {
        updatePlaceholderState();
      });
    });
});

export { };